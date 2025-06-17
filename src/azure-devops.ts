import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  PullRequestInfo, 
  PullRequestThread, 
  PullRequestComment,
  ReviewResponse,
  ThreadStatus,
  CommentType 
} from './types.js';
import { config } from './config.js';

export class AzureDevOpsClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private repositoryId: string;
  private pullRequestId: number;

  constructor() {
    this.baseUrl = config.getAzureDevOpsApiUrl();
    this.repositoryId = config.getRepositoryId();
    this.pullRequestId = config.getPullRequestId();

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.azureDevOps.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 seconds
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`ADO API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('ADO API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`ADO API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('ADO API Response Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Gets pull request information
   */
  public async getPullRequestInfo(): Promise<PullRequestInfo> {
    try {
      const url = `/git/repositories/${this.repositoryId}/pullrequests/${this.pullRequestId}`;
      const response: AxiosResponse<PullRequestInfo> = await this.client.get(url, {
        params: { 'api-version': '7.0' }
      });

      return response.data;
    } catch (error) {
      console.error('Error getting PR info:', error);
      throw new Error(`Failed to get PR info: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Gets existing threads (comments) for the pull request
   */
  public async getExistingThreads(): Promise<PullRequestThread[]> {
    try {
      const url = `/git/repositories/${this.repositoryId}/pullrequests/${this.pullRequestId}/threads`;
      const response = await this.client.get(url, {
        params: { 'api-version': '7.0' }
      });

      return response.data.value || [];
    } catch (error) {
      console.error('Error getting existing threads:', error);
      throw new Error(`Failed to get existing threads: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Posts review comments as threads to the pull request
   */
  public async postReviewComments(reviewResponse: ReviewResponse): Promise<void> {
    if (!reviewResponse.threads || reviewResponse.threads.length === 0) {
      console.log('No review comments to post');
      return;
    }

    console.log(`Posting ${reviewResponse.threads.length} review threads`);

    const results = await Promise.allSettled(
      reviewResponse.threads.map(thread => this.createThread(thread))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Posted ${successful} threads successfully, ${failed} failed`);

    if (failed > 0) {
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason);
      console.error('Failed to post some threads:', errors);
    }
  }

  /**
   * Creates a single thread (comment) on the pull request
   */
  private async createThread(reviewThread: any): Promise<void> {
    try {
      const thread: PullRequestThread = {
        comments: reviewThread.comments.map((comment: any) => ({
          content: comment.content,
          commentType: comment.commentType || CommentType.Text
        })),
        status: reviewThread.status || ThreadStatus.Active,
        threadContext: reviewThread.threadContext
      };

      const url = `/git/repositories/${this.repositoryId}/pullrequests/${this.pullRequestId}/threads`;
      await this.client.post(url, thread, {
        params: { 'api-version': '7.0' }
      });

      console.log(`Created thread for file: ${thread.threadContext?.filePath}`);
    } catch (error) {
      console.error('Error creating thread:', error);
      throw new Error(`Failed to create thread: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Gets existing comments for a specific file to avoid duplicates
   */
  public async getExistingCommentsForFile(filePath: string): Promise<PullRequestComment[]> {
    try {
      const threads = await this.getExistingThreads();
      const fileThreads = threads.filter(thread => 
        thread.threadContext?.filePath === filePath
      );

      const comments: PullRequestComment[] = [];
      fileThreads.forEach(thread => {
        comments.push(...thread.comments);
      });

      return comments;
    } catch (error) {
      console.error(`Error getting existing comments for file ${filePath}:`, error);
      return []; // Return empty array to continue processing
    }
  }

  /**
   * Validates the Azure DevOps connection
   */
  public async validateConnection(): Promise<void> {
    try {
      console.log('Validating Azure DevOps connection...');
      
      // Test connection by getting PR info
      const prInfo = await this.getPullRequestInfo();
      
      console.log(`Connected to PR #${prInfo.pullRequestId}: ${prInfo.title}`);
      console.log(`Repository: ${prInfo.repository.name}`);
      console.log(`Source: ${prInfo.sourceRefName} -> Target: ${prInfo.targetRefName}`);
      
    } catch (error) {
      console.error('Azure DevOps connection validation failed:', error);
      throw new Error(`Connection validation failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Posts a summary comment with review statistics
   */
  public async postSummaryComment(
    filesReviewed: number, 
    threadsCreated: number, 
    reviewExtensions: string[]
  ): Promise<void> {
    try {
      const summaryContent = this.createSummaryContent(filesReviewed, threadsCreated, reviewExtensions);
      
      const thread: PullRequestThread = {
        comments: [{
          content: summaryContent,
          commentType: CommentType.Text
        }],
        status: ThreadStatus.Active
      };

      const url = `/git/repositories/${this.repositoryId}/pullrequests/${this.pullRequestId}/threads`;
      await this.client.post(url, thread, {
        params: { 'api-version': '7.0' }
      });

      console.log('Posted review summary comment');
    } catch (error) {
      console.error('Error posting summary comment:', error);
      // Don't throw - summary is not critical
    }
  }

  private createSummaryContent(
    filesReviewed: number, 
    threadsCreated: number, 
    reviewExtensions: string[]
  ): string {
    const timestamp = new Date().toISOString();
    
    return `## 🤖 Automated Code Review Summary

**Review completed at:** ${timestamp}

**Files reviewed:** ${filesReviewed}
**Comments posted:** ${threadsCreated}
**File types:** ${reviewExtensions.join(', ') || 'None'}

---
*This review was generated automatically using Claude AI. Please review the suggestions and apply them as appropriate.*`;
  }

  /**
   * Extracts error message from various error types
   */
  private getErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      if (error.response?.data?.message) {
        return error.response.data.message;
      }
      if (error.response?.statusText) {
        return `${error.response.status}: ${error.response.statusText}`;
      }
      if (error.message) {
        return error.message;
      }
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return 'Unknown error';
  }

  /**
   * Implements retry logic for API calls
   */
  public async withRetry<T>(
    operation: () => Promise<T>, 
    maxAttempts: number = config.review.retryAttempts
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          break;
        }
        
        const delay = config.review.retryDelayMs * Math.pow(2, attempt - 1);
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}
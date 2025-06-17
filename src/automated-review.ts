#!/usr/bin/env node

import { config } from './config.js';
import { GitUtils } from './git-utils.js';
import { FileFilter } from './file-filter.js';
import { AzureDevOpsClient } from './azure-devops.js';
import { ClaudeReviewer } from './claude-reviewer.js';
import { PullRequestComment } from './types.js';

/**
 * Main class that orchestrates the automated PR review process
 */
class AutomatedPRReview {
  private gitUtils: GitUtils;
  private fileFilter: FileFilter;
  private adoClient: AzureDevOpsClient;
  private claudeReviewer: ClaudeReviewer;

  constructor() {
    this.gitUtils = new GitUtils();
    this.fileFilter = new FileFilter();
    this.adoClient = new AzureDevOpsClient();
    this.claudeReviewer = new ClaudeReviewer();
  }

  /**
   * Main entry point for the automated review process
   */
  public async run(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('🤖 Starting Automated PR Review');
      console.log('================================');
      
      // Log configuration
      config.logConfiguration();
      console.log('');

      // Step 1: Validate environment and connections
      await this.validateEnvironment();

      // Step 2: Get changed files and generate diff
      const { unifiedDiff, changedFiles, filteredFiles } = await this.getChangesAndDiff();

      // Step 3: Get existing comments to avoid duplicates
      const existingComments = await this.getExistingComments(filteredFiles.map(f => f.path));

      // Step 4: Review changes with Claude
      const reviewResponse = await this.performReview(unifiedDiff, filteredFiles.map(f => f.path), existingComments);

      // Step 5: Post review comments
      await this.postReviewResults(reviewResponse, filteredFiles.length);

      // Success summary
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log('');
      console.log('✅ Automated PR Review Completed Successfully');
      console.log(`⏱️  Total time: ${duration} seconds`);

    } catch (error) {
      console.error('');
      console.error('❌ Automated PR Review Failed');
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      
      // Try to post an error comment to the PR
      await this.postErrorComment(error);
      
      process.exit(1);
    }
  }

  /**
   * Validates the environment and connections
   */
  private async validateEnvironment(): Promise<void> {
    console.log('🔍 Validating environment...');
    
    try {
      // Validate git repository
      await this.gitUtils.validateRepository();
      
      // Validate Azure DevOps connection
      await this.adoClient.validateConnection();
      
      console.log('✅ Environment validation passed');
    } catch (error) {
      throw new Error(`Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets changed files and generates unified diff
   */
  private async getChangesAndDiff(): Promise<{
    unifiedDiff: string;
    changedFiles: any[];
    filteredFiles: any[];
  }> {
    console.log('📁 Getting changed files and generating diff...');
    
    try {
      // Get changed files
      const changedFiles = await this.gitUtils.getChangedFiles();
      console.log(`Found ${changedFiles.length} changed files`);

      // Filter files
      const filteredFiles = this.fileFilter.filterFiles(changedFiles);
      
      // Log filtering summary
      const filterSummary = this.fileFilter.getFilterSummary(changedFiles, filteredFiles);
      console.log(filterSummary);

      // Validate we have files to review
      this.fileFilter.validateFilteredFiles(filteredFiles);

      // Generate unified diff
      const unifiedDiff = await this.gitUtils.generateUnifiedDiff();

      return { unifiedDiff, changedFiles, filteredFiles };
    } catch (error) {
      throw new Error(`Failed to get changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets existing comments for all files to avoid duplicates
   */
  private async getExistingComments(filePaths: string[]): Promise<Record<string, PullRequestComment[]>> {
    console.log('💬 Getting existing comments...');
    
    const existingComments: Record<string, PullRequestComment[]> = {};
    
    try {
      for (const filePath of filePaths) {
        existingComments[filePath] = await this.adoClient.getExistingCommentsForFile(filePath);
      }
      
      const totalExisting = Object.values(existingComments).reduce((sum, comments) => sum + comments.length, 0);
      console.log(`Found ${totalExisting} existing comments across ${filePaths.length} files`);
      
      return existingComments;
    } catch (error) {
      console.warn('Warning: Could not get existing comments, proceeding without deduplication');
      return {};
    }
  }

  /**
   * Performs the code review using Claude
   */
  private async performReview(
    unifiedDiff: string,
    filePaths: string[],
    existingComments: Record<string, PullRequestComment[]>
  ): Promise<any> {
    console.log('🧠 Performing code review with Claude...');
    
    try {
      const reviewResponse = await this.claudeReviewer.reviewWithRetry(
        unifiedDiff,
        filePaths,
        existingComments
      );

      const stats = this.claudeReviewer.getReviewStats(reviewResponse);
      console.log(`📊 Review completed:`);
      console.log(`   - Threads: ${stats.totalThreads}`);
      console.log(`   - Comments: ${stats.totalComments}`);
      console.log(`   - Files with comments: ${stats.filesWithComments}`);

      return reviewResponse;
    } catch (error) {
      throw new Error(`Code review failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Posts review results to the PR
   */
  private async postReviewResults(reviewResponse: any, filesReviewed: number): Promise<void> {
    console.log('📝 Posting review results...');
    
    try {
      // Post review comments
      await this.adoClient.postReviewComments(reviewResponse);
      
      // Get file extensions for summary
      const reviewExtensions = this.fileFilter.getReviewableExtensions([]);
      
      // Post summary comment
      const threadsCreated = reviewResponse.threads?.length || 0;
      await this.adoClient.postSummaryComment(filesReviewed, threadsCreated, reviewExtensions);
      
      console.log('✅ Review results posted successfully');
    } catch (error) {
      throw new Error(`Failed to post review results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Posts an error comment to the PR when the review fails
   */
  private async postErrorComment(error: any): Promise<void> {
    try {
      const errorMessage = `## ❌ Automated Code Review Failed

The automated code review encountered an error and could not complete:

\`\`\`
${error instanceof Error ? error.message : 'Unknown error'}
\`\`\`

Please check the build logs for more details or contact the development team.

---
*This is an automated message from the PR review system.*`;

      const thread = {
        comments: [{
          content: errorMessage,
          commentType: 1 // Text comment
        }],
        status: 1 // Active
      };

      await this.adoClient.withRetry(async () => {
        const url = `/git/repositories/${this.adoClient['repositoryId']}/pullrequests/${this.adoClient['pullRequestId']}/threads`;
        await this.adoClient['client'].post(url, thread, {
          params: { 'api-version': '7.0' }
        });
      });

      console.log('Posted error comment to PR');
    } catch (postError) {
      console.error('Failed to post error comment:', postError);
    }
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const reviewer = new AutomatedPRReview();
  await reviewer.run();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function if this file is executed directly
// Check if this module is the main module being executed
if (process.argv[1]?.endsWith('automated-review.js') || process.argv[1]?.endsWith('automated-review.ts')) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { AutomatedPRReview };
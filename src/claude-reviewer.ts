import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import { ReviewRequest, ReviewResponse, PullRequestComment } from './types.js';
import { config } from './config.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

export class ClaudeReviewer {
  private promptTemplate: string = '';

  constructor() {
    this.loadPromptTemplate();
  }

  /**
   * Loads the review prompt template from file
   */
  private async loadPromptTemplate(): Promise<void> {
    try {
      this.promptTemplate = await readFile(join(process.cwd(), 'prompt.txt'), 'utf-8');
      console.log('Loaded review prompt template');
    } catch (error) {
      console.error('Error loading prompt template:', error);
      // Fallback to a basic prompt if file is not found
      this.promptTemplate = this.getDefaultPrompt();
    }
  }

  /**
   * Reviews code changes using Claude AI
   */
  public async reviewChanges(
    unifiedDiff: string,
    changedFiles: string[],
    existingComments: Record<string, PullRequestComment[]>
  ): Promise<ReviewResponse> {
    try {
      console.log('Starting Claude code review...');
      console.log(`Reviewing ${changedFiles.length} files`);

      // Ensure prompt template is loaded
      if (!this.promptTemplate) {
        await this.loadPromptTemplate();
      }

      // Prepare the review prompt
      const reviewPrompt = this.buildReviewPrompt(unifiedDiff, changedFiles, existingComments);
      
      console.log(`Sending ${reviewPrompt.length} characters to Claude`);

      // Call Claude API
      const messages: SDKMessage[] = [];
      const abortController = new AbortController();
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, config.review.timeoutMs);

      try {
        for await (const message of query({
          prompt: reviewPrompt,
          abortController,
          options: {
            maxTurns: config.review.maxTurns,
          },
        })) {
          messages.push(message);
        }
      } finally {
        clearTimeout(timeoutId);
      }

      console.log(`Received ${messages.length} messages from Claude`);

      // Parse the response
      const reviewResponse = this.parseClaudeResponse(messages);
      
      console.log(`Parsed ${reviewResponse.threads?.length || 0} review threads`);
      
      return reviewResponse;

    } catch (error) {
      console.error('Error during Claude review:', error);
      throw new Error(`Claude review failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds the complete review prompt for Claude
   */
  private buildReviewPrompt(
    unifiedDiff: string,
    changedFiles: string[],
    existingComments: Record<string, PullRequestComment[]>
  ): string {
    const filesContext = changedFiles.map(file => {
      const comments = existingComments[file] || [];
      return `File: ${file}\nExisting Comments: ${JSON.stringify(comments)}`;
    }).join('\n\n');

    return `${this.promptTemplate}

Changed Files Context:
${filesContext}

Unified Diff:
${unifiedDiff}

Please analyze the code changes and provide your review in the specified JSON format.`;
  }

  /**
   * Parses Claude's response to extract review threads
   */
  private parseClaudeResponse(messages: SDKMessage[]): ReviewResponse {
    try {
      // Find the last assistant message with content
      const lastMessage = messages
        .filter((msg): msg is any => msg.type === 'assistant' && msg.message?.content)
        .pop();

      if (!lastMessage || !lastMessage.message?.content) {
        console.warn('No content in Claude response');
        return { threads: [] };
      }

      console.log('Parsing Claude response...');
      
      // Extract content from the message
      const content = Array.isArray(lastMessage.message.content)
        ? lastMessage.message.content.map((c: any) => c.text || c.content || '').join('')
        : lastMessage.message.content;
      
      // Try to extract JSON from the response
      const jsonMatch = this.extractJsonFromResponse(content);
      
      if (!jsonMatch) {
        console.warn('No JSON found in Claude response');
        return { threads: [] };
      }

      const reviewResponse = JSON.parse(jsonMatch) as ReviewResponse;
      
      // Validate the response structure
      this.validateReviewResponse(reviewResponse);
      
      return reviewResponse;

    } catch (error) {
      console.error('Error parsing Claude response:', error);
      console.log('Raw response:', messages.map(m => {
        if (m.type === 'assistant' && m.message?.content) {
          return Array.isArray(m.message.content)
            ? m.message.content.map((c: any) => c.text || c.content || '').join('')
            : m.message.content;
        }
        return JSON.stringify(m);
      }).join('\n'));
      
      // Return empty response rather than failing completely
      return { threads: [] };
    }
  }

  /**
   * Extracts JSON from Claude's response text
   */
  private extractJsonFromResponse(content: string): string | null {
    // Try to find JSON object in the response
    const jsonPatterns = [
      // Look for JSON wrapped in code blocks
      /```json\s*(\{[\s\S]*?\})\s*```/i,
      // Look for JSON without code blocks
      /(\{[\s\S]*"threads"[\s\S]*?\})/i,
      // Look for any JSON object
      /(\{[\s\S]*?\})/
    ];

    for (const pattern of jsonPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        try {
          // Validate it's proper JSON
          JSON.parse(match[1]);
          return match[1];
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Validates the structure of Claude's review response
   */
  private validateReviewResponse(response: ReviewResponse): void {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response structure');
    }

    if (!Array.isArray(response.threads)) {
      throw new Error('Response must contain threads array');
    }

    // Validate each thread
    response.threads.forEach((thread, index) => {
      if (!thread.comments || !Array.isArray(thread.comments)) {
        throw new Error(`Thread ${index} must have comments array`);
      }

      if (!thread.threadContext || !thread.threadContext.filePath) {
        throw new Error(`Thread ${index} must have threadContext with filePath`);
      }

      thread.comments.forEach((comment, commentIndex) => {
        if (!comment.content || typeof comment.content !== 'string') {
          throw new Error(`Thread ${index}, comment ${commentIndex} must have content`);
        }
      });
    });
  }

  /**
   * Implements retry logic for Claude API calls
   */
  public async reviewWithRetry(
    unifiedDiff: string,
    changedFiles: string[],
    existingComments: Record<string, PullRequestComment[]>
  ): Promise<ReviewResponse> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= config.review.retryAttempts; attempt++) {
      try {
        return await this.reviewChanges(unifiedDiff, changedFiles, existingComments);
      } catch (error) {
        lastError = error;
        
        if (attempt === config.review.retryAttempts) {
          break;
        }
        
        const delay = config.review.retryDelayMs * Math.pow(2, attempt - 1);
        console.log(`Review attempt ${attempt} failed, retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Default prompt template if file is not found
   */
  private getDefaultPrompt(): string {
    return `Your task is to act as a code reviewer of a pull request within Azure DevOps.
- You are provided with the code changes (diff) in a Unified Diff format.
- You are provided with existing comments on files, you must provide any additional code review comments that are not duplicates.
- Do not highlight minor issues and nitpicks.
- Only comment on modified lines.
- If there are any bugs, highlight them.
- If there are major performance problems, highlight them.
- Provide details on missed use of best-practices.

The response should be a single JSON object (without fenced codeblock) and it must use this sample JSON format:
{
    "threads": [
        {
            "comments": [
                {
                    "content": "<Comment in markdown format without markdown fenced codeblock>",
                    "commentType": 2
                }
            ],
            "status": 1,
            "threadContext": {
                "filePath": "<string>",
                "rightFileStart": {
                    "line": <integer>,
                    "snippet": "<code snippet for suggestion>",
                    "offset": <integer>
                },
                "rightFileEnd": {
                    "line": <integer>,
                    "offset": <integer>
                }
            }
        }
    ]
}`;
  }

  /**
   * Gets statistics about the review
   */
  public getReviewStats(response: ReviewResponse): {
    totalThreads: number;
    totalComments: number;
    filesWithComments: number;
  } {
    const totalThreads = response.threads?.length || 0;
    const totalComments = response.threads?.reduce((sum, thread) => sum + thread.comments.length, 0) || 0;
    const filesWithComments = new Set(
      response.threads?.map(thread => thread.threadContext?.filePath).filter(Boolean)
    ).size;

    return {
      totalThreads,
      totalComments,
      filesWithComments
    };
  }
}
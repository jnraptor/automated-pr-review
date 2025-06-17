// Using Jest globals (describe, it, expect, beforeEach, jest are available globally)
import { AzureDevOpsClient } from '../src/azure-devops.js';
import { PullRequestInfo, ReviewResponse } from '../src/types.js';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })),
  isAxiosError: jest.fn()
}));

describe('AzureDevOpsClient', () => {
  let adoClient: AzureDevOpsClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    const axios = require('axios');
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };
    axios.create.mockReturnValue(mockAxiosInstance);
    
    adoClient = new AzureDevOpsClient();
    jest.clearAllMocks();
  });

  describe('getPullRequestInfo', () => {
    it('should fetch pull request information successfully', async () => {
      const mockPRInfo: PullRequestInfo = {
        pullRequestId: 123,
        repository: {
          id: 'repo-id',
          name: 'mock-repo'
        },
        sourceRefName: 'refs/heads/feature-branch',
        targetRefName: 'refs/heads/main',
        title: 'Test PR',
        description: 'Test description'
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockPRInfo
      });

      const result = await adoClient.getPullRequestInfo();

      expect(result).toEqual(mockPRInfo);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/git/repositories/mock-repo/pullrequests/123',
        { params: { 'api-version': '7.0' } }
      );
    });

    it('should handle API errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

      await expect(adoClient.getPullRequestInfo()).rejects.toThrow(
        'Failed to get PR info: API Error'
      );
    });
  });

  describe('getExistingThreads', () => {
    it('should fetch existing threads successfully', async () => {
      const mockThreads = [
        {
          id: 1,
          comments: [
            {
              id: 1,
              content: 'Existing comment',
              commentType: 1
            }
          ],
          status: 1,
          threadContext: {
            filePath: 'src/test.cs'
          }
        }
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { value: mockThreads }
      });

      const result = await adoClient.getExistingThreads();

      expect(result).toEqual(mockThreads);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/git/repositories/mock-repo/pullrequests/123/threads',
        { params: { 'api-version': '7.0' } }
      );
    });

    it('should return empty array when no threads exist', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { value: null }
      });

      const result = await adoClient.getExistingThreads();

      expect(result).toEqual([]);
    });
  });

  describe('postReviewComments', () => {
    it('should post review comments successfully', async () => {
      const mockReviewResponse: ReviewResponse = {
        threads: [
          {
            comments: [
              {
                content: 'Test review comment',
                commentType: 2
              }
            ],
            status: 1,
            threadContext: {
              filePath: 'src/test.cs',
              rightFileStart: {
                line: 10,
                offset: 1
              },
              rightFileEnd: {
                line: 10,
                offset: 20
              }
            }
          }
        ]
      };

      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await adoClient.postReviewComments(mockReviewResponse);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/git/repositories/mock-repo/pullrequests/123/threads',
        expect.objectContaining({
          comments: expect.arrayContaining([
            expect.objectContaining({
              content: 'Test review comment',
              commentType: 2
            })
          ]),
          status: 1,
          threadContext: expect.objectContaining({
            filePath: 'src/test.cs'
          })
        }),
        { params: { 'api-version': '7.0' } }
      );
    });

    it('should handle empty review response', async () => {
      const emptyResponse: ReviewResponse = { threads: [] };

      await adoClient.postReviewComments(emptyResponse);

      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('should continue posting even if some threads fail', async () => {
      const mockReviewResponse: ReviewResponse = {
        threads: [
          {
            comments: [{ content: 'Comment 1', commentType: 2 }],
            status: 1,
            threadContext: { filePath: 'file1.cs' }
          },
          {
            comments: [{ content: 'Comment 2', commentType: 2 }],
            status: 1,
            threadContext: { filePath: 'file2.cs' }
          }
        ]
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce(new Error('Failed to post'));

      await adoClient.postReviewComments(mockReviewResponse);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('getExistingCommentsForFile', () => {
    it('should return comments for specific file', async () => {
      const mockThreads = [
        {
          comments: [
            { content: 'Comment on file1', commentType: 1 }
          ],
          threadContext: { filePath: 'src/file1.cs' }
        },
        {
          comments: [
            { content: 'Comment on file2', commentType: 1 }
          ],
          threadContext: { filePath: 'src/file2.cs' }
        }
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { value: mockThreads }
      });

      const result = await adoClient.getExistingCommentsForFile('src/file1.cs');

      expect(result).toHaveLength(1);
      expect(result[0]?.content).toBe('Comment on file1');
    });

    it('should return empty array for file with no comments', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { value: [] }
      });

      const result = await adoClient.getExistingCommentsForFile('src/newfile.cs');

      expect(result).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API Error'));

      const result = await adoClient.getExistingCommentsForFile('src/file.cs');

      expect(result).toEqual([]);
    });
  });

  describe('validateConnection', () => {
    it('should validate connection successfully', async () => {
      const mockPRInfo: PullRequestInfo = {
        pullRequestId: 123,
        repository: { id: 'repo-id', name: 'mock-repo' },
        sourceRefName: 'refs/heads/feature',
        targetRefName: 'refs/heads/main',
        title: 'Test PR',
        description: 'Test description'
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockPRInfo });

      await expect(adoClient.validateConnection()).resolves.not.toThrow();
    });

    it('should throw error when connection fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      await expect(adoClient.validateConnection()).rejects.toThrow(
        'Connection validation failed: Failed to get PR info: Connection failed'
      );
    });
  });

  describe('postSummaryComment', () => {
    it('should post summary comment successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await adoClient.postSummaryComment(5, 3, ['cs', 'ts']);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/git/repositories/mock-repo/pullrequests/123/threads',
        expect.objectContaining({
          comments: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('**Files reviewed:** 5'),
              commentType: 1
            })
          ]),
          status: 1
        }),
        { params: { 'api-version': '7.0' } }
      );
    });

    it('should not throw error if summary posting fails', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Failed to post summary'));

      await expect(
        adoClient.postSummaryComment(5, 3, ['cs'])
      ).resolves.not.toThrow();
    });
  });

  describe('withRetry', () => {
    it('should retry operation on failure', async () => {
      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await adoClient.withRetry(operation, 3);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(adoClient.withRetry(operation, 2)).rejects.toThrow('Persistent failure');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
// Using Jest globals (describe, it, expect, beforeEach, jest are available globally)

// Mock the Claude Code SDK first
jest.mock('@anthropic-ai/claude-code', () => ({
  query: jest.fn()
}));

import { AutomatedPRReview } from '../src/automated-review.js';

// Mock all dependencies
jest.mock('../src/git-utils.js');
jest.mock('../src/file-filter.js');
jest.mock('../src/azure-devops.js');
jest.mock('../src/claude-reviewer.js');

describe('AutomatedPRReview Integration Tests', () => {
  let automatedReview: AutomatedPRReview;
  let mockGitUtils: any;
  let mockFileFilter: any;
  let mockAdoClient: any;
  let mockClaudeReviewer: any;

  beforeEach(() => {
    // Setup mocks
    const { GitUtils } = require('../src/git-utils.js');
    const { FileFilter } = require('../src/file-filter.js');
    const { AzureDevOpsClient } = require('../src/azure-devops.js');
    const { ClaudeReviewer } = require('../src/claude-reviewer.js');

    mockGitUtils = {
      validateRepository: jest.fn(),
      getChangedFiles: jest.fn(),
      generateUnifiedDiff: jest.fn()
    };

    mockFileFilter = {
      filterFiles: jest.fn(),
      getFilterSummary: jest.fn(),
      validateFilteredFiles: jest.fn(),
      getReviewableExtensions: jest.fn()
    };

    mockAdoClient = {
      validateConnection: jest.fn(),
      getExistingCommentsForFile: jest.fn(),
      postReviewComments: jest.fn(),
      postSummaryComment: jest.fn(),
      withRetry: jest.fn()
    };

    mockClaudeReviewer = {
      reviewWithRetry: jest.fn(),
      getReviewStats: jest.fn()
    };

    GitUtils.mockImplementation(() => mockGitUtils);
    FileFilter.mockImplementation(() => mockFileFilter);
    AzureDevOpsClient.mockImplementation(() => mockAdoClient);
    ClaudeReviewer.mockImplementation(() => mockClaudeReviewer);

    automatedReview = new AutomatedPRReview();
    jest.clearAllMocks();
  });

  describe('run', () => {
    it('should complete full review process successfully', async () => {
      // Setup mock data
      const mockChangedFiles = [
        {
          path: 'src/Program.cs',
          status: 'modified' as const,
          diff: 'mock diff',
          isBinary: false,
          size: 1024
        }
      ];

      const mockFilteredFiles = [mockChangedFiles[0]];

      const mockUnifiedDiff = 'unified diff content';

      const mockExistingComments = {
        'src/Program.cs': []
      };

      const mockReviewResponse = {
        threads: [
          {
            comments: [
              {
                content: 'Consider adding error handling',
                commentType: 2
              }
            ],
            status: 1,
            threadContext: {
              filePath: 'src/Program.cs'
            }
          }
        ]
      };

      const mockReviewStats = {
        totalThreads: 1,
        totalComments: 1,
        filesWithComments: 1
      };

      // Setup mock implementations
      mockGitUtils.validateRepository.mockResolvedValue(undefined);
      mockAdoClient.validateConnection.mockResolvedValue(undefined);
      mockGitUtils.getChangedFiles.mockResolvedValue(mockChangedFiles);
      mockFileFilter.filterFiles.mockReturnValue(mockFilteredFiles);
      mockFileFilter.getFilterSummary.mockReturnValue('Filter summary');
      mockFileFilter.validateFilteredFiles.mockReturnValue(undefined);
      mockGitUtils.generateUnifiedDiff.mockResolvedValue(mockUnifiedDiff);
      mockAdoClient.getExistingCommentsForFile.mockResolvedValue([]);
      mockClaudeReviewer.reviewWithRetry.mockResolvedValue(mockReviewResponse);
      mockClaudeReviewer.getReviewStats.mockReturnValue(mockReviewStats);
      mockAdoClient.postReviewComments.mockResolvedValue(undefined);
      mockFileFilter.getReviewableExtensions.mockReturnValue(['cs']);
      mockAdoClient.postSummaryComment.mockResolvedValue(undefined);

      // Execute
      await automatedReview.run();

      // Verify all steps were called
      expect(mockGitUtils.validateRepository).toHaveBeenCalled();
      expect(mockAdoClient.validateConnection).toHaveBeenCalled();
      expect(mockGitUtils.getChangedFiles).toHaveBeenCalled();
      expect(mockFileFilter.filterFiles).toHaveBeenCalledWith(mockChangedFiles);
      expect(mockGitUtils.generateUnifiedDiff).toHaveBeenCalled();
      expect(mockAdoClient.getExistingCommentsForFile).toHaveBeenCalledWith('src/Program.cs');
      expect(mockClaudeReviewer.reviewWithRetry).toHaveBeenCalledWith(
        mockUnifiedDiff,
        ['src/Program.cs'],
        mockExistingComments
      );
      expect(mockAdoClient.postReviewComments).toHaveBeenCalledWith(mockReviewResponse);
      expect(mockAdoClient.postSummaryComment).toHaveBeenCalledWith(1, 1, ['cs']);
    });

    it('should handle environment validation failure', async () => {
      mockGitUtils.validateRepository.mockRejectedValue(new Error('Git validation failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(automatedReview.run()).rejects.toThrow('process.exit called');

      expect(consoleSpy).toHaveBeenCalledWith('❌ Automated PR Review Failed');
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should handle no files to review', async () => {
      mockGitUtils.validateRepository.mockResolvedValue(undefined);
      mockAdoClient.validateConnection.mockResolvedValue(undefined);
      mockGitUtils.getChangedFiles.mockResolvedValue([]);
      mockFileFilter.filterFiles.mockReturnValue([]);
      mockFileFilter.getFilterSummary.mockReturnValue('No files to review');
      mockFileFilter.validateFilteredFiles.mockImplementation(() => {
        throw new Error('No files remain after filtering. Nothing to review.');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(automatedReview.run()).rejects.toThrow('process.exit called');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error:',
        'Failed to get changes: No files remain after filtering. Nothing to review.'
      );

      consoleSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should handle Claude review failure', async () => {
      // Setup successful initial steps
      mockGitUtils.validateRepository.mockResolvedValue(undefined);
      mockAdoClient.validateConnection.mockResolvedValue(undefined);
      mockGitUtils.getChangedFiles.mockResolvedValue([
        { path: 'src/test.cs', status: 'modified', diff: 'diff', isBinary: false, size: 100 }
      ]);
      mockFileFilter.filterFiles.mockReturnValue([
        { path: 'src/test.cs', status: 'modified', diff: 'diff', isBinary: false, size: 100 }
      ]);
      mockFileFilter.getFilterSummary.mockReturnValue('Summary');
      mockFileFilter.validateFilteredFiles.mockReturnValue(undefined);
      mockGitUtils.generateUnifiedDiff.mockResolvedValue('diff');
      mockAdoClient.getExistingCommentsForFile.mockResolvedValue([]);

      // Make Claude review fail
      mockClaudeReviewer.reviewWithRetry.mockRejectedValue(new Error('Claude API error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(automatedReview.run()).rejects.toThrow('process.exit called');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error:',
        'Code review failed: Claude API error'
      );

      consoleSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('validateEnvironment', () => {
    it('should validate git and Azure DevOps connections', async () => {
      mockGitUtils.validateRepository.mockResolvedValue(undefined);
      mockAdoClient.validateConnection.mockResolvedValue(undefined);

      await expect((automatedReview as any).validateEnvironment()).resolves.not.toThrow();

      expect(mockGitUtils.validateRepository).toHaveBeenCalled();
      expect(mockAdoClient.validateConnection).toHaveBeenCalled();
    });

    it('should throw error when git validation fails', async () => {
      mockGitUtils.validateRepository.mockRejectedValue(new Error('Git error'));

      await expect((automatedReview as any).validateEnvironment()).rejects.toThrow(
        'Environment validation failed: Git error'
      );
    });
  });

  describe('getChangesAndDiff', () => {
    it('should get and filter changes successfully', async () => {
      const mockChangedFiles = [
        { path: 'src/test.cs', status: 'modified', diff: 'diff', isBinary: false, size: 100 }
      ];
      const mockFilteredFiles = [mockChangedFiles[0]];
      const mockUnifiedDiff = 'unified diff';

      mockGitUtils.getChangedFiles.mockResolvedValue(mockChangedFiles);
      mockFileFilter.filterFiles.mockReturnValue(mockFilteredFiles);
      mockFileFilter.getFilterSummary.mockReturnValue('Summary');
      mockFileFilter.validateFilteredFiles.mockReturnValue(undefined);
      mockGitUtils.generateUnifiedDiff.mockResolvedValue(mockUnifiedDiff);

      const result = await (automatedReview as any).getChangesAndDiff();

      expect(result).toEqual({
        unifiedDiff: mockUnifiedDiff,
        changedFiles: mockChangedFiles,
        filteredFiles: mockFilteredFiles
      });
    });
  });

  describe('getExistingComments', () => {
    it('should get existing comments for all files', async () => {
      const filePaths = ['file1.cs', 'file2.cs'];
      const mockComments = [
        { content: 'Comment 1', commentType: 1 }
      ];

      mockAdoClient.getExistingCommentsForFile.mockResolvedValue(mockComments);

      const result = await (automatedReview as any).getExistingComments(filePaths);

      expect(result).toEqual({
        'file1.cs': mockComments,
        'file2.cs': mockComments
      });
      expect(mockAdoClient.getExistingCommentsForFile).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully and return empty object', async () => {
      const filePaths = ['file1.cs'];
      mockAdoClient.getExistingCommentsForFile.mockRejectedValue(new Error('API error'));

      const result = await (automatedReview as any).getExistingComments(filePaths);

      expect(result).toEqual({});
    });
  });

  describe('performReview', () => {
    it('should perform review and return stats', async () => {
      const mockResponse = { threads: [] };
      const mockStats = { totalThreads: 0, totalComments: 0, filesWithComments: 0 };

      mockClaudeReviewer.reviewWithRetry.mockResolvedValue(mockResponse);
      mockClaudeReviewer.getReviewStats.mockReturnValue(mockStats);

      const result = await (automatedReview as any).performReview('diff', ['file.cs'], {});

      expect(result).toBe(mockResponse);
      expect(mockClaudeReviewer.reviewWithRetry).toHaveBeenCalledWith('diff', ['file.cs'], {});
      expect(mockClaudeReviewer.getReviewStats).toHaveBeenCalledWith(mockResponse);
    });
  });

  describe('postReviewResults', () => {
    it('should post review comments and summary', async () => {
      const mockResponse = { threads: [{ comments: [] }] };
      mockAdoClient.postReviewComments.mockResolvedValue(undefined);
      mockFileFilter.getReviewableExtensions.mockReturnValue(['cs']);
      mockAdoClient.postSummaryComment.mockResolvedValue(undefined);

      await (automatedReview as any).postReviewResults(mockResponse, 5);

      expect(mockAdoClient.postReviewComments).toHaveBeenCalledWith(mockResponse);
      expect(mockAdoClient.postSummaryComment).toHaveBeenCalledWith(5, 1, ['cs']);
    });
  });
});
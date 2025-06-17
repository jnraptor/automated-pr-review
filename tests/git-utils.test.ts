// Using Jest globals (describe, it, expect, beforeEach, jest are available globally)
import { GitUtils } from '../src/git-utils.js';
import { GitDiffFile } from '../src/types.js';

// Mock simple-git
jest.mock('simple-git', () => ({
  simpleGit: jest.fn(() => ({
    fetch: jest.fn(),
    diff: jest.fn(),
    diffSummary: jest.fn(),
    raw: jest.fn(),
    checkIsRepo: jest.fn(),
    getRemotes: jest.fn(),
    status: jest.fn(),
    branch: jest.fn()
  }))
}));

describe('GitUtils', () => {
  let gitUtils: GitUtils;
  let mockGit: any;

  beforeEach(() => {
    const { simpleGit } = require('simple-git');
    mockGit = {
      fetch: jest.fn(),
      diff: jest.fn(),
      diffSummary: jest.fn(),
      raw: jest.fn(),
      checkIsRepo: jest.fn(),
      getRemotes: jest.fn(),
      status: jest.fn(),
      branch: jest.fn()
    };
    simpleGit.mockReturnValue(mockGit);
    
    gitUtils = new GitUtils();
    jest.clearAllMocks();
  });

  describe('generateUnifiedDiff', () => {
    it('should generate unified diff successfully', async () => {
      const mockDiff = `diff --git a/src/Program.cs b/src/Program.cs
index 1234567..abcdefg 100644
--- a/src/Program.cs
+++ b/src/Program.cs
@@ -1,3 +1,4 @@
 using System;
+using System.Collections.Generic;
 
 public class Program`;

      mockGit.fetch.mockResolvedValue(undefined);
      mockGit.diff.mockResolvedValue(mockDiff);

      const result = await gitUtils.generateUnifiedDiff();

      expect(result).toBe(mockDiff);
      expect(mockGit.fetch).toHaveBeenCalledWith(['origin']);
      expect(mockGit.diff).toHaveBeenCalledWith([
        'origin/main...origin/feature-branch',
        '--unified=3',
        '--no-color'
      ]);
    });

    it('should throw error when no differences found', async () => {
      mockGit.fetch.mockResolvedValue(undefined);
      mockGit.diff.mockResolvedValue('');

      await expect(gitUtils.generateUnifiedDiff()).rejects.toThrow(
        'No differences found between branches'
      );
    });

    it('should handle git command errors', async () => {
      mockGit.fetch.mockRejectedValue(new Error('Git fetch failed'));

      await expect(gitUtils.generateUnifiedDiff()).rejects.toThrow(
        'Failed to generate diff: Git fetch failed'
      );
    });
  });

  describe('getChangedFiles', () => {
    it('should get changed files with correct metadata', async () => {
      const mockDiffSummary = {
        files: [
          {
            file: 'src/Program.cs',
            insertions: 5,
            deletions: 2
          },
          {
            file: 'src/Utils.cs',
            insertions: 10,
            deletions: 0
          }
        ]
      };

      const mockFileDiff = `diff --git a/src/Program.cs b/src/Program.cs
index 1234567..abcdefg 100644
--- a/src/Program.cs
+++ b/src/Program.cs
@@ -1,3 +1,6 @@
 using System;
+using System.Collections.Generic;
 
-public class Program
+public class Program
+{
+    // New content`;

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary);
      mockGit.diff.mockResolvedValue(mockFileDiff);
      mockGit.raw.mockResolvedValue('5\t2\tsrc/Program.cs'); // Not binary

      const result = await gitUtils.getChangedFiles();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        path: 'src/Program.cs',
        status: 'modified',
        diff: mockFileDiff,
        isBinary: false
      });
      expect(result[1]).toMatchObject({
        path: 'src/Utils.cs',
        status: 'added' // insertions > 0, deletions = 0
      });
    });

    it('should detect binary files correctly', async () => {
      const mockDiffSummary = {
        files: [
          {
            file: 'image.png',
            insertions: 0,
            deletions: 0
          }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary);
      mockGit.diff.mockResolvedValue('');
      mockGit.raw.mockResolvedValue('-\t-\timage.png'); // Binary file

      const result = await gitUtils.getChangedFiles();

      expect(result[0]?.isBinary).toBe(true);
    });

    it('should handle files with different statuses', async () => {
      const mockDiffSummary = {
        files: [
          { file: 'new-file.cs', insertions: 10, deletions: 0 },
          { file: 'deleted-file.cs', insertions: 0, deletions: 15 },
          { file: 'modified-file.cs', insertions: 5, deletions: 3 }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary);
      mockGit.diff.mockResolvedValue('mock diff');
      mockGit.raw.mockResolvedValue('5\t3\tfile.cs');

      const result = await gitUtils.getChangedFiles();

      expect(result[0]?.status).toBe('added');
      expect(result[1]?.status).toBe('deleted');
      expect(result[2]?.status).toBe('modified');
    });

    it('should continue processing when individual file fails', async () => {
      const mockDiffSummary = {
        files: [
          { file: 'good-file.cs', insertions: 5, deletions: 0 },
          { file: 'bad-file.cs', insertions: 3, deletions: 0 }
        ]
      };

      mockGit.diffSummary.mockResolvedValue(mockDiffSummary);
      mockGit.diff
        .mockResolvedValueOnce('good diff')
        .mockRejectedValueOnce(new Error('File access error'));
      mockGit.raw.mockResolvedValue('5\t0\tfile.cs');

      const result = await gitUtils.getChangedFiles();

      expect(result).toHaveLength(1);
      expect(result[0]?.path).toBe('good-file.cs');
    });
  });

  describe('validateRepository', () => {
    it('should validate repository successfully', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } }
      ]);

      await expect(gitUtils.validateRepository()).resolves.not.toThrow();
    });

    it('should throw error when not in git repository', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      await expect(gitUtils.validateRepository()).rejects.toThrow(
        'Repository validation failed: Not in a git repository'
      );
    });

    it('should throw error when no remotes configured', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.getRemotes.mockResolvedValue([]);

      await expect(gitUtils.validateRepository()).rejects.toThrow(
        'Repository validation failed: No git remotes configured'
      );
    });
  });

  describe('getCurrentBranchInfo', () => {
    it('should get current branch information', async () => {
      mockGit.status.mockResolvedValue({ current: 'feature-branch' });
      mockGit.branch.mockResolvedValue({
        all: ['main', 'feature-branch', 'remotes/origin/main']
      });

      const result = await gitUtils.getCurrentBranchInfo();

      expect(result).toEqual({
        current: 'feature-branch',
        all: ['main', 'feature-branch', 'remotes/origin/main']
      });
    });

    it('should handle unknown current branch', async () => {
      mockGit.status.mockResolvedValue({ current: null });
      mockGit.branch.mockResolvedValue({ all: ['main'] });

      const result = await gitUtils.getCurrentBranchInfo();

      expect(result.current).toBe('unknown');
    });
  });

  describe('combineFileDiffs', () => {
    it('should combine multiple file diffs', () => {
      const files: GitDiffFile[] = [
        {
          path: 'file1.cs',
          status: 'modified',
          diff: 'diff for file1',
          isBinary: false,
          size: 100
        },
        {
          path: 'file2.cs',
          status: 'added',
          diff: 'diff for file2',
          isBinary: false,
          size: 200
        }
      ];

      const result = gitUtils.combineFileDiffs(files);

      expect(result).toBe('diff for file1\n\ndiff for file2');
    });

    it('should filter out empty diffs', () => {
      const files: GitDiffFile[] = [
        {
          path: 'file1.cs',
          status: 'modified',
          diff: 'diff for file1',
          isBinary: false,
          size: 100
        },
        {
          path: 'file2.cs',
          status: 'added',
          diff: '',
          isBinary: false,
          size: 200
        }
      ];

      const result = gitUtils.combineFileDiffs(files);

      expect(result).toBe('diff for file1');
    });
  });

  describe('parseDiffForFiles', () => {
    it('should parse file paths from unified diff', () => {
      const unifiedDiff = `diff --git a/src/Program.cs b/src/Program.cs
index 1234567..abcdefg 100644
--- a/src/Program.cs
+++ b/src/Program.cs
@@ -1,3 +1,4 @@
 using System;

diff --git a/src/Utils.cs b/src/Utils.cs
index 7890123..cdefghi 100644
--- a/src/Utils.cs
+++ b/src/Utils.cs
@@ -1,2 +1,3 @@
 using System;`;

      const result = gitUtils.parseDiffForFiles(unifiedDiff);

      expect(result).toEqual(['src/Program.cs', 'src/Utils.cs']);
    });

    it('should handle diff with no file headers', () => {
      const unifiedDiff = 'Some random content without diff headers';

      const result = gitUtils.parseDiffForFiles(unifiedDiff);

      expect(result).toEqual([]);
    });
  });

  describe('estimateFileSize', () => {
    it('should estimate file size based on diff content', () => {
      const diff = 'a'.repeat(1000); // 1000 characters
      
      // Access private method for testing
      const estimateMethod = (gitUtils as any).estimateFileSize.bind(gitUtils);
      const result = estimateMethod(diff, 10, 5);

      expect(result).toBe(1000); // Should use diff size when available
    });

    it('should estimate based on line counts when diff is empty', () => {
      const estimateMethod = (gitUtils as any).estimateFileSize.bind(gitUtils);
      const result = estimateMethod('', 10, 5);

      expect(result).toBe(750); // (10 + 5) * 50 = 750
    });
  });
});
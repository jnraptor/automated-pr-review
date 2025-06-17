// Using Jest globals (describe, it, expect, beforeEach are available globally)
import { FileFilter } from '../src/file-filter.js';
import { GitDiffFile, FileFilterConfig } from '../src/types.js';

describe('FileFilter', () => {
  let fileFilter: FileFilter;
  let mockFiles: GitDiffFile[];

  beforeEach(() => {
    fileFilter = new FileFilter();
    
    mockFiles = [
      {
        path: 'src/Program.cs',
        status: 'modified',
        diff: 'mock diff content',
        isBinary: false,
        size: 1024
      },
      {
        path: 'src/Utils.designer.cs',
        status: 'modified',
        diff: 'mock diff content',
        isBinary: false,
        size: 512
      },
      {
        path: 'bin/Debug/app.exe',
        status: 'added',
        diff: '',
        isBinary: true,
        size: 2048
      },
      {
        path: 'package-lock.json',
        status: 'modified',
        diff: 'large diff content',
        isBinary: false,
        size: 600000 // 600KB - exceeds default limit
      },
      {
        path: 'src/Models/User.cs',
        status: 'added',
        diff: 'mock diff content',
        isBinary: false,
        size: 256
      },
      {
        path: 'deleted-file.cs',
        status: 'deleted',
        diff: '',
        isBinary: false,
        size: 100
      },
      {
        path: 'image.png',
        status: 'added',
        diff: '',
        isBinary: true,
        size: 1024
      }
    ];
  });

  describe('filterFiles', () => {
    it('should filter out binary files by default', () => {
      const filtered = fileFilter.filterFiles(mockFiles);
      const binaryFiles = filtered.filter(f => f.isBinary);
      expect(binaryFiles).toHaveLength(0);
    });

    it('should filter out files exceeding size limit', () => {
      const filtered = fileFilter.filterFiles(mockFiles);
      const largeFiles = filtered.filter(f => f.size > 500000);
      expect(largeFiles).toHaveLength(0);
    });

    it('should filter out deleted files', () => {
      const filtered = fileFilter.filterFiles(mockFiles);
      const deletedFiles = filtered.filter(f => f.status === 'deleted');
      expect(deletedFiles).toHaveLength(0);
    });

    it('should filter out files matching exclusion patterns', () => {
      const filtered = fileFilter.filterFiles(mockFiles);
      const designerFiles = filtered.filter(f => f.path.includes('.designer.cs'));
      expect(designerFiles).toHaveLength(0);
    });

    it('should include valid code files', () => {
      const filtered = fileFilter.filterFiles(mockFiles);
      const validFiles = filtered.filter(f => 
        f.path === 'src/Program.cs' || f.path === 'src/Models/User.cs'
      );
      expect(validFiles).toHaveLength(2);
    });

    it('should work with custom configuration', () => {
      const customConfig: FileFilterConfig = {
        excludePatterns: ['*.cs'], // Exclude all C# files
        maxFileSize: 1000000,
        includeBinary: false
      };
      
      const customFilter = new FileFilter(customConfig);
      const filtered = customFilter.filterFiles(mockFiles);
      const csFiles = filtered.filter(f => f.path.endsWith('.cs'));
      expect(csFiles).toHaveLength(0);
    });
  });

  describe('getFilterSummary', () => {
    it('should provide accurate filtering summary', () => {
      const filtered = fileFilter.filterFiles(mockFiles);
      const summary = fileFilter.getFilterSummary(mockFiles, filtered);
      
      expect(summary).toContain('Total files changed: 7');
      expect(summary).toContain('Files included for review: 2');
      expect(summary).toContain('Files excluded: 5');
    });
  });

  describe('validateFilteredFiles', () => {
    it('should pass validation when files remain after filtering', () => {
      const validFiles = mockFiles.filter(f => 
        f.path === 'src/Program.cs' || f.path === 'src/Models/User.cs'
      );
      
      expect(() => fileFilter.validateFilteredFiles(validFiles)).not.toThrow();
    });

    it('should throw error when no files remain after filtering', () => {
      expect(() => fileFilter.validateFilteredFiles([])).toThrow(
        'No files remain after filtering. Nothing to review.'
      );
    });
  });

  describe('getReviewableExtensions', () => {
    it('should return unique file extensions', () => {
      const validFiles = [
        { path: 'file1.cs', status: 'modified' as const, diff: '', isBinary: false, size: 100 },
        { path: 'file2.ts', status: 'modified' as const, diff: '', isBinary: false, size: 100 },
        { path: 'file3.cs', status: 'modified' as const, diff: '', isBinary: false, size: 100 }
      ];
      
      const extensions = fileFilter.getReviewableExtensions(validFiles);
      expect(extensions).toEqual(['cs', 'ts']);
    });

    it('should handle files without extensions', () => {
      const validFiles = [
        { path: 'Dockerfile', status: 'modified' as const, diff: '', isBinary: false, size: 100 },
        { path: 'README', status: 'modified' as const, diff: '', isBinary: false, size: 100 }
      ];
      
      const extensions = fileFilter.getReviewableExtensions(validFiles);
      expect(extensions).toEqual([]);
    });
  });
});
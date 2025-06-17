import { minimatch } from 'minimatch';
import { GitDiffFile, FileFilterConfig } from './types.js';
import { config } from './config.js';

export class FileFilter {
  private config: FileFilterConfig;

  constructor(filterConfig?: FileFilterConfig) {
    this.config = filterConfig || config.fileFilter;
  }

  /**
   * Filters files based on configured exclusion patterns and size limits
   */
  public filterFiles(files: GitDiffFile[]): GitDiffFile[] {
    return files.filter(file => this.shouldIncludeFile(file));
  }

  /**
   * Determines if a file should be included in the review
   */
  private shouldIncludeFile(file: GitDiffFile): boolean {
    // Skip binary files unless explicitly included
    if (file.isBinary && !this.config.includeBinary) {
      console.log(`Skipping binary file: ${file.path}`);
      return false;
    }

    // Skip files that are too large
    if (file.size > this.config.maxFileSize) {
      console.log(`Skipping large file (${file.size} bytes): ${file.path}`);
      return false;
    }

    // Skip deleted files (no content to review)
    if (file.status === 'deleted') {
      console.log(`Skipping deleted file: ${file.path}`);
      return false;
    }

    // Check against exclusion patterns
    if (this.isExcluded(file.path)) {
      console.log(`Skipping excluded file: ${file.path}`);
      return false;
    }

    return true;
  }

  /**
   * Checks if a file path matches any exclusion pattern
   */
  private isExcluded(filePath: string): boolean {
    return this.config.excludePatterns.some(pattern => {
      return minimatch(filePath, pattern, { 
        dot: true, 
        matchBase: true,
        nocase: true 
      });
    });
  }

  /**
   * Gets a summary of filtering results
   */
  public getFilterSummary(originalFiles: GitDiffFile[], filteredFiles: GitDiffFile[]): string {
    const excluded = originalFiles.length - filteredFiles.length;
    const summary = [
      `File filtering summary:`,
      `- Total files changed: ${originalFiles.length}`,
      `- Files included for review: ${filteredFiles.length}`,
      `- Files excluded: ${excluded}`
    ];

    if (excluded > 0) {
      const excludedByReason = this.categorizeExcludedFiles(originalFiles, filteredFiles);
      Object.entries(excludedByReason).forEach(([reason, count]) => {
        if (count > 0) {
          summary.push(`  - ${reason}: ${count}`);
        }
      });
    }

    return summary.join('\n');
  }

  /**
   * Categorizes excluded files by reason for reporting
   */
  private categorizeExcludedFiles(originalFiles: GitDiffFile[], filteredFiles: GitDiffFile[]): Record<string, number> {
    const included = new Set(filteredFiles.map(f => f.path));
    const excluded = originalFiles.filter(f => !included.has(f.path));
    
    const categories = {
      'Binary files': 0,
      'Large files': 0,
      'Deleted files': 0,
      'Pattern exclusions': 0
    };

    excluded.forEach(file => {
      if (file.isBinary && !this.config.includeBinary) {
        categories['Binary files']++;
      } else if (file.size > this.config.maxFileSize) {
        categories['Large files']++;
      } else if (file.status === 'deleted') {
        categories['Deleted files']++;
      } else if (this.isExcluded(file.path)) {
        categories['Pattern exclusions']++;
      }
    });

    return categories;
  }

  /**
   * Validates that we have files to review after filtering
   */
  public validateFilteredFiles(files: GitDiffFile[]): void {
    if (files.length === 0) {
      throw new Error('No files remain after filtering. Nothing to review.');
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    console.log(`Ready to review ${files.length} files (${Math.round(totalSize / 1024)}KB total)`);
  }

  /**
   * Gets the list of file extensions that will be reviewed
   */
  public getReviewableExtensions(files: GitDiffFile[]): string[] {
    const extensions = new Set<string>();
    
    files.forEach(file => {
      const ext = this.getFileExtension(file.path);
      if (ext) {
        extensions.add(ext);
      }
    });

    return Array.from(extensions).sort();
  }

  private getFileExtension(filePath: string): string | null {
    const match = filePath.match(/\.([^.]+)$/);
    return match ? match[1]!.toLowerCase() : null;
  }
}
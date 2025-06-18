import { simpleGit, SimpleGit, DiffResult } from 'simple-git';
import { GitDiffFile } from './types.js';
import { config } from './config.js';

export class GitUtils {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  /**
   * Generates a unified diff between target and source branches
   */
  public async generateUnifiedDiff(): Promise<string> {
    try {
      const { sourceBranch, targetBranch } = config.azureDevOps;
      
      console.log(`Generating diff between ${targetBranch} and ${sourceBranch}`);
      
      // Ensure we have the latest refs
      await this.git.fetch(['origin']);
      
      // For pull requests, we need to fetch the PR reference first
      if (sourceBranch.includes('refs/pull/')) {
        // Extract PR number from the ref
        const prMatch = sourceBranch.match(/refs\/pull\/(\d+)\/merge/);
        if (prMatch) {
          const prNumber = prMatch[1];
          console.log(`Fetching pull request ${prNumber} from origin`);
          
          // Fetch the pull request reference
          await this.git.fetch(['origin', `refs/pull/${prNumber}/merge:refs/remotes/origin/pull/${prNumber}/merge`]);
          
          // Use the fetched reference
          const diff = await this.git.diff([
            `origin/${targetBranch}...refs/remotes/origin/pull/${prNumber}/merge`,
            '--unified=3',
            '--no-color'
          ]);
          
          if (!diff || diff.trim().length === 0) {
            throw new Error('No differences found between branches');
          }
          
          console.log(`Generated diff: ${diff.length} characters`);
          return diff;
        }
      }
      
      // For regular branches, use the standard format
      const diff = await this.git.diff([
        `origin/${targetBranch}...origin/${sourceBranch}`,
        '--unified=3',
        '--no-color'
      ]);
      
      if (!diff || diff.trim().length === 0) {
        throw new Error('No differences found between branches');
      }
      
      console.log(`Generated diff: ${diff.length} characters`);
      return diff;
      
    } catch (error) {
      console.error('Error generating unified diff:', error);
      throw new Error(`Failed to generate diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets detailed information about changed files
   */
  public async getChangedFiles(): Promise<GitDiffFile[]> {
    try {
      const { sourceBranch, targetBranch } = config.azureDevOps;
      
      console.log(`Getting changed files between ${targetBranch} and ${sourceBranch}`);
      
      // Ensure we have the latest refs
      await this.git.fetch(['origin']);
      
      // For pull requests, we need to fetch the PR reference first
      let diffCommand: string[];
      
      if (sourceBranch.includes('refs/pull/')) {
        // Extract PR number from the ref
        const prMatch = sourceBranch.match(/refs\/pull\/(\d+)\/merge/);
        if (prMatch) {
          const prNumber = prMatch[1];
          console.log(`Fetching pull request ${prNumber} from origin`);
          
          // Fetch the pull request reference
          await this.git.fetch(['origin', `refs/pull/${prNumber}/merge:refs/remotes/origin/pull/${prNumber}/merge`]);
          
          // Use the fetched reference
          diffCommand = [
            `origin/${targetBranch}...refs/remotes/origin/pull/${prNumber}/merge`
          ];
        } else {
          throw new Error(`Invalid pull request reference format: ${sourceBranch}`);
        }
      } else {
        // For regular branches, use the standard format
        diffCommand = [
          `origin/${targetBranch}...origin/${sourceBranch}`
        ];
      }
      
      // Get diff summary
      const diffSummary = await this.git.diffSummary(diffCommand);
      
      const files: GitDiffFile[] = [];
      
      for (const file of diffSummary.files) {
        try {
          // Get individual file diff with the same command format
          const fileDiffCommand = [
            ...diffCommand,
            '--unified=3',
            '--no-color',
            '--',
            file.file
          ];
          
          const fileDiff = await this.git.diff(fileDiffCommand);
          
          // Determine file status and get insertions/deletions safely
          let status: GitDiffFile['status'] = 'modified';
          let insertions = 0;
          let deletions = 0;
          
          // Type guard to check if file has insertions/deletions properties
          if ('insertions' in file && 'deletions' in file) {
            insertions = file.insertions;
            deletions = file.deletions;
            
            if (insertions > 0 && deletions === 0) {
              status = 'added';
            } else if (insertions === 0 && deletions > 0) {
              status = 'deleted';
            }
          }
          
          // Check if file is binary
          const isBinary = await this.isFileBinary(file.file);
          
          // Estimate file size (rough approximation)
          const size = this.estimateFileSize(fileDiff, insertions, deletions);
          
          files.push({
            path: file.file,
            oldPath: file.file, // simple-git doesn't provide old path for renames easily
            status,
            diff: fileDiff,
            isBinary,
            size
          });
          
        } catch (fileError) {
          console.warn(`Error processing file ${file.file}:`, fileError);
          // Continue with other files
        }
      }
      
      console.log(`Found ${files.length} changed files`);
      return files;
      
    } catch (error) {
      console.error('Error getting changed files:', error);
      throw new Error(`Failed to get changed files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if a file is binary
   */
  private async isFileBinary(filePath: string): Promise<boolean> {
    try {
      // Use git to check if file is binary
      const result = await this.git.raw(['diff', '--numstat', 'HEAD~1', 'HEAD', '--', filePath]);
      
      // Binary files show as "-	-	filename" in numstat
      return result.includes('-\t-\t');
    } catch {
      // If we can't determine, assume it's not binary
      return false;
    }
  }

  /**
   * Estimates file size based on diff content
   */
  private estimateFileSize(diff: string, insertions: number, deletions: number): number {
    // Rough estimation based on diff length and line counts
    const diffSize = Buffer.byteLength(diff, 'utf8');
    
    // If we have a meaningful diff, use that as base
    if (diffSize > 0) {
      return diffSize;
    }
    
    // Otherwise estimate based on line counts (average 50 chars per line)
    return (insertions + deletions) * 50;
  }

  /**
   * Validates git repository state
   */
  public async validateRepository(): Promise<void> {
    try {
      // Check if we're in a git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not in a git repository');
      }
      
      // Check if we can access the remote
      const remotes = await this.git.getRemotes(true);
      if (remotes.length === 0) {
        throw new Error('No git remotes configured');
      }
      
      console.log('Git repository validation passed');
      
    } catch (error) {
      console.error('Git repository validation failed:', error);
      throw new Error(`Repository validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets current branch information
   */
  public async getCurrentBranchInfo(): Promise<{ current: string; all: string[] }> {
    try {
      const status = await this.git.status();
      const branches = await this.git.branch(['-a']);
      
      return {
        current: status.current || 'unknown',
        all: branches.all
      };
    } catch (error) {
      console.error('Error getting branch info:', error);
      throw new Error(`Failed to get branch info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Combines individual file diffs into a single unified diff
   */
  public combineFileDiffs(files: GitDiffFile[]): string {
    const combinedDiff = files
      .filter(file => file.diff && file.diff.trim().length > 0)
      .map(file => file.diff)
      .join('\n\n');
    
    return combinedDiff;
  }

  /**
   * Parses a unified diff to extract file paths and changes
   */
  public parseDiffForFiles(unifiedDiff: string): string[] {
    const fileHeaders = unifiedDiff.match(/^diff --git a\/.+ b\/.+$/gm) || [];
    return fileHeaders.map(header => {
      const match = header.match(/^diff --git a\/(.+) b\/(.+)$/);
      return match ? match[2] || match[1] : '';
    }).filter((path): path is string => path !== undefined && path.length > 0);
  }
}

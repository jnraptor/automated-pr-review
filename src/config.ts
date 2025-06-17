import { AzureDevOpsConfig, FileFilterConfig, ReviewConfig } from './types.js';

export class Config {
  private static instance: Config;
  
  public readonly azureDevOps: AzureDevOpsConfig;
  public readonly fileFilter: FileFilterConfig;
  public readonly review: ReviewConfig;

  private constructor() {
    // Azure DevOps configuration from environment variables
    this.azureDevOps = {
      accessToken: this.getRequiredEnv('SYSTEM_ACCESSTOKEN'),
      collectionUri: this.getRequiredEnv('COLLECTION_URI'),
      teamProject: this.getRequiredEnv('TEAM_PROJECT'),
      repositoryName: this.getRequiredEnv('REPO_NAME'),
      pullRequestId: this.getRequiredEnv('PR_ID'),
      sourceBranch: this.extractBranchName(this.getRequiredEnv('BUILD_SOURCEBRANCH')),
      targetBranch: this.extractBranchName(this.getRequiredEnv('SYSTEM_PULLREQUEST_TARGETBRANCH'))
    };

    // File filtering configuration
    this.fileFilter = {
      excludePatterns: [
        // Generated files
        '*.designer.cs',
        '*.g.cs',
        '*.g.i.cs',
        '*.AssemblyInfo.cs',
        
        // Minified files
        '*.min.js',
        '*.min.css',
        
        // Build artifacts
        'bin/**',
        'obj/**',
        'node_modules/**',
        'packages/**',
        
        // Version control
        '.git/**',
        '.vs/**',
        '.vscode/**',
        
        // Package files
        'package-lock.json',
        'yarn.lock',
        '*.nupkg',
        
        // Documentation that doesn't need review
        '*.md',
        '*.txt',
        
        // Configuration files that are usually auto-generated
        '*.config',
        '*.settings',
        
        // Image and media files
        '*.png',
        '*.jpg',
        '*.jpeg',
        '*.gif',
        '*.svg',
        '*.ico',
        '*.pdf',
        '*.mp4',
        '*.mp3',
        '*.wav'
      ],
      maxFileSize: 500 * 1024, // 500KB
      includeBinary: false
    };

    // Review configuration
    this.review = {
      maxTurns: 1,
      timeoutMs: 60000, // 60 seconds
      retryAttempts: 3,
      retryDelayMs: 1000 // 1 second base delay
    };
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  private extractBranchName(refName: string): string {
    // Extract branch name from refs/heads/branch-name format
    if (refName.startsWith('refs/heads/')) {
      return refName.substring('refs/heads/'.length);
    }
    return refName;
  }

  public getAzureDevOpsApiUrl(): string {
    return `${this.azureDevOps.collectionUri}/${this.azureDevOps.teamProject}/_apis`;
  }

  public getRepositoryId(): string {
    return this.azureDevOps.repositoryName;
  }

  public getPullRequestId(): number {
    return parseInt(this.azureDevOps.pullRequestId, 10);
  }

  public logConfiguration(): void {
    console.log('Configuration loaded:');
    console.log(`- Collection URI: ${this.azureDevOps.collectionUri}`);
    console.log(`- Team Project: ${this.azureDevOps.teamProject}`);
    console.log(`- Repository: ${this.azureDevOps.repositoryName}`);
    console.log(`- PR ID: ${this.azureDevOps.pullRequestId}`);
    console.log(`- Source Branch: ${this.azureDevOps.sourceBranch}`);
    console.log(`- Target Branch: ${this.azureDevOps.targetBranch}`);
    console.log(`- Max File Size: ${this.fileFilter.maxFileSize} bytes`);
    console.log(`- Exclude Patterns: ${this.fileFilter.excludePatterns.length} patterns`);
  }
}

export const config = Config.getInstance();
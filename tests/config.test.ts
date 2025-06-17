// Using Jest globals (describe, it, expect, beforeEach, afterEach, jest are available globally)
import { Config } from '../src/config.js';

describe('Config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear any existing config instance
    (Config as any).instance = undefined;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clear config instance
    (Config as any).instance = undefined;
  });

  describe('getInstance', () => {
    it('should create singleton instance', () => {
      const instance1 = Config.getInstance();
      const instance2 = Config.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('constructor', () => {
    it('should initialize with all required environment variables', () => {
      const config = Config.getInstance();
      
      expect(config.azureDevOps.accessToken).toBe('mock-token');
      expect(config.azureDevOps.collectionUri).toBe('https://dev.azure.com/mock-org');
      expect(config.azureDevOps.teamProject).toBe('mock-project');
      expect(config.azureDevOps.repositoryName).toBe('mock-repo');
      expect(config.azureDevOps.pullRequestId).toBe('123');
      expect(config.azureDevOps.sourceBranch).toBe('feature-branch');
      expect(config.azureDevOps.targetBranch).toBe('main');
    });

    it('should throw error for missing required environment variable', () => {
      delete process.env.SYSTEM_ACCESSTOKEN;
      
      expect(() => Config.getInstance()).toThrow(
        'Required environment variable SYSTEM_ACCESSTOKEN is not set'
      );
    });

    it('should extract branch names from refs format', () => {
      process.env.BUILD_SOURCEBRANCH = 'refs/heads/feature/new-feature';
      process.env.SYSTEM_PULLREQUEST_TARGETBRANCH = 'refs/heads/develop';
      
      const config = Config.getInstance();
      
      expect(config.azureDevOps.sourceBranch).toBe('feature/new-feature');
      expect(config.azureDevOps.targetBranch).toBe('develop');
    });

    it('should handle branch names without refs prefix', () => {
      process.env.BUILD_SOURCEBRANCH = 'feature-branch';
      process.env.SYSTEM_PULLREQUEST_TARGETBRANCH = 'main';
      
      const config = Config.getInstance();
      
      expect(config.azureDevOps.sourceBranch).toBe('feature-branch');
      expect(config.azureDevOps.targetBranch).toBe('main');
    });
  });

  describe('fileFilter configuration', () => {
    it('should have correct default exclusion patterns', () => {
      const config = Config.getInstance();
      
      expect(config.fileFilter.excludePatterns).toContain('*.designer.cs');
      expect(config.fileFilter.excludePatterns).toContain('*.g.cs');
      expect(config.fileFilter.excludePatterns).toContain('*.min.js');
      expect(config.fileFilter.excludePatterns).toContain('bin/**');
      expect(config.fileFilter.excludePatterns).toContain('node_modules/**');
    });

    it('should have correct default file size limit', () => {
      const config = Config.getInstance();
      
      expect(config.fileFilter.maxFileSize).toBe(500 * 1024); // 500KB
    });

    it('should not include binary files by default', () => {
      const config = Config.getInstance();
      
      expect(config.fileFilter.includeBinary).toBe(false);
    });
  });

  describe('review configuration', () => {
    it('should have correct default review settings', () => {
      const config = Config.getInstance();
      
      expect(config.review.maxTurns).toBe(1);
      expect(config.review.timeoutMs).toBe(60000);
      expect(config.review.retryAttempts).toBe(3);
      expect(config.review.retryDelayMs).toBe(1000);
    });
  });

  describe('getAzureDevOpsApiUrl', () => {
    it('should construct correct API URL', () => {
      const config = Config.getInstance();
      const apiUrl = config.getAzureDevOpsApiUrl();
      
      expect(apiUrl).toBe('https://dev.azure.com/mock-org/mock-project/_apis');
    });
  });

  describe('getRepositoryId', () => {
    it('should return repository name as ID', () => {
      const config = Config.getInstance();
      const repoId = config.getRepositoryId();
      
      expect(repoId).toBe('mock-repo');
    });
  });

  describe('getPullRequestId', () => {
    it('should return PR ID as number', () => {
      const config = Config.getInstance();
      const prId = config.getPullRequestId();
      
      expect(prId).toBe(123);
    });

    it('should handle string PR ID', () => {
      process.env.PR_ID = '456';
      
      const config = Config.getInstance();
      const prId = config.getPullRequestId();
      
      expect(prId).toBe(456);
    });
  });

  describe('logConfiguration', () => {
    it('should log configuration without throwing', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const config = Config.getInstance();
      
      expect(() => config.logConfiguration()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});
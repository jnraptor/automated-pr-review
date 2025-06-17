// Test setup file

// Mock environment variables for testing
process.env.SYSTEM_ACCESSTOKEN = 'mock-token';
process.env.COLLECTION_URI = 'https://dev.azure.com/mock-org';
process.env.TEAM_PROJECT = 'mock-project';
process.env.REPO_NAME = 'mock-repo';
process.env.PR_ID = '123';
process.env.BUILD_SOURCEBRANCH = 'refs/heads/feature-branch';
process.env.SYSTEM_PULLREQUEST_TARGETBRANCH = 'refs/heads/main';

// Mock console methods to reduce noise in tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
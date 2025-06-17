# Test Suite for Automated PR Review

This directory contains comprehensive test cases for the automated PR review system.

## Test Structure

### Unit Tests

#### `file-filter.test.ts`
- Tests file filtering logic
- Validates exclusion patterns (generated files, binaries, large files)
- Tests custom configuration handling
- Verifies filtering summary and statistics

#### `claude-reviewer.test.ts`
- Tests Claude AI integration
- Validates JSON response parsing
- Tests error handling and retry logic
- Verifies review statistics calculation

#### `azure-devops.test.ts`
- Tests Azure DevOps API client
- Validates PR information retrieval
- Tests comment posting functionality
- Verifies connection validation

#### `git-utils.test.ts`
- Tests git operations (diff generation, file detection)
- Validates repository validation
- Tests branch information retrieval
- Verifies file size estimation

#### `config.test.ts`
- Tests configuration management
- Validates environment variable handling
- Tests singleton pattern implementation
- Verifies API URL construction

### Integration Tests

#### `automated-review.test.ts`
- Tests complete review workflow
- Validates error handling across components
- Tests component integration
- Verifies end-to-end process

## Test Coverage

The test suite covers:

- ✅ **File Filtering**: Pattern matching, size limits, binary detection
- ✅ **AI Integration**: Claude API calls, response parsing, error handling
- ✅ **Azure DevOps API**: Authentication, PR operations, comment posting
- ✅ **Git Operations**: Diff generation, repository validation, file detection
- ✅ **Configuration**: Environment setup, validation, URL construction
- ✅ **Integration**: Complete workflow, error scenarios, component interaction

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- file-filter.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should filter"
```

## Test Data

Tests use mock data to simulate:
- Git repository states
- Azure DevOps API responses
- Claude AI responses
- File system operations
- Environment variables

## Mocking Strategy

- **External APIs**: Mocked to avoid network calls
- **File System**: Mocked for consistent test environment
- **Environment Variables**: Set in test setup
- **Console Output**: Mocked to reduce test noise

## Coverage Goals

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

## Test Environment

Tests run with:
- Node.js environment
- Mocked Azure DevOps environment variables
- Isolated module imports
- Clean state between tests

## Adding New Tests

When adding new functionality:

1. Create unit tests for individual components
2. Add integration tests for component interactions
3. Mock external dependencies appropriately
4. Verify error handling scenarios
5. Update this documentation

## Debugging Tests

For debugging failed tests:

```bash
# Run with verbose output
npm test -- --verbose

# Run single test with debugging
npm test -- --testNamePattern="specific test" --verbose

# Check coverage report
npm run test:coverage
open coverage/lcov-report/index.html
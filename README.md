# Automated PR Review for Azure DevOps

[![codecov](https://codecov.io/gh/jnraptor/automated-pr-review/graph/badge.svg?token=5KAOG6FW4N)](https://codecov.io/gh/jnraptor/automated-pr-review)

This project provides an automated code review system for Azure DevOps pull requests using Claude AI. It integrates with Azure DevOps pipelines to automatically review code changes and post feedback as PR comments.

## Features

- 🤖 **AI-Powered Reviews**: Uses Claude AI to analyze code changes and provide intelligent feedback
- 🔍 **Smart Filtering**: Automatically excludes generated files, binaries, and large files
- 💬 **Duplicate Prevention**: Checks existing comments to avoid posting duplicates
- 📊 **Comprehensive Reporting**: Provides detailed summaries of the review process
- 🔄 **Retry Logic**: Robust error handling with automatic retries
- 🛡️ **Security**: Uses Azure DevOps system tokens with no hardcoded credentials

## Architecture

```
Azure DevOps Pipeline → Git Diff → File Filtering → Claude AI Review → Post Comments
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Configure Azure DevOps Pipeline

Add the provided `pr-review.yaml` to your Azure DevOps repository. The pipeline will:

1. Build your .NET solution
2. Run tests
3. Execute the automated code review
4. Post feedback to the PR

### 4. Environment Variables

The script requires these environment variables (automatically provided by Azure DevOps):

- `SYSTEM_ACCESSTOKEN`: Azure DevOps access token
- `COLLECTION_URI`: Azure DevOps collection URI
- `TEAM_PROJECT`: Team project name
- `REPO_NAME`: Repository name
- `PR_ID`: Pull request ID
- `BUILD_SOURCEBRANCH`: Source branch name
- `SYSTEM_PULLREQUEST_TARGETBRANCH`: Target branch name

## Usage

### In Azure DevOps Pipeline

The script runs automatically when triggered by the pipeline:

```yaml
- script: |
    node tools/automated-review.js
  displayName: 'Run Automated Code Review and Post PR Comment'
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
    COLLECTION_URI: $(System.CollectionUri)
    TEAM_PROJECT: $(System.TeamProject)
    REPO_NAME: $(Build.Repository.Name)
    PR_ID: $(System.PullRequest.PullRequestId)
```

### Local Testing

For local testing, you can set the environment variables manually:

```bash
export SYSTEM_ACCESSTOKEN="your-token"
export COLLECTION_URI="https://dev.azure.com/your-org"
export TEAM_PROJECT="your-project"
export REPO_NAME="your-repo"
export PR_ID="123"
export BUILD_SOURCEBRANCH="refs/heads/feature-branch"
export SYSTEM_PULLREQUEST_TARGETBRANCH="refs/heads/main"

node tools/automated-review.js
```

## Configuration

### File Filtering

The system automatically excludes:

- Generated files (`*.designer.cs`, `*.g.cs`)
- Minified files (`*.min.js`, `*.min.css`)
- Build artifacts (`bin/**`, `obj/**`)
- Package files (`node_modules/**`, `package-lock.json`)
- Binary files (images, executables)
- Files larger than 500KB

### Review Settings

- **Max file size**: 500KB
- **Retry attempts**: 3
- **Timeout**: 60 seconds
- **Max turns**: 1 (single review pass)

## Project Structure

```
automated-pr-review/
├── src/                    # TypeScript source files
│   ├── automated-review.ts # Main orchestrator
│   ├── azure-devops.ts     # Azure DevOps API client
│   ├── claude-reviewer.ts  # Claude AI integration
│   ├── config.ts           # Configuration management
│   ├── file-filter.ts      # File filtering logic
│   ├── git-utils.ts        # Git operations
│   └── types.ts            # TypeScript interfaces
├── tools/                  # Compiled JavaScript files
├── pr-review.yaml          # Azure DevOps pipeline
├── prompt.txt              # Claude review prompt
└── package.json            # Dependencies and scripts
```

## Review Process

1. **Environment Validation**: Checks git repository and Azure DevOps connection
2. **Change Detection**: Gets changed files and generates unified diff
3. **File Filtering**: Excludes irrelevant files based on patterns and size
4. **Existing Comments**: Retrieves current PR comments to avoid duplicates
5. **AI Review**: Sends changes to Claude for analysis
6. **Comment Posting**: Posts review feedback as PR comments
7. **Summary**: Provides completion summary with statistics

## Review Criteria

The AI reviewer focuses on:

- 🐛 **Bugs**: Identifies potential bugs and logic errors
- ⚡ **Performance**: Highlights major performance issues
- 📋 **Best Practices**: Suggests improvements for code quality
- 🔒 **Security**: Identifies potential security vulnerabilities

The reviewer avoids:
- Minor style issues and nitpicks
- Comments on unmodified lines
- Duplicate feedback

## Error Handling

- Automatic retries for transient failures
- Graceful degradation when services are unavailable
- Error comments posted to PR when review fails
- Comprehensive logging for debugging

## Troubleshooting

### Common Issues

1. **No files to review**: All files were filtered out
   - Check file patterns and sizes
   - Verify meaningful changes exist

2. **Azure DevOps connection failed**: 
   - Verify system token permissions
   - Check organization and project names

3. **Claude API errors**:
   - Check API key configuration
   - Verify network connectivity
   - Review rate limiting

### Debug Mode

Enable verbose logging by checking the Azure DevOps build logs for detailed execution information.

## Contributing

1. Make changes to TypeScript files in `src/`
2. Build with `npm run build`
3. Test locally with environment variables
4. Submit PR for review

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the build logs for detailed error information
2. Review the troubleshooting section
3. Contact the development team
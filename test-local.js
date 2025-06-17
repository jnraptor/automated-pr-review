#!/usr/bin/env node

/**
 * Local testing script for the automated PR review system
 * This script helps test the system locally with mock data
 */

import { config } from './tools/config.js';
import { GitUtils } from './tools/git-utils.js';
import { FileFilter } from './tools/file-filter.js';

async function testLocalSetup() {
  console.log('🧪 Testing Local Setup');
  console.log('=====================');

  try {
    // Test 1: Check if all required environment variables are set
    console.log('\n1. Checking environment variables...');
    
    const requiredEnvVars = [
      'SYSTEM_ACCESSTOKEN',
      'COLLECTION_URI', 
      'TEAM_PROJECT',
      'REPO_NAME',
      'PR_ID',
      'BUILD_SOURCEBRANCH',
      'SYSTEM_PULLREQUEST_TARGETBRANCH'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log('❌ Missing environment variables:');
      missingVars.forEach(varName => console.log(`   - ${varName}`));
      console.log('\nTo test locally, set these variables:');
      console.log('export SYSTEM_ACCESSTOKEN="your-ado-token"');
      console.log('export COLLECTION_URI="https://dev.azure.com/your-org"');
      console.log('export TEAM_PROJECT="your-project"');
      console.log('export REPO_NAME="your-repo"');
      console.log('export PR_ID="123"');
      console.log('export BUILD_SOURCEBRANCH="refs/heads/feature-branch"');
      console.log('export SYSTEM_PULLREQUEST_TARGETBRANCH="refs/heads/main"');
      return;
    }

    console.log('✅ All environment variables are set');

    // Test 2: Initialize configuration
    console.log('\n2. Testing configuration...');
    config.logConfiguration();
    console.log('✅ Configuration loaded successfully');

    // Test 3: Test git repository
    console.log('\n3. Testing git repository...');
    const gitUtils = new GitUtils();
    await gitUtils.validateRepository();
    
    const branchInfo = await gitUtils.getCurrentBranchInfo();
    console.log(`Current branch: ${branchInfo.current}`);
    console.log(`Available branches: ${branchInfo.all.length}`);
    console.log('✅ Git repository validation passed');

    // Test 4: Test file filtering
    console.log('\n4. Testing file filtering...');
    const fileFilter = new FileFilter();
    
    // Mock some test files
    const mockFiles = [
      { path: 'src/Program.cs', status: 'modified', diff: 'mock diff', isBinary: false, size: 1024 },
      { path: 'bin/Debug/app.exe', status: 'added', diff: '', isBinary: true, size: 2048 },
      { path: 'package-lock.json', status: 'modified', diff: 'mock diff', isBinary: false, size: 50000 },
      { path: 'src/Utils.cs', status: 'modified', diff: 'mock diff', isBinary: false, size: 512 }
    ];

    const filteredFiles = fileFilter.filterFiles(mockFiles);
    const summary = fileFilter.getFilterSummary(mockFiles, filteredFiles);
    console.log(summary);
    console.log('✅ File filtering test passed');

    // Test 5: Test prompt loading
    console.log('\n5. Testing prompt template...');
    try {
      const fs = await import('fs/promises');
      const promptContent = await fs.readFile('prompt.txt', 'utf-8');
      console.log(`Prompt template loaded: ${promptContent.length} characters`);
      console.log('✅ Prompt template loaded successfully');
    } catch (error) {
      console.log('❌ Could not load prompt template:', error.message);
    }

    console.log('\n🎉 Local setup test completed successfully!');
    console.log('\nTo run the full review process:');
    console.log('node tools/automated-review.js');

  } catch (error) {
    console.error('\n❌ Local setup test failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testLocalSetup().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testLocalSetup };
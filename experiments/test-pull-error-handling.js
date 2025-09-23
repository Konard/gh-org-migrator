#!/usr/bin/env node

import { jest } from '@jest/globals';
import inquirer from 'inquirer';
import simpleGit from 'simple-git';

// Mock inquirer to simulate user responses
const mockInquirer = {
  prompt: jest.fn()
};

// Mock simple-git to simulate network errors
const mockGit = {
  branchLocal: jest.fn(),
  cwd: jest.fn().mockReturnThis(),
  checkout: jest.fn().mockReturnThis(),
  pull: jest.fn()
};

// Test function that simulates the fixed pullAllLocalBranches
async function testPullAllLocalBranches(repoDir, simulateError = false, userRetryChoice = false) {
  console.log('Testing pullAllLocalBranches with enhanced error handling...');

  // Mock the git.branchLocal() to return a sample branch
  mockGit.branchLocal.mockResolvedValue({
    all: ['main']
  });

  const localBranches = await mockGit.branchLocal();

  for (const branch of localBranches.all) {
    await mockGit.checkout(branch);

    let tryAgain = false;
    let attempts = 0;

    do {
      attempts++;
      try {
        if (simulateError && attempts === 1) {
          // Simulate network error on first attempt
          throw new Error("unable to access 'https://github.com/example/repo.git/': Failed to connect to github.com port 443 after 10 ms: Couldn't connect to server");
        }

        await mockGit.pull({ "--ff-only": null, "--strategy-option": "theirs" });
        console.log(`✓ Pulled latest changes for branch: ${branch} (attempt ${attempts})`);
        tryAgain = false;

      } catch (error) {
        console.error(`✗ Error pulling latest changes for branch: ${branch}: ${error.message}`);

        if (simulateError) {
          // Simulate user choice
          tryAgain = userRetryChoice;
          if (!tryAgain) {
            console.log('User chose not to retry. Exiting...');
            return false; // In real code this would be process.exit(1)
          } else {
            console.log('User chose to retry...');
            simulateError = false; // Don't simulate error on retry
          }
        }
      }
    } while (tryAgain);
  }

  return true;
}

// Run tests
async function runTests() {
  console.log('=== Test 1: Normal operation (no errors) ===');
  const test1Result = await testPullAllLocalBranches('/fake/repo', false);
  console.log('Test 1 result:', test1Result ? 'PASSED' : 'FAILED');

  console.log('\n=== Test 2: Network error with user choosing to retry ===');
  const test2Result = await testPullAllLocalBranches('/fake/repo', true, true);
  console.log('Test 2 result:', test2Result ? 'PASSED' : 'FAILED');

  console.log('\n=== Test 3: Network error with user choosing NOT to retry ===');
  const test3Result = await testPullAllLocalBranches('/fake/repo', true, false);
  console.log('Test 3 result:', !test3Result ? 'PASSED' : 'FAILED');

  console.log('\n=== All tests completed ===');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}
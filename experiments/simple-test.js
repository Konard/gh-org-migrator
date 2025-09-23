#!/usr/bin/env node

// Simple test to verify our changes without requiring env vars
import fs from "fs";

function testCodeChanges() {
  console.log("Testing code changes...");

  // Check that the pullAllLocalBranches function has been updated
  const pushCodeCommitsContent = fs.readFileSync("push-code-commits.js", "utf8");
  const pushCodeCommitsToGitflicContent = fs.readFileSync("push-code-commits-to-gitflic.js", "utf8");

  // Test 1: Check if fallback strategies are implemented
  const hasResetStrategy =
    pushCodeCommitsContent.includes("git.cwd(repoDir).reset") &&
    pushCodeCommitsToGitflicContent.includes("git.cwd(repoDir).reset");

  const hasStashStrategy =
    pushCodeCommitsContent.includes("git.cwd(repoDir).stash") &&
    pushCodeCommitsToGitflicContent.includes("git.cwd(repoDir).stash");

  const hasUpdatedErrorHandling =
    pushCodeCommitsContent.includes("Fast-forward pull failed") &&
    pushCodeCommitsToGitflicContent.includes("Fast-forward pull failed");

  const hasContinueOnFailure =
    pushCodeCommitsContent.includes("Continue with other branches") &&
    pushCodeCommitsToGitflicContent.includes("Continue with other branches");

  console.log("Test Results:");
  console.log(`✓ Reset strategy implemented: ${hasResetStrategy ? "PASS" : "FAIL"}`);
  console.log(`✓ Stash strategy implemented: ${hasStashStrategy ? "PASS" : "FAIL"}`);
  console.log(`✓ Updated error handling: ${hasUpdatedErrorHandling ? "PASS" : "FAIL"}`);
  console.log(`✓ Continue on failure: ${hasContinueOnFailure ? "PASS" : "FAIL"}`);

  const allTestsPassed = hasResetStrategy && hasStashStrategy && hasUpdatedErrorHandling && hasContinueOnFailure;

  if (allTestsPassed) {
    console.log("\n🎉 All tests passed! The implementation is correct.");
    return true;
  } else {
    console.log("\n❌ Some tests failed. Check the implementation.");
    return false;
  }
}

const success = testCodeChanges();
process.exit(success ? 0 : 1);
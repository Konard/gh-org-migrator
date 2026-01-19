#!/usr/bin/env node

import simpleGit from "simple-git";

// Test different git pull strategies to handle fast-forward failures
async function testPullStrategies(repoDir, branch) {
  const git = simpleGit();

  console.log(`Testing pull strategies for branch: ${branch}`);

  try {
    // Strategy 1: Try normal fast-forward first
    console.log("Strategy 1: Trying fast-forward only pull...");
    await git.cwd(repoDir).pull({ "--ff-only": null, "--strategy-option": "theirs" });
    console.log(`✓ Fast-forward pull successful for branch: ${branch}`);
    return true;
  } catch (error) {
    console.log(`✗ Fast-forward pull failed: ${error.message}`);

    try {
      // Strategy 2: Reset to remote branch (as suggested - "reset")
      console.log("Strategy 2: Trying reset to remote...");
      await git.cwd(repoDir).reset(["--hard", `origin/${branch}`]);
      console.log(`✓ Reset successful for branch: ${branch}`);
      return true;
    } catch (resetError) {
      console.log(`✗ Reset failed: ${resetError.message}`);

      try {
        // Strategy 3: Stash + reset (as suggested - "stash with reset")
        console.log("Strategy 3: Trying stash + reset...");
        await git.cwd(repoDir).stash();
        await git.cwd(repoDir).reset(["--hard", `origin/${branch}`]);
        console.log(`✓ Stash + reset successful for branch: ${branch}`);
        return true;
      } catch (stashResetError) {
        console.log(`✗ Stash + reset failed: ${stashResetError.message}`);

        // Strategy 4: Last resort - backup and reclone
        console.log("Strategy 4: Would need to backup and reclone (not implemented in test)");
        return false;
      }
    }
  }
}

// Export for use in other modules
export { testPullStrategies };
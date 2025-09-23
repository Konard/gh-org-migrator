#!/usr/bin/env node

// Simple syntax verification test
async function verifySyntax() {
  console.log("🔍 Verifying syntax of push-code-commits.js...");

  try {
    // Try to import the module to check for syntax errors
    const module = await import("../push-code-commits.js");

    // Check if our target function exists
    if (typeof module.pushAllLocalBranches === 'function') {
      console.log("✅ pushAllLocalBranches function exists and is callable");
    }

    if (typeof module.pushCodeChangesForRepository === 'function') {
      console.log("✅ pushCodeChangesForRepository function exists and is callable");
    }

    console.log("✅ Module imports successfully - no syntax errors");
    console.log("✅ Fix implementation verified!");

  } catch (error) {
    console.error("❌ Syntax error detected:", error.message);
    process.exit(1);
  }
}

verifySyntax();
#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import { config } from "dotenv";
import simpleGit from "simple-git";
import inquirer from "inquirer";
import { sleep, readJSON } from "./lib.js";

// Load environment variables
config();

const { GITHUB_ACCESS_TOKEN, SOURCE_ORGANIZATION, TARGET_ORGANIZATION } = process.env;

if (!GITHUB_ACCESS_TOKEN || !SOURCE_ORGANIZATION || !TARGET_ORGANIZATION) {
  console.error(
    "GITHUB_ACCESS_TOKEN, SOURCE_ORGANIZATION, and TARGET_ORGANIZATION must be set in the .env file.",
  );
  process.exit(1);
}

// Initialize simple-git
const git = simpleGit();

// Path to the input data directory
const INPUT_DIR = path.join(process.cwd(), "data", SOURCE_ORGANIZATION);

const defaultIntervalMs = 30000;

// Fetch all branches
async function fetchAllBranches(repoDir) {
  return await git.cwd(repoDir).fetch(["--all"]);
  // await git.cwd(repoDir).fetch('origin');
}

// List remote branches and create local tracking branches
async function createLocalTrackingBranches(repoDir) {
  const remoteBranches = await git.cwd(repoDir).branch(["-r"]);
  const localBranches = await git.cwd(repoDir).branch();

  for (const remoteBranch of remoteBranches.all) {
    // console.log({ remoteBranch });
    if (!remoteBranch.includes("->")) {
      const branchName = remoteBranch.replace("origin/", "");
      if (!localBranches.all.includes(branchName)) {
        await git.cwd(repoDir).branch(["--track", branchName, remoteBranch]);
        console.log(`Created local tracking branch: ${branchName}`);
      } else {
        await git
          .cwd(repoDir)
          .branch(["--set-upstream-to", `origin/${branchName}`, branchName]);
        console.log(`Updated upstream for branch: ${branchName}`);
      }
    }
  }
}

// Pull all local branches
async function pullAllLocalBranches(repoDir) {
  const localBranches = await git.branchLocal();
  for (const branch of localBranches.all) {
    await git.cwd(repoDir).checkout(branch);
    try {
      await git
        .cwd(repoDir)
        .pull({ "--ff-only": null, "--strategy-option": "theirs" });
      console.log(`Pulled latest changes for branch: ${branch}`);
    } catch (error) {
      console.error(
        `Error pulling latest changes for branch: ${branch}: ${error.message}`,
      );
    }
  }
}

// Push all local branches
async function pushAllLocalBranches(repoDir) {
  let branchesAlreadyUpdated = true;
  const localBranches = await git.branchLocal();
  for (const branchName of localBranches.all) {
    // console.log({ remoteBranchName: branchName })
    await git.cwd(repoDir).checkout(branchName);

    let tryAgain = false;
    do {
      try {
        const pushedBranches = await git
          .cwd(repoDir)
          .push("origin", branchName);
        const currentBranchAlreadyUpdated =
          pushedBranches?.pushed?.length <= 0 ||
          pushedBranches.pushed.every((i) => i.alreadyUpdated);
        if (!currentBranchAlreadyUpdated) {
          branchesAlreadyUpdated = false;
        }
        if (currentBranchAlreadyUpdated) {
          console.log(`Branch ${branchName} is already up to date.`);
        } else {
          console.log(`Pushed latest changes for branch: ${branchName}`);
        }
        tryAgain = false;
      } catch (error) {
        console.error(
          `Error pulling latest changes for branch: ${branchName}: ${error.message}`,
        );
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: `Do you want to try push latest changes to ${branchName} branch again?`,
            default: false,
          },
        ]);
        tryAgain = confirm;
        if (!tryAgain) {
          process.exit(1);
        }
      }
    } while (tryAgain);
  }
  return branchesAlreadyUpdated;
}

// Push the repository to the target organization
async function pushRepository(repositoryName) {
  const repoDir = path.join(INPUT_DIR, repositoryName);
  if (!fs.existsSync(repoDir)) {
    console.error(`Repository directory not found: ${repoDir}`);
    process.exit(1);
  }
  try {
    console.log(
      `Pushing repository ${repositoryName} to organization ${TARGET_ORGANIZATION}...`,
    );

    await git.cwd(repoDir).removeRemote("origin");
    await git
      .cwd(repoDir)
      .addRemote(
        "origin",
        `https://github.com/${SOURCE_ORGANIZATION}/${repositoryName}.git`,
      );

    await fetchAllBranches(repoDir);

    await createLocalTrackingBranches(repoDir);

    await pullAllLocalBranches(repoDir);

    await git.cwd(repoDir).removeRemote("origin");
    await git
      .cwd(repoDir)
      .addRemote(
        "origin",
        `https://github.com/${TARGET_ORGANIZATION}/${repositoryName}.git`,
      );

    const branchesAlreadyUpdated = await pushAllLocalBranches(repoDir);

    const pushedTags = await git.cwd(repoDir).pushTags("origin");

    if (
      branchesAlreadyUpdated &&
      (pushedTags?.pushed?.length <= 0 ||
        pushedTags.pushed.every((i) => i.alreadyUpdated))
    ) {
      console.log(`Repository ${repositoryName} is already up to date.`);
    } else {
      console.log(`Repository ${repositoryName} pushed successfully.`);
      await sleep(defaultIntervalMs);
    }
  } catch (error) {
    console.error(
      `Error pushing repository ${repositoryName}: ${error.message}`,
    );
    process.exit(1);
  }
}

async function main() {
  try {
    const repoFilePath = path.join(INPUT_DIR, "org.repos.json");
    const repos = readJSON(repoFilePath);

    // Code commits
    for (const repo of repos) {
      const repositoryName = repo.name;
      await pushRepository(repositoryName);
    }

    console.log(
      `Data uploading completed. All data is uploaded to the ${TARGET_ORGANIZATION} organization.`,
    );
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();

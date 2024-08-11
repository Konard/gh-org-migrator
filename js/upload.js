#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import { config } from "dotenv";
import simpleGit from "simple-git";
import inquirer from "inquirer";
import { createCache, memoryStore } from "cache-manager";

const second = 1000;
const minute = 60 * second;
const hour = 60 * minute;
const cache = createCache(
  memoryStore({
    max: 100,
    ttl: hour,
  }),
);

// Load environment variables
config();

const { ACCESS_TOKEN, SOURCE_ORGANIZATION, TARGET_ORGANIZATION } = process.env;

if (!ACCESS_TOKEN || !SOURCE_ORGANIZATION || !TARGET_ORGANIZATION) {
  console.error(
    "ACCESS_TOKEN, SOURCE_ORGANIZATION, and TARGET_ORGANIZATION must be set in the .env file.",
  );
  process.exit(1);
}

// Initialize Octokit
const octokit = new Octokit({
  auth: ACCESS_TOKEN,
});

// Initialize simple-git
const git = simpleGit();

// Path to the input data directory
const INPUT_DIR = path.join(process.cwd(), "data", SOURCE_ORGANIZATION);

const defaultIntervalMs = 30000;

const sleep = async (ms) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

// Utility function to read JSON data from a file
function readJSON(filePath) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } else {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
}

// Check if a repository exists in the target organization
async function repositoryExists(repositoryName) {
  try {
    await octokit.repos.get({
      owner: TARGET_ORGANIZATION,
      repo: repositoryName,
    });
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    } else {
      console.error(
        `Error checking repository ${repositoryName}: ${error.message}`,
      );
      process.exit(1);
    }
  }
}

// Create a repository in the target organization
async function createRepository(repo) {
  try {
    console.log(
      `Creating repository ${repo.name} in organization ${TARGET_ORGANIZATION}...`,
    );
    const response = await octokit.repos.createInOrg({
      org: TARGET_ORGANIZATION,
      name: repo.name,
      private: repo.private,
      description: repo.description,
      homepage: repo.homepage,
      has_issues: repo.has_issues,
      has_projects: repo.has_projects,
      has_wiki: repo.has_wiki,
      has_downloads: repo.has_downloads,
    });
    await sleep(defaultIntervalMs);
    return response.data;
  } catch (error) {
    console.error(
      `Error creating repository ${repositoryName}: ${error.message}`,
    );
    process.exit(1);
  }
}

async function fetchAllIssues(repositoryName, page = 1, issues = []) {
  // console.log({ fetchAllIssues: { repositoryName } });
  const { data: fetchedIssues } = await octokit.issues.listForRepo({
    owner: TARGET_ORGANIZATION,
    repo: repositoryName,
    state: "open",
    per_page: 100,
    page,
  });

  issues = issues.concat(fetchedIssues);

  if (fetchedIssues.length === 100) {
    // If the current page is full, there might be more issues, so fetch the next page
    return await fetchAllIssues(repositoryName, page + 1, issues);
  } else {
    // All issues fetched
    return issues;
  }
}

async function getCachedIssues(repositoryName) {
  try {
    // console.log({ getCachedIssues: { repositoryName } });

    const key = `${repositoryName}-issues`;
    // Check if issues are already cached
    const cachedIssues = await cache.get(key);
    if (cachedIssues) {
      // console.log("Returning cached issues");
      return cachedIssues;
    }

    // If not cached, fetch all issues from GitHub
    const issues = await fetchAllIssues(repositoryName);

    // Cache the fetched issues
    await cache.set(key, issues);
    // console.log("Fetched and cached issues from GitHub");
    return issues;
  } catch (error) {
    console.error("Error fetching issues from GitHub:", error);
    throw error;
  }
}

// Check if an issue exists in a repository
async function issueExists(repositoryName, issue) {
  try {
    const issues = await getCachedIssues(repositoryName);
    return issues.some((i) => i.title === issue.title && i.body === issue.body);
  } catch (error) {
    console.error(
      `Error checking issue "${issue.title}" in repository ${repositoryName}: ${error.message}`,
    );
    process.exit(1);
  }
}

// Check the rate limit status
async function checkRateLimit() {
  try {
    const response = await octokit.rateLimit.get();
    const rateLimit = response.data.resources.core;
    console.log(
      `Rate limit: ${rateLimit.remaining}/${rateLimit.limit}, resets at ${new Date(rateLimit.reset * 1000)}`,
    );
    return rateLimit.remaining;
  } catch (error) {
    console.error(`Error checking rate limit: ${error.message}`);
    process.exit(1);
  }
}

// Create issues for a given repository with delay and rate limit check
async function createIssues(repositoryName, issues) {
  for (const issue of issues) {
    const exists = await issueExists(repositoryName, issue);
    if (!exists) {
      try {
        const remaining = await checkRateLimit();
        if (remaining < 10) {
          const waitTime =
            new Date(response.headers["x-ratelimit-reset"] * 1000).getTime() -
            new Date().getTime() +
            10000;
          console.log(
            `Low rate limit remaining (${remaining}). Waiting until rate limit resets...`,
          );
          await sleep(waitTime);
        }

        console.log(
          `Creating issue "${issue.title}" in repository ${repositoryName}...`,
        );
        await octokit.issues.create({
          owner: TARGET_ORGANIZATION,
          repo: repositoryName,
          title: issue.title,
          body: issue.body,
        });
        console.log(
          `Issue "${issue.title}" in repository ${repositoryName} is created.`,
        );
        await sleep(defaultIntervalMs);
      } catch (error) {
        console.error(
          `Error creating issue "${issue.title}" in repository ${repositoryName}: ${error.message}`,
        );
        process.exit(1);
      }
    } else {
      console.log(
        `Issue "${issue.title}" already exists in repository ${repositoryName}. Skipping creation.`,
      );
    }
  }
}

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

    // Repos
    for (const repo of repos) {
      const repositoryName = repo.name;
      const exists = await repositoryExists(repositoryName);
      if (!exists) {
        await createRepository(repo);
      } else {
        console.log(
          `Repository ${repositoryName} already exists. Skipping creation.`,
        );
      }
    }

    // Code commits
    for (const repo of repos) {
      const repositoryName = repo.name;
      await pushRepository(repositoryName);
    }

    // Issues
    for (const repo of repos) {
      const repositoryName = repo.name;
      // console.log({ repositoryName });
      const issuesFilePath = path.join(
        INPUT_DIR,
        `${repositoryName}.issues.json`,
      );
      const issues = readJSON(issuesFilePath);
      await createIssues(repositoryName, issues);
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

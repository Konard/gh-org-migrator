#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import simpleGit from 'simple-git';
import inquirer from 'inquirer';

// Load environment variables
config();

const { ACCESS_TOKEN, SOURCE_ORGANIZATION, TARGET_ORGANIZATION } = process.env;

if (!ACCESS_TOKEN || !SOURCE_ORGANIZATION || !TARGET_ORGANIZATION) {
  console.error("ACCESS_TOKEN, SOURCE_ORGANIZATION, and TARGET_ORGANIZATION must be set in the .env file.");
  process.exit(1);
}

// Initialize Octokit
const octokit = new Octokit({
  auth: ACCESS_TOKEN
});

// Initialize simple-git
const git = simpleGit();

// Path to the input data directory
const INPUT_DIR = path.join(process.cwd(), 'data', SOURCE_ORGANIZATION);

const defaultIntervalMs = 30000;

const sleep = async (ms) => await new Promise(resolve => setTimeout(resolve, ms));

// Utility function to read JSON data from a file
function readJSONFromFile(filePath) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
}

// Check if a repository exists in the target organization
async function repositoryExists(repoName) {
  try {
    await octokit.repos.get({
      owner: TARGET_ORGANIZATION,
      repo: repoName
    });
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    } else {
      console.error(`Error checking repository ${repoName}: ${error.message}`);
      process.exit(1);
    }
  }
}

// Create a repository in the target organization
async function createRepository(repo) {
  try {
    console.log(`Creating repository ${repo.name} in organization ${TARGET_ORGANIZATION}...`);
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
    console.error(`Error creating repository ${repoName}: ${error.message}`);
    process.exit(1);
  }
}

// Check if an issue exists in a repository
async function issueExists(repoName, issue) {
  try {
    const { data: issues } = await octokit.issues.listForRepo({
      owner: TARGET_ORGANIZATION,
      repo: repoName
    });
    return issues.some(i => i.title === issue.title && i.body === issue.body);
  } catch (error) {
    console.error(`Error checking issue "${issue.title}" in repository ${repoName}: ${error.message}`);
    process.exit(1);
  }
}

// Check the rate limit status
async function checkRateLimit() {
  try {
    const response = await octokit.rateLimit.get();
    const rateLimit = response.data.resources.core;
    console.log(`Rate limit: ${rateLimit.remaining}/${rateLimit.limit}, resets at ${new Date(rateLimit.reset * 1000)}`);
    return rateLimit.remaining;
  } catch (error) {
    console.error(`Error checking rate limit: ${error.message}`);
    process.exit(1);
  }
}

// Create issues for a given repository with delay and rate limit check
async function createIssues(repoName, issues) {
  for (const issue of issues) {
    const exists = await issueExists(repoName, issue);
    if (!exists) {
      try {
        const remaining = await checkRateLimit();
        if (remaining < 10) {
          const waitTime = (new Date(response.headers['x-ratelimit-reset'] * 1000).getTime() - new Date().getTime()) + 10000;
          console.log(`Low rate limit remaining (${remaining}). Waiting until rate limit resets...`);
          await sleep(waitTime);
        }

        console.log(`Creating issue "${issue.title}" in repository ${repoName}...`);
        await octokit.issues.create({
          owner: TARGET_ORGANIZATION,
          repo: repoName,
          title: issue.title,
          body: issue.body
        });
        await sleep(defaultIntervalMs);
      } catch (error) {
        console.error(`Error creating issue "${issue.title}" in repository ${repoName}: ${error.message}`);
        process.exit(1);
      }
    } else {
      console.log(`Issue "${issue.title}" already exists in repository ${repoName}. Skipping creation.`);
    }
  }
}

async function getAllRemoteBranches() {
  try {
    const remoteBranches = await git.listRemote(['--heads', 'origin']);
    const branches = remoteBranches
      .split('\n')
      .map(line => line.split('\t')[1])
      .filter(Boolean)
      .map(branch => branch.replace('refs/heads/', ''));

    console.log('Remote branches:', branches);
    return branches;
  } catch (err) {
    console.error('Error getting remote branches:', err);
  }
}

// Fetch all branches
async function fetchAllBranches(repoDir) {
  return await git.cwd(repoDir).fetch(['--all']);
  // await git.cwd(repoDir).fetch('origin');
}

// List remote branches and create local tracking branches
async function createLocalTrackingBranches(repoDir) {
  const remoteBranches = await git.cwd(repoDir).branch(['-r']);
  const localBranches = await git.cwd(repoDir).branch();

  for (const remoteBranch of remoteBranches.all) {
    // console.log({ remoteBranch });
    if (!remoteBranch.includes('->')) {
      const branchName = remoteBranch.replace('origin/', '');
      if (!localBranches.all.includes(branchName)) {
        await git.cwd(repoDir).branch(['--track', branchName, remoteBranch]);
        console.log(`Created local tracking branch: ${branchName}`);
      } else {
        await git.cwd(repoDir).branch(['--set-upstream-to', `origin/${branchName}`, branchName]);
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
      await git.cwd(repoDir).pull({ "--ff-only": null, '--strategy-option': 'theirs' });
      console.log(`Pulled latest changes for branch: ${branch}`);
    } catch (error) {
      console.error(`Error pulling latest changes for branch: ${branch}: ${error.message}`);
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
        const pushedBranches = await git.cwd(repoDir).push('origin', branchName);
        const currentBranchAlreadyUpdated = pushedBranches?.pushed?.length <= 0 || pushedBranches.pushed.every(i => i.alreadyUpdated);
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
        console.error(`Error pulling latest changes for branch: ${branchName}: ${error.message}`);
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Do you want to try push latest changes to ${branchName} branch again?`,
            default: false
          }
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
async function pushRepository(repoName) {
  const repoDir = path.join(INPUT_DIR, repoName);
  if (!fs.existsSync(repoDir)) {
    console.error(`Repository directory not found: ${repoDir}`);
    process.exit(1);
  }
  try {
    console.log(`Pushing repository ${repoName} to organization ${TARGET_ORGANIZATION}...`);

    await git.cwd(repoDir).removeRemote('origin');
    await git.cwd(repoDir).addRemote('origin', `https://github.com/${SOURCE_ORGANIZATION}/${repoName}.git`);

    await fetchAllBranches(repoDir);

    await createLocalTrackingBranches(repoDir);

    await pullAllLocalBranches(repoDir);

    await git.cwd(repoDir).removeRemote('origin');
    await git.cwd(repoDir).addRemote('origin', `https://github.com/${TARGET_ORGANIZATION}/${repoName}.git`);

    const branchesAlreadyUpdated = await pushAllLocalBranches(repoDir);

    const pushedTags = await git.cwd(repoDir).pushTags('origin');

    if (branchesAlreadyUpdated && (pushedTags?.pushed?.length <= 0 || pushedTags.pushed.every(i => i.alreadyUpdated))) {
      console.log(`Repository ${repoName} is already up to date.`);
    } else {
      console.log(`Repository ${repoName} pushed successfully.`);
      await sleep(defaultIntervalMs);
    }
  } catch (error) {
    console.error(`Error pushing repository ${repoName}: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  try {
    const repoFilePath = path.join(INPUT_DIR, 'org.repos.json');
    const repos = readJSONFromFile(repoFilePath);

    // Repos
    for (const repo of repos) {
      const repoName = repo.name;
      const exists = await repositoryExists(repoName);
      if (!exists) {
        await createRepository(repo);
      } else {
        console.log(`Repository ${repoName} already exists. Skipping creation.`);
      }
    }

    // Code commits
    for (const repo of repos) {
      const repoName = repo.name;
      await pushRepository(repoName);
    }

    // Issues
    for (const repo of repos) {
      const repoName = repo.name;
      const issuesFilePath = path.join(INPUT_DIR, `${repoName}.issues.json`);
      const issues = readJSONFromFile(issuesFilePath);
      await createIssues(repoName, issues);
    }

    console.log(`Data uploading completed. All data is uploaded to the ${TARGET_ORGANIZATION} organization.`);
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();
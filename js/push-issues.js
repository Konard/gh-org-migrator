#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import path from "path";
import { config } from "dotenv";
import { createCache, memoryStore } from "cache-manager";
import { sleep, readJSON } from "./lib.js";

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

// Path to the input data directory
const INPUT_DIR = path.join(process.cwd(), "data", SOURCE_ORGANIZATION);

const defaultIntervalMs = 30000;

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
async function issueExists(repositoryName, title, body) {
  try {
    const issues = await getCachedIssues(repositoryName);
    return issues.some((i) => i.title === title && ((i.body || '').trim() === (body || '').trim()));
  } catch (error) {
    console.error(
      `Error checking issue "${issue.title}" in repository ${repositoryName}: ${error.message}`,
    );
    process.exit(1);
  }
}

function makeBodyWithSourceLink(issue) {
  let newBody;
  if (issue?.body?.trim?.()?.length > 0) {
    newBody = `${issue.body}

---
Forked from ${issue.html_url} by https://github.com/konard/gh-org-migrator`;
  } else {
    newBody = `Forked from ${issue.html_url} by https://github.com/konard/gh-org-migrator`;
  }
  return newBody;
}

// Create issues for a given repository with delay and rate limit check
async function createIssues(repositoryName, issues) {
  for (const issue of issues) {
    // console.log("issue.html_url", issue.html_url);
    const body = makeBodyWithSourceLink(issue);
    const exists = await issueExists(repositoryName, issue.title, body);
    if (!exists) {
      try {
        console.log(
          `Creating issue "${issue.title}" in repository ${repositoryName}...`,
        );
        await octokit.issues.create({
          owner: TARGET_ORGANIZATION,
          repo: repositoryName,
          title: issue.title,
          body,
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

async function main() {
  try {
    const repoFilePath = path.join(INPUT_DIR, "org.repos.json");
    const repos = readJSON(repoFilePath);

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
      `Issues pushing completed. All issues are uploaded to the ${TARGET_ORGANIZATION} organization.`,
    );
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();

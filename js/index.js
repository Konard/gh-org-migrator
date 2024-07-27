#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import simpleGit from 'simple-git';

// Load environment variables
config();

const { ACCESS_TOKEN, SOURCE_ORGANIZATION } = process.env;

if (!ACCESS_TOKEN || !SOURCE_ORGANIZATION) {
  console.error("ACCESS_TOKEN and SOURCE_ORGANIZATION must be set in the .env file.");
  process.exit(1);
}

// Initialize Octokit
const octokit = new Octokit({
  auth: ACCESS_TOKEN
});

// Initialize simple-git
const git = simpleGit();

// Create a directory to store the output
const OUTPUT_DIR = path.join(process.cwd(), 'data', SOURCE_ORGANIZATION);
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Utility function to write JSON data to a file
function writeJSONToFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Utility function to fetch data with pagination
async function fetchPaginatedData(fetchFunction, fetchParams) {
  let page = 1;
  let allData = [];
  let fetchedData;
  try {
    do {
      fetchedData = await fetchFunction({ ...fetchParams, per_page: 100, page });
      allData = allData.concat(fetchedData.data);
      page++;
    } while (fetchedData.data.length === 100);
  } catch (error) {
    console.error(`Error fetching data: ${error.message}`);
    process.exit(1);
  }
  return allData;
}

// Fetch repositories for the organization
async function fetchRepositories() {
  try {
    console.log(`Fetching repositories for organization ${SOURCE_ORGANIZATION}...`);
    const repos = await fetchPaginatedData(octokit.repos.listForOrg, { org: SOURCE_ORGANIZATION });
    const repoNames = repos.map(repo => repo.name);
    writeJSONToFile(path.join(OUTPUT_DIR, 'org.repos.json'), repos);
    return repoNames;
  } catch (error) {
    console.error("Error fetching repositories:", error);
    process.exit(1);
  }
}

// Fetch issues for a given repository
async function fetchIssues(repoName) {
  try {
    console.log(`Fetching issues for repository ${repoName}...`);
    const issues = await fetchPaginatedData(octokit.issues.listForRepo, { owner: SOURCE_ORGANIZATION, repo: repoName });
    writeJSONToFile(path.join(OUTPUT_DIR, `${repoName}.issues.json`), issues);
  } catch (error) {
    console.error(`Error fetching issues for repository ${repoName}: ${error.message}`);
    process.exit(1);
  }
}

// Clone a repository
async function cloneRepository(repoName) {
  const repoDir = path.join(OUTPUT_DIR, repoName);
  if (!fs.existsSync(repoDir)) {
    fs.mkdirSync(repoDir, { recursive: true });
  }
  try {
    console.log(`Cloning repository ${repoName}...`);
    await git.clone(`https://github.com/${SOURCE_ORGANIZATION}/${repoName}.git`, repoDir);
    console.log(`Repository ${repoName} cloned successfully.`);
  } catch (error) {
    console.error(`Error cloning repository ${repoName}: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  try {
    const repoNames = await fetchRepositories();
    for (const repoName of repoNames) {
      await fetchIssues(repoName);
      await cloneRepository(repoName);
    }
    console.log(`Data fetching and cloning completed. All data is stored in the ${OUTPUT_DIR} directory.`);
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();
#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
config();

const { ACCESS_TOKEN, ORGANIZATION } = process.env;

if (!ACCESS_TOKEN || !ORGANIZATION) {
  console.error("ACCESS_TOKEN and ORGANIZATION must be set in the .env file.");
  process.exit(1);
}

const octokit = new Octokit({ auth: ACCESS_TOKEN });

const OUTPUT_DIR = path.join(process.cwd(), 'data', ORGANIZATION);
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const REPOS_FILE_PATH = path.join(OUTPUT_DIR, 'org.repos.json');

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readJSON(filePath) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

async function fetchPaginatedData(fetchFunction, fetchParams, headers = {}) {
  let result = { data: [], headers: undefined };
  try {
    let page = 1;
    let pageSize = 100;
    let currentData;
    do {
      const response = await fetchFunction({ ...fetchParams, per_page: pageSize, page, headers });
      currentData = response.data;
      result.data = result.data.concat(currentData);
      result.headers = response.headers;
      page++;
    } while (currentData.length === pageSize);
  } catch (error) {
    if (error.status === 304) {
      console.log('No new data to fetch since the last update.');
      return result;
    } else {
      console.error(`Error fetching data: ${error.message}`);
      process.exit(1);
    }
  }
  return result;
}

async function fetchRepositories(since, etag) {
  try {
    console.log(`Fetching repositories for organization ${ORGANIZATION}...`);
    const headers = since ? { 'If-Modified-Since': since } : {};
    if (etag) headers['If-None-Match'] = etag;
    const { data, headers: responseHeaders } = await fetchPaginatedData(octokit.repos.listForOrg, { org: ORGANIZATION }, headers);
    return { data, headers: responseHeaders };
  } catch (error) {
    console.error("Error fetching repositories:", error);
    process.exit(1);
  }
}

function mergeData(repos, newRepos) {
  // Create a map from existing data for quick lookup
  const resultRepoMap = new Map(repos.map(repo => [repo.id, repo]));
  const newRepoMap = new Map(newRepos.map(repo => [repo.id, repo]));

  // Iterate through new data and update or add items
  newRepos.forEach(repo => {
    resultRepoMap.set(repo.id, repo);
  });

  // Check for deletions by comparing with new data
  for (const id of resultRepoMap.keys()) {
    if (!newRepoMap.has(id)) {
      resultRepoMap.delete(id);
    }
  }

  return Array.from(resultRepoMap.values());
}

async function fetchOrUpdateRepositories() {
  let existingData = readJSON(REPOS_FILE_PATH);
  let lastModified = existingData ? existingData.lastModified : null;
  let etag = existingData ? existingData.etag : null;
  const { data: newRepos, headers: responseHeaders } = await fetchRepositories(lastModified, etag);

  if (newRepos.length > 0) {
    let updatedRepos;
    if (existingData) {
      console.log('Existing repository data found. Merging with new data...');
      updatedRepos = mergeData(existingData.repos, newRepos);
    } else {
      console.log('No existing repository data found. Writing new data...');
      updatedRepos = newRepos;
    }

    const newLastModified = responseHeaders['last-modified'] || new Date().toISOString();
    const newEtag = responseHeaders.etag;
    writeJSON(REPOS_FILE_PATH, { lastModified: newLastModified, etag: newEtag, repos: updatedRepos });
  } else {
    console.log('No new repositories to update.');
  }
}

async function main() {
  try {
    await fetchOrUpdateRepositories();
    console.log(`Data fetching and updating completed. All data is stored in the ${OUTPUT_DIR} directory.`);
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();
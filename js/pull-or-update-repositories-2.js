#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
config();

const { GITHUB_ACCESS_TOKEN, ORGANIZATION } = process.env;

if (!GITHUB_ACCESS_TOKEN || !ORGANIZATION) {
  console.error("GITHUB_ACCESS_TOKEN and ORGANIZATION must be set in the .env file.");
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_ACCESS_TOKEN });

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

async function fetchPage(fetchFunction, fetchParams, headers) {
  try {
    const response = await fetchFunction({ ...fetchParams, headers });
    return { data: response.data, headers: response.headers };
  } catch (error) {
    if (error.status === 304) {
      console.log('No new data to fetch for this page since the last update.');
      return { data: null, headers: null };
    } else {
      console.error(`Error fetching data: ${error.message}`);
      process.exit(1);
    }
  }
}

async function fetchRepositories(pageHeaders) {
  try {
    console.log(`Fetching repositories for organization ${ORGANIZATION}...`);
    let page = 1;
    let pageSize = 100;
    const allPagesData = [];

    while (true) {
      const headers = pageHeaders[page] || {};
      const { data, headers: responseHeaders } = await fetchPage(octokit.repos.listForOrg, { org: ORGANIZATION, per_page: pageSize, page }, headers);

      page++;

      if (data == null) {
        continue;
      }

      const pageData = {
        page: page - 1,
        etag: responseHeaders.etag,
        lastModified: responseHeaders['last-modified'] || new Date().toISOString(),
        repos: data
      };

      allPagesData.push(pageData);

      if (data.length < pageSize) {
        break;
      }
    }

    return allPagesData;
  } catch (error) {
    console.error("Error fetching repositories:", error);
    process.exit(1);
  }
}

function mergeData(existingPages, newPages) {
  const pageMap = new Map(existingPages.map(page => [page.page, page]));

  newPages.forEach(newPage => {
    pageMap.set(newPage.page, newPage);
  });

  return Array.from(pageMap.values());
}

async function fetchOrUpdateRepositories() {
  let existingData = readJSON(REPOS_FILE_PATH);
  let pageHeaders = {};

  if (existingData) {
    existingData.pages.forEach(pageData => {
      pageHeaders[pageData.page] = {
        'If-Modified-Since': pageData.lastModified,
        'If-None-Match': pageData.etag,
      };
    });
  }

  const newPages = await fetchRepositories(pageHeaders);

  if (newPages.length > 0) {
    let updatedPages;
    if (existingData) {
      console.log('Existing repository data found. Merging with new data...');
      updatedPages = mergeData(existingData.pages, newPages);
    } else {
      console.log('No existing repository data found. Writing new data...');
      updatedPages = newPages;
    }

    writeJSON(REPOS_FILE_PATH, { pages: updatedPages });
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
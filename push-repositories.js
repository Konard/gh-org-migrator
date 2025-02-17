#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import path from "path";
import { config } from "dotenv";
import { readJSON, sleep } from "./lib.js";

config();

const { GITHUB_ACCESS_TOKEN, SOURCE_ORGANIZATION, TARGET_ORGANIZATION } = process.env;

if (!GITHUB_ACCESS_TOKEN || !SOURCE_ORGANIZATION || !TARGET_ORGANIZATION) {
  console.error(
    "GITHUB_ACCESS_TOKEN, SOURCE_ORGANIZATION, and TARGET_ORGANIZATION must be set in the .env file.",
  );
  process.exit(1);
}

const octokit = new Octokit({
  auth: GITHUB_ACCESS_TOKEN,
});

const INPUT_DIR = path.join(process.cwd(), "data", SOURCE_ORGANIZATION);

const defaultIntervalMs = 30000;

async function repositoryExists(repositoryName) {
  try {
    const response = await octokit.repos.get({
      owner: TARGET_ORGANIZATION,
      repo: repositoryName,
    });
    const repository = response.data;
    return repository.name === repositoryName;
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

async function createRepository(repo) {
  try {
    console.log(
      `Creating repository ${repo.name} in organization ${TARGET_ORGANIZATION} on GitHub...`,
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
    console.log(`Repository ${repo.name} in organization ${TARGET_ORGANIZATION} on GitHub is created.`);
    await sleep(defaultIntervalMs);
    return response.data;
  } catch (error) {
    console.error(`Error creating repository ${repo.name}: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  try {
    const repoFilePath = path.join(INPUT_DIR, "org.repos.json");
    const repos = readJSON(repoFilePath);
    for (const repo of repos) {
      const repositoryName = repo.name;
      const exists = await repositoryExists(repositoryName);
      if (!exists) {
        await createRepository(repo);
      } else {
        console.log(
          `Repository ${repositoryName} already exists on GitHub. Skipping creation.`,
        );
      }
    }
    console.log(
      `Repositories creation completed. All repositories are created in the ${TARGET_ORGANIZATION} organization on GitHub.`,
    );
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();

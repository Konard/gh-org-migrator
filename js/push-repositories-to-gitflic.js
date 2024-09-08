#!/usr/bin/env node

import axios from "axios";
import path from "path";
import { config } from "dotenv";
import { readJSON, sleep } from "./lib.js";

// Load environment variables
config();

const { GITFLIC_ACCESS_TOKEN, SOURCE_ORGANIZATION, TARGET_ORGANIZATION } = process.env;

if (!GITFLIC_ACCESS_TOKEN || !SOURCE_ORGANIZATION || !TARGET_ORGANIZATION) {
  console.error(
    "GITFLIC_ACCESS_TOKEN, SOURCE_ORGANIZATION, and TARGET_ORGANIZATION must be set in the .env file.",
  );
  process.exit(1);
}

// GitFlic API base URL
const GITFLIC_API_URL = "https://api.gitflic.ru";
const INPUT_DIR = path.join(process.cwd(), "data", SOURCE_ORGANIZATION);
const defaultIntervalMs = 30000;

// Check if a repository exists in the target organization
async function repositoryExists(repositoryName) {
  try {
    const response = await axios.get(
      `${GITFLIC_API_URL}/project/${TARGET_ORGANIZATION}/${repositoryName}`,
      {
        headers: { Authorization: `token ${GITFLIC_ACCESS_TOKEN}` },
      }
    );
    return response.data && response.data.name === repositoryName;
  } catch (error) {
    if (error.response && error.response.status === 404) {
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
      `Creating repository ${repo.name} in organization ${TARGET_ORGANIZATION} on GitFlic...`,
    );
    const response = await axios.post(
      `${GITFLIC_API_URL}/project`,
      {
        title: repo.name,
        isPrivate: repo.private,
        description: repo.description,
        ownerAlias: TARGET_ORGANIZATION,
        ownerAliasType: "COMPANY",
      },
      {
        headers: { Authorization: `token ${GITFLIC_ACCESS_TOKEN}` },
      }
    );
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
          `Repository ${repositoryName} already exists on GitFlic. Skipping creation.`,
        );
      }
    }
    console.log(
      `Repositories creation completed. All repositories are created in the ${TARGET_ORGANIZATION} organization on GitFlic.`,
    );
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();
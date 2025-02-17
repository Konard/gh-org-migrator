#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import path from "path";
import { config } from "dotenv";
import { pushAllRepositories } from "./push-repositories.js";
import { pushCodeChangesForAllRepositories } from "./push-code-commits.js";
import { pushIssuesForAllRepositories } from "./push-issues.js";
import { readJSON, sleep } from "./lib.js";

config();

const { GITHUB_ACCESS_TOKEN, SOURCE_ORGANIZATION, TARGET_ORGANIZATION } = process.env;

if (!GITHUB_ACCESS_TOKEN || !SOURCE_ORGANIZATION || !TARGET_ORGANIZATION) {
  console.error(
    "GITHUB_ACCESS_TOKEN, SOURCE_ORGANIZATION, and TARGET_ORGANIZATION must be set in the .env file.",
  );
  process.exit(1);
}

const INPUT_DIR = path.join(process.cwd(), "data", SOURCE_ORGANIZATION);

async function main() {
  try {
    const repoFilePath = path.join(INPUT_DIR, "org.repos.json");
    const repos = readJSON(repoFilePath);

    // Repos
    await pushAllRepositories(repos);

    // Issues
    await pushIssuesForAllRepositories(repos);

    // Code commits
    await pushCodeChangesForAllRepositories(repos);

    console.log(
      `Data uploading completed. All data is uploaded to the ${TARGET_ORGANIZATION} organization.`,
    );
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();

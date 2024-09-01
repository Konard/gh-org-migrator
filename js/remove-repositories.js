#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import { config } from "dotenv";
import path from "path";
import inquirer from "inquirer";
import { sleep, readJSON } from "./lib.js";

// Load environment variables
config();

const { ACCESS_TOKEN, SOURCE_ORGANIZATION, TARGET_ORGANIZATION } = process.env;

if (!ACCESS_TOKEN || !SOURCE_ORGANIZATION || !TARGET_ORGANIZATION) {
  console.error(
    "ACCESS_TOKEN, SOURCE_ORGANIZATION, and TARGET_ORGANIZATION must be set in the .env file.",
  );
  process.exit(1);
}

// Path to the input data directory
const INPUT_DIR = path.join(process.cwd(), "data", SOURCE_ORGANIZATION);

// Initialize Octokit
const octokit = new Octokit({
  auth: ACCESS_TOKEN,
});

// // Get all repositories in the source organization
// async function getSourceRepositories() {
//   try {
//     const repos = await octokit.paginate(octokit.repos.listForOrg, {
//       org: SOURCE_ORGANIZATION
//     });
//     return repos;
//   } catch (error) {
//     console.error(`Error fetching repositories for organization ${SOURCE_ORGANIZATION}: ${error.message}`);
//     process.exit(1);
//   }
// }

// Delete a repository from the target organization
async function deleteRepository(repositoryName) {
  try {
    console.log(
      `Deleting repository ${repositoryName} from organization ${TARGET_ORGANIZATION}...`,
    );
    await octokit.repos.delete({
      owner: TARGET_ORGANIZATION,
      repo: repositoryName,
    });
    console.log(`Repository ${repositoryName} deleted successfully.`);
  } catch (error) {
    if (error.status === 404) {
      console.log(
        `Repository ${repositoryName} does not exist in organization ${TARGET_ORGANIZATION}. Skipping deletion.`,
      );
    } else {
      console.error(
        `Error deleting repository ${repositoryName}: ${error.message}`,
      );
    }
  }
}

// Main function to delete repositories from the target organization that exist in the source organization
async function main() {
  try {
    // const sourceRepos = await getSourceRepositories();

    const repoFilePath = path.join(INPUT_DIR, "org.repos.json");
    const sourceRepos = readJSON(repoFilePath);

    console.log(`Source organization: ${SOURCE_ORGANIZATION}`);
    console.log(`Target organization: ${TARGET_ORGANIZATION}`);
    console.log(
      `Repositories to delete from ${
        TARGET_ORGANIZATION
      } organization: ${sourceRepos.map((repo) => repo.name).join(", ")}`,
    );

    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message:
          "Do you want to proceed with the deletion of the listed repositories?",
        default: false,
      },
    ]);

    if (!confirm) {
      console.log("Operation cancelled by the user.");
      process.exit(0);
    }

    for (const repo of sourceRepos) {
      await deleteRepository(repo.name);
      sleep(3000);
    }
    console.log(
      `Repositories from ${SOURCE_ORGANIZATION} have been deleted in the ${
        TARGET_ORGANIZATION
      } organization.`,
    );
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();

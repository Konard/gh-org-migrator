#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import { config } from 'dotenv';

// Load environment variables
config();

const { ACCESS_TOKEN, SOURCE_ORGANIZATION, TARGET_ORGANIZATION } = process.env;

if (!ACCESS_TOKEN || !SOURCE_ORGANIZATION || !TARGET_ORGANIZATION) {
  console.error("ACCESS_TOKEN, SOURCE_ORGANIZATION, and TARGET_ORGANIZATION must be set in the .env file.");
  process.exit(1);
}

// Path to the input data directory
const INPUT_DIR = path.join(process.cwd(), 'data', SOURCE_ORGANIZATION);

// Initialize Octokit
const octokit = new Octokit({
  auth: ACCESS_TOKEN
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
async function deleteRepository(repoName) {
  try {
    console.log(`Deleting repository ${repoName} from organization ${TARGET_ORGANIZATION}...`);
    await octokit.repos.delete({
      owner: TARGET_ORGANIZATION,
      repo: repoName
    });
    console.log(`Repository ${repoName} deleted successfully.`);
  } catch (error) {
    if (error.status === 404) {
      console.log(`Repository ${repoName} does not exist in organization ${TARGET_ORGANIZATION}. Skipping deletion.`);
    } else {
      console.error(`Error deleting repository ${repoName}: ${error.message}`);
    }
  }
}

// Main function to delete repositories from the target organization that exist in the source organization
async function main() {
  try {
    // const sourceRepos = await getSourceRepositories();

    const repoFilePath = path.join(INPUT_DIR, 'org.repos.json');
    const sourceRepos = readJSONFromFile(repoFilePath);

    for (const repo of sourceRepos) {
      await deleteRepository(repo.name);
    }
    console.log(`Repositories from ${SOURCE_ORGANIZATION} have been deleted in the ${TARGET_ORGANIZATION} organization.`);
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();
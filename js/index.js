import { Octokit } from "@octokit/rest";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables
config();

const { ACCESS_TOKEN, ORGANIZATION } = process.env;

if (!ACCESS_TOKEN || !ORGANIZATION) {
  console.error("ACCESS_TOKEN and ORGANIZATION must be set in the .env file.");
  process.exit(1);
}

// Initialize Octokit
const octokit = new Octokit({
  auth: ACCESS_TOKEN
});

// Create a directory to store the output
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, 'data', ORGANIZATION);
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function fetchRepositories() {
  try {
    console.log(`Fetching repositories for organization ${ORGANIZATION}...`);
    const { data: repos } = await octokit.repos.listForOrg({
      org: ORGANIZATION,
      per_page: 100
    });

    const repoNames = repos.map(repo => repo.name);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'org_repos.json'), JSON.stringify(repos, null, 2));

    return repoNames;
  } catch (error) {
    console.error("Error fetching repositories:", error);
    process.exit(1);
  }
}

async function fetchIssues(repoName) {
  try {
    console.log(`Fetching issues for repository ${repoName}...`);
    const { data: issues } = await octokit.issues.listForRepo({
      owner: ORGANIZATION,
      repo: repoName,
      per_page: 100
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, `${repoName}_issues.json`), JSON.stringify(issues, null, 2));
  } catch (error) {
    console.error(`Error fetching issues for repository ${repoName}:`, error);
  }
}

async function main() {
  const repoNames = await fetchRepositories();
  
  for (const repoName of repoNames) {
    await fetchIssues(repoName);
  }

  console.log(`Data fetching completed. All data is stored in the ${OUTPUT_DIR} directory.`);
}

main();
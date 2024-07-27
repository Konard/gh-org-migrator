#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import simpleGit from 'simple-git';

// Load environment variables
config();

const { ACCESS_TOKEN, SOURCE_ORGANIZATION, TARGET_ORGANIZATION } = process.env;

if (!ACCESS_TOKEN || !SOURCE_ORGANIZATION || !TARGET_ORGANIZATION) {
 console.error("ACCESS_TOKEN, SOURCE_ORGANIZATION, and TARGET_ORGANIZATION must be set in the .env file.");
 process.exit(1);
}

// Initialize Octokit
const octokit = new Octokit({
 auth: ACCESS_TOKEN
});

// Initialize simple-git
const git = simpleGit();

// Path to the input data directory
const INPUT_DIR = path.join(process.cwd(), 'data', SOURCE_ORGANIZATION);

// Utility function to read JSON data from a file
function readJSONFromFile(filePath) {
 if (fs.existsSync(filePath)) {
   return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
 } else {
   console.error(`File not found: ${filePath}`);
   process.exit(1);
 }
}

// Check if a repository exists in the target organization
async function repositoryExists(repoName) {
 try {
   await octokit.repos.get({
     owner: TARGET_ORGANIZATION,
     repo: repoName
   });
   return true;
 } catch (error) {
   if (error.status === 404) {
     return false;
   } else {
     console.error(`Error checking repository ${repoName}: ${error.message}`);
     process.exit(1);
   }
 }
}

// Create a repository in the target organization
async function createRepository(repoName) {
 try {
   console.log(`Creating repository ${repoName} in organization ${TARGET_ORGANIZATION}...`);
   const response = await octokit.repos.createInOrg({
     org: TARGET_ORGANIZATION,
     name: repoName,
     private: false // Set to true if you want the repository to be private
   });
   return response.data;
 } catch (error) {
   console.error(`Error creating repository ${repoName}: ${error.message}`);
   process.exit(1);
 }
}

// Create issues for a given repository
async function createIssues(repoName, issues) {
 for (const issue of issues) {
   try {
     console.log(`Creating issue "${issue.title}" in repository ${repoName}...`);
     await octokit.issues.create({
       owner: TARGET_ORGANIZATION,
       repo: repoName,
       title: issue.title,
       body: issue.body
     });
   } catch (error) {
     console.error(`Error creating issue "${issue.title}" in repository ${repoName}: ${error.message}`);
     process.exit(1);
   }
 }
}

// Push the repository to the target organization
async function pushRepository(repoName) {
 const repoDir = path.join(INPUT_DIR, repoName);
 if (!fs.existsSync(repoDir)) {
   console.error(`Repository directory not found: ${repoDir}`);
   process.exit(1);
 }
 try {
   console.log(`Pushing repository ${repoName} to organization ${TARGET_ORGANIZATION}...`);
   
   // Check if the branch 'main' exists, if not create it
   const branchSummary = await git.cwd(repoDir).branchLocal();
   const branchName = branchSummary.all.includes('main') ? 'main' : (branchSummary.current || 'master');
   
   if (!branchSummary.all.includes(branchName)) {
     console.log(`Branch ${branchName} not found, creating it...`);
     await git.cwd(repoDir).checkoutLocalBranch(branchName);
   }
   
   await git.cwd(repoDir).removeRemote('origin');
   await git.cwd(repoDir).addRemote('origin', `https://github.com/${TARGET_ORGANIZATION}/${repoName}.git`);
   await git.cwd(repoDir).push('origin', branchName);
   
   console.log(`Repository ${repoName} pushed successfully.`);
 } catch (error) {
   console.error(`Error pushing repository ${repoName}: ${error.message}`);
   process.exit(1);
 }
}

async function main() {
 try {
   const repoFilePath = path.join(INPUT_DIR, 'org.repos.json');
   const repos = readJSONFromFile(repoFilePath);

   for (const repo of repos) {
     const repoName = repo.name;
     const exists = await repositoryExists(repoName);

     if (!exists) {
       await createRepository(repoName);
     } else {
       console.log(`Repository ${repoName} already exists. Skipping creation.`);
     }

     const issuesFilePath = path.join(INPUT_DIR, `${repoName}.issues.json`);
     const issues = readJSONFromFile(issuesFilePath);
     await createIssues(repoName, issues);
     await pushRepository(repoName);
   }
   console.log(`Data uploading completed. All data is uploaded to the ${TARGET_ORGANIZATION} organization.`);
 } catch (error) {
   console.error(`Unexpected error: ${error.message}`);
   process.exit(1);
 }
}

main();
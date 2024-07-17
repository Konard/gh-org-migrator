#!/bin/bash

# Function to get user input with a prompt
get_input() {
    read -p "$1: " input
    echo "$input"
}

# Get GitHub personal access token
echo "Please provide your GitHub personal access token. Ensure it has the necessary permissions."
ACCESS_TOKEN=$(get_input "GitHub Personal Access Token")

# Get the organization name
ORGANIZATION=$(get_input "GitHub Organization Name")

# Create a directory to store the output
OUTPUT_DIR="github_org_data"
mkdir -p "$OUTPUT_DIR"

# Fetch all repositories
echo "Fetching repositories for organization $ORGANIZATION..."
curl -s -H "Authorization: token $ACCESS_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     "https://api.github.com/orgs/$ORGANIZATION/repos?per_page=100" > "$OUTPUT_DIR/org_repos.json"

# Extract repository names
REPO_NAMES=$(jq -r '.[].name' "$OUTPUT_DIR/org_repos.json")

# Fetch issues for each repository
echo "Fetching issues for each repository..."
for REPO in $REPO_NAMES; do
  echo "Fetching issues for repository $REPO..."
  curl -s -H "Authorization: token $ACCESS_TOKEN" \
       -H "Accept: application/vnd.github.v3+json" \
       "https://api.github.com/repos/$ORGANIZATION/$REPO/issues?per_page=100" > "$OUTPUT_DIR/${REPO}_issues.json"
done

echo "Data fetching completed. All data is stored in the $OUTPUT_DIR directory."
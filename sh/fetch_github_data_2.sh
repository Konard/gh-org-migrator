#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
else
    echo ".env file not found! Please create one with ACCESS_TOKEN and ORGANIZATION."
    exit 1
fi

# Check if ACCESS_TOKEN and ORGANIZATION are set
if [ -z "$ACCESS_TOKEN" ] || [ -z "$ORGANIZATION" ]; then
    echo "ACCESS_TOKEN and ORGANIZATION must be set in the .env file."
    exit 1
fi

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
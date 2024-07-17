import os
import json
from github import Github
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

ACCESS_TOKEN = os.getenv('ACCESS_TOKEN')
ORGANIZATION = os.getenv('ORGANIZATION')

if not ACCESS_TOKEN or not ORGANIZATION:
    print("ACCESS_TOKEN and ORGANIZATION must be set in the .env file.")
    exit(1)

# Initialize PyGitHub
g = Github(ACCESS_TOKEN)

# Create a directory to store the output
OUTPUT_DIR = os.path.join(os.getcwd(), 'data', ORGANIZATION)
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def fetch_repositories():
    repos = []
    try:
        print(f"Fetching repositories for organization {ORGANIZATION}...")
        org = g.get_organization(ORGANIZATION)
        repos = org.get_repos()
        
        repo_list = []
        for repo in repos:
            repo_list.append(repo.name)

        with open(os.path.join(OUTPUT_DIR, 'orgrepos.json'), 'w') as f:
            json.dump([repo.raw_data for repo in repos], f, indent=2)

        return repo_list
    except Exception as e:
        print("Error fetching repositories:", e)
        exit(1)

def fetch_issues(repo_name):
    issues = []
    try:
        print(f"Fetching issues for repository {repo_name}...")
        repo = g.get_repo(f"{ORGANIZATION}/{repo_name}")
        issues = repo.get_issues(state='all')
        
        issues_list = []
        for issue in issues:
            issues_list.append(issue.raw_data)

        with open(os.path.join(OUTPUT_DIR, f'{repo_name}.issues.json'), 'w') as f:
            json.dump(issues_list, f, indent=2)
    except Exception as e:
        print(f"Error fetching issues for repository {repo_name}:", e)

def main():
    repo_names = fetch_repositories()

    for repo_name in repo_names:
        fetch_issues(repo_name)

    print(f"Data fetching completed. All data is stored in the {OUTPUT_DIR} directory.")

if __name__ == "__main__":
    main()
use std::env;
use std::fs;
use std::path::Path;
use dotenv::dotenv;
use octocrab::{Octocrab, models};
use serde_json::to_string_pretty;

#[tokio::main]
async fn main() {
    dotenv().ok();

    let GITHUB_ACCESS_TOKEN = env::var("GITHUB_ACCESS_TOKEN").expect("GITHUB_ACCESS_TOKEN must be set in .env file.");
    let organization = env::var("ORGANIZATION").expect("ORGANIZATION must be set in .env file.");

    let octocrab = Octocrab::builder().personal_token(GITHUB_ACCESS_TOKEN).build().unwrap();

    let output_dir = format!("{}/data/{}", env::current_dir().unwrap().display(), &organization);
    fs::create_dir_all(&output_dir).expect("Failed to create output directory.");

    let repo_names = fetch_repositories(&octocrab, &organization, &output_dir).await;

    for repo_name in repo_names {
        fetch_issues(&octocrab, &organization, &repo_name, &output_dir).await;
    }

    println!("Data fetching completed. All data is stored in the {} directory.", output_dir);
}

async fn fetch_repositories(octocrab: &Octocrab, organization: &str, output_dir: &str) -> Vec<String> {
    let mut page = octocrab
        .orgs(organization)
        .list_repos()
        .per_page(100)
        .send()
        .await
        .expect("Failed to fetch repositories.");

    let mut repos: Vec<models::Repository> = Vec::new();

    loop {
        repos.extend(page.take_items());
        if let Some(next_page) = page.next {
            page = octocrab.get_page(&next_page).await.expect("Failed to fetch next page of repositories.");
        } else {
            break;
        }
    }

    let repo_names: Vec<String> = repos.iter().map(|repo| repo.name.clone()).collect();
    let repos_json = to_string_pretty(&repos).expect("Failed to serialize repositories.");
    fs::write(format!("{}/orgrepos.json", output_dir), repos_json).expect("Failed to write orgrepos.json.");

    repo_names
}

async fn fetch_issues(octocrab: &Octocrab, organization: &str, repo_name: &str, output_dir: &str) {
    let mut page = octocrab
        .issues(organization, repo_name)
        .list()
        .per_page(100)
        .send()
        .await
        .expect("Failed to fetch issues.");

    let mut issues: Vec<models::issues::Issue> = Vec::new();

    loop {
        issues.extend(page.take_items());
        if let Some(next_page) = page.next {
            page = octocrab.get_page(&next_page).await.expect("Failed to fetch next page of issues.");
        } else {
            break;
        }
    }

    let issues_json = to_string_pretty(&issues).expect("Failed to serialize issues.");
    fs::write(format!("{}/{}.issues.json", output_dir, repo_name), issues_json).expect("Failed to write issues json.");
}
# gh-org-migrator (GitHub Organization Migrator)
A tool to migrate organization

# JavaScript version (the only one recommended at the moment)

1. Create .env file:

```bash
touch .env
nano .env
```

```env
GITHUB_ACCESS_TOKEN=
GITFLIC_ACCESS_TOKEN=
SOURCE_ORGANIZATION=deep-foundation
TARGET_ORGANIZATION=link-foundation
```

2. Download data from source organization

```bash
node js/download.js
```

3. Upload data to target organization

```bash
node js/upload.js
```

## Push repositories

```bash
node ./js/push-repositories.js 2>&1 | tee push-repositories.log.txt
```

```bash
node ./js/push-repositories.js > >(tee -a push-repositories.stdout.log.txt) 2> >(tee -a push-repositories.stderr.log.txt >&2)
```

## Push repositories to GitFlic

```bash
node ./js/push-repositories-to-gitflic.js 2>&1 | tee push-repositories-to-gitflic.log.txt
```

```bash
node ./js/push-repositories-to-gitflic.js > >(tee -a push-repositories-to-gitflic.stdout.log.txt) 2> >(tee -a push-repositories-to-gitflic.stderr.log.txt >&2)
```

## Push issues

```bash
node ./js/push-issues.js 2>&1 | tee push-issues.log.txt
```

```bash
node ./js/push-issues.js > >(tee -a push-issues.stdout.log.txt) 2> >(tee -a push-issues.stderr.log.txt >&2)
```

## Push code commits

```bash
node ./js/push-code-commits.js 2>&1 | tee push-code-commits.log.txt
```

```bash
node ./js/push-code-commits.js > >(tee -a push-code-commits.stdout.log.txt) 2> >(tee -a push-code-commits.stderr.log.txt >&2)
```

# Python dependencies

```bash
pip3 install PyGithub python-dotenv
```

# gh-org-migrator (GitHub Organization Migrator)
A tool to migrate organization

# JavaScript version (the only one recommended at the moment)

1. Create .env file:

```bash
touch .env
nano .env
```

```env
ACCESS_TOKEN=
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

# Python dependencies

```bash
pip3 install PyGithub python-dotenv
```

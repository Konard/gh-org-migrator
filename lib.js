import fs from "fs";

export const readJSON = (filePath) => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } else {
    throw new Error(`File not found: ${filePath}`);
  }
};

export const sleep = async (ms) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

export const gitFlicifyRepositoryName = (repositoryName) => {
  // Replace invalid characters with dashes, but keep alphanumeric, underscores, and existing dashes
  let cleanName = repositoryName.replaceAll(/[^a-zа-я0-9_\-]/gi, '-');

  // Remove consecutive dashes
  cleanName = cleanName.replace(/-+/g, '-');

  // Remove leading and trailing dashes
  cleanName = cleanName.replace(/^-+|-+$/g, '');

  // Handle edge case where the name becomes empty
  if (cleanName === '') {
    cleanName = 'unnamed-repo';
  }

  return cleanName;
}
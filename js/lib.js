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

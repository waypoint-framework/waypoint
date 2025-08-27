import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const repoUrl = process.env.REPO_URL as string;
export const projectRoot = process.env.PROJECT_ROOT as string;
export const accessToken = process.env.ACCESS_TOKEN as string;

if (!repoUrl || !projectRoot) {
  throw new Error('REPO_URL and PROJECT_ROOT must be set in .env file');
}

if (!accessToken) {
  throw new Error('ACCESS_TOKEN must be set in .env file');
}
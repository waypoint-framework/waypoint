import crypto from 'crypto';
import { logger } from './logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { projectRoot } from '../config';

export interface Artifact {
    fileName: string;
    ensemble?: 'json' | 'md'
}



export interface Dependency {
    from: string;
    to: string;
}

export interface ArtificerConfig {
    artifacts: Artifact[];
    dependencies: Dependency[];
}

export type ArtifactHashes = Record<string, FileHashes>;

export interface FileHashes {
    current: string;
    [dependency: string]: string;
}

export async function readArtificerConfig(): Promise<ArtificerConfig> {
    try {
        const configPath = path.join(projectRoot, 'artificer.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        logger.info('Read artificer.json configuration');
        return JSON.parse(configData);
    } catch (error) {
        logger.error(`Failed to read artificer.json: ${error}`);
        throw error;
    }
}

export async function readArtifactHashes(): Promise<ArtifactHashes> {
    try {
        const configPath = path.join(projectRoot, 'artifact-hashes.json');
        let createFile = false
        let configData = '';
        try {
            configData = await fs.readFile(configPath, 'utf-8');
            if (!configData) {
                createFile = true
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                createFile = true
            } else {
                throw error;
            }
        }
        if (createFile) {
            // File doesn't exist, create an empty JSON object
            configData = '{}';
            await fs.writeFile(configPath, configData, 'utf-8');
            logger.info('Created empty artifact-hashes.json file');
        }
        const result = JSON.parse(configData);
        logger.info('Read artifact-hashes.json');
        return result
    } catch (error) {
        logger.error(`Failed to read or create artifact-hashes.json: ${error}`);
        throw error;
    }
}

export async function writeArtifactHashes(hashes: ArtifactHashes): Promise<void> {
    const configPath = path.join(projectRoot, 'artifact-hashes.json');
    await fs.writeFile(configPath, JSON.stringify(hashes, null, 2), 'utf-8');
    logger.info('Updated artifact-hashes.json');
}

export async function writeArtificerConfig(config: ArtificerConfig): Promise<void> {
    const configPath = path.join(projectRoot, 'artificer.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    logger.info('Updated artificer.json');
}

export async function generateFileHash(filePath: string): Promise<string> {
    try {
        const content = await fs.readFile(filePath);
        return generateBasicHash(content);
    } catch (error) {
        logger.error(`Failed to generate hash for file ${filePath}: ${error}`);
        throw error;
    }
}

export async function generateBasicHash(content: any): Promise<string> {
    try {
        return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error: any) {
        logger.error(`Failed to generate hash: ${error}`);
        throw new Error(`Hash generation failed: ${error.message}`);
    }
}

export async function checkForUpdates(hashes: ArtifactHashes): Promise<Set<string>> {
    const updatedFiles = new Set<string>();

    const staticDir = path.join(projectRoot, 'static');
    for (const fileName of await fs.readdir(staticDir)) {
        const filePath = path.join(staticDir, fileName);
        const currentHash = await generateFileHash(filePath);

        if (!hashes[fileName] || hashes[fileName].current !== currentHash) {
            updatedFiles.add(fileName);
            hashes[fileName] = { current: currentHash };
        }
    }

    logger.info(`${updatedFiles.size} Static files updated: ${Array.from(updatedFiles).join(', ')}`);
    return updatedFiles;
}

export async function ensureDependency(to: string, froms: string[], config: ArtificerConfig): Promise<void> {
    // Get existing dependencies for the given 'to'
    const existingDependencies = config.dependencies.filter(dep => dep.to === to);
    const existingFroms = existingDependencies.map(dep => dep.from);
  
    // Add new dependencies for each 'from' that doesn't already exist
    for (const from of froms) {
      if (!existingFroms.includes(from)) {
        config.dependencies.push({ from, to });
      }
    }
  
    // Ensure all 'from' artifacts exist in the config
    for (const from of froms) {
      if (!config.artifacts.some(artifact => artifact.fileName === from)) {
        config.artifacts.push({ fileName: from });
      }
    }
  }
  
  export async function ensureArtifact(fileName: string, config: ArtificerConfig): Promise<void> {
    if (!config.artifacts.some(artifact => artifact.fileName === fileName)) {
      config.artifacts.push({ fileName });
    }
  }

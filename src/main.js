var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import toposort from 'toposort';
import { HandlebarsPromptTemplate } from "langchain/experimental/prompts/handlebars";
import * as git from 'isomorphic-git';
import { OpenAI } from "@langchain/openai";
import http from 'isomorphic-git/http/node';
import winston from 'winston';
import crypto from 'crypto';
// Load environment variables
dotenv.config();
const repoUrl = process.env.REPO_URL;
const projectRoot = process.env.PROJECT_ROOT;
if (!repoUrl || !projectRoot) {
    throw new Error('REPO_URL and PROJECT_ROOT must be set in .env file');
}
// Set up Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level}]: ${message}`;
    })),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'artificer.log' })
    ]
});
function readArtificerConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const configPath = path.join(projectRoot, 'artificer.json');
            const configData = yield fs.readFile(configPath, 'utf-8');
            return JSON.parse(configData);
        }
        catch (error) {
            logger.error(`Failed to read artificer.json: ${error}`);
            throw error;
        }
    });
}
function generateFileHash(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const content = yield fs.readFile(filePath);
        return crypto.createHash('sha256').update(content).digest('hex');
    });
}
function checkForUpdates(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const updatedFiles = new Set();
        const staticDir = path.join(projectRoot, 'static');
        for (const fileName of yield fs.readdir(staticDir)) {
            const filePath = path.join(staticDir, fileName);
            const currentHash = yield generateFileHash(filePath);
            if (!config.hashes[fileName] || config.hashes[fileName].current !== currentHash) {
                updatedFiles.add(fileName);
                config.hashes[fileName] = { current: currentHash };
            }
        }
        logger.info(`Static files updated: ${Array.from(updatedFiles).join(', ')}`);
        return updatedFiles;
    });
}
function propagateUpdates(updatedFiles, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const graph = config.dependencies.map(dep => [dep.from, dep.to]);
        const sortedFiles = toposort(graph).reverse();
        for (const fileName of sortedFiles) {
            const dependencies = config.dependencies.filter(dep => dep.to === fileName);
            let needsUpdate = dependencies.some(dep => updatedFiles.has(dep.from));
            if (needsUpdate || updatedFiles.has(fileName)) {
                const artifact = config.artifacts.find(a => a.fileName === fileName);
                if (artifact) {
                    yield generateArtifact(artifact, config);
                    const filePath = path.join(projectRoot, 'outputs', fileName);
                    const currentHash = yield generateFileHash(filePath);
                    config.hashes[fileName] = Object.assign({ current: currentHash }, Object.fromEntries(dependencies.map(dep => [dep.from, config.hashes[dep.from].current])));
                    updatedFiles.add(fileName);
                    logger.info(`Updated artifact: ${fileName}`);
                }
            }
        }
    });
}
function generateArtifact(artifact, config) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const templatePath = path.join(projectRoot, 'prompts', `${path.parse(artifact.fileName).name}.hbs`);
            const templateContent = yield fs.readFile(templatePath, 'utf-8');
            const dependencies = config.dependencies.filter(dep => dep.to === artifact.fileName);
            const templateData = {};
            for (const dep of dependencies) {
                const depPath = path.join(projectRoot, 'outputs', dep.from);
                const staticPath = path.join(projectRoot, 'static', dep.from);
                try {
                    templateData[dep.from] = yield fs.readFile(depPath, 'utf-8');
                }
                catch (_a) {
                    templateData[dep.from] = yield fs.readFile(staticPath, 'utf-8');
                }
            }
            const prompt = HandlebarsPromptTemplate.fromTemplate(templateContent);
            const formattedPrompt = yield prompt.format(templateData);
            const model = new OpenAI();
            const generatedContent = yield model.call(formattedPrompt);
            const outputPath = path.join(projectRoot, 'outputs', artifact.fileName);
            yield fs.writeFile(outputPath, generatedContent);
            // Generate hash for the new artifact
            const artifactHash = yield generateFileHash(outputPath);
            // Update the config with the new hash
            if (!config.hashes[artifact.fileName]) {
                config.hashes[artifact.fileName] = { current: artifactHash };
            }
            else {
                config.hashes[artifact.fileName].current = artifactHash;
            }
            // Update artificer.json file
            const artificerConfigPath = path.join(projectRoot, 'artificer.json');
            yield fs.writeFile(artificerConfigPath, JSON.stringify(config, null, 2));
            logger.info(`Updated hash for artifact: ${artifact.fileName}`);
            logger.info(`Generated artifact: ${artifact.fileName}`);
        }
        catch (error) {
            logger.error(`Failed to generate artifact ${artifact.fileName}: ${error}`);
            throw error;
        }
    });
}
function commitAndPush() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const status = yield git.statusMatrix({ fs, dir: projectRoot });
            const changedFiles = status
                .filter(([, , worktreeStatus]) => worktreeStatus !== 1)
                .map(([filepath]) => filepath);
            if (changedFiles.length === 0) {
                logger.info('No changes to commit');
                return;
            }
            yield git.add({ fs, dir: projectRoot, filepath: 'outputs' });
            yield git.add({ fs, dir: projectRoot, filepath: 'hashes.json' });
            const commitMessage = new Date().toISOString();
            yield git.commit({
                fs,
                dir: projectRoot,
                message: commitMessage,
                author: { name: 'Artificer', email: 'artificer@example.com' }
            });
            logger.info(`Committed changes with message: ${commitMessage}`);
            yield git.push({
                fs,
                http,
                dir: projectRoot,
                remote: 'origin',
                ref: 'main',
            });
            logger.info('Pushed changes to remote repository');
        }
        catch (error) {
            logger.error(`Failed to commit and push changes: ${error}`);
            throw error;
        }
    });
}
function resetToHead() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            //await git.reset({ fs, dir: projectRoot, ref: 'HEAD', hard: true });
            logger.info('Reset working directory to HEAD');
        }
        catch (error) {
            logger.error(`Failed to reset working directory: ${error}`);
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger.info('Starting Artificer');
            const config = yield readArtificerConfig();
            logger.info('Read artificer.json configuration');
            const updatedFiles = yield checkForUpdates(config);
            yield propagateUpdates(updatedFiles, config);
            yield fs.writeFile(path.join(projectRoot, 'hashes.json'), JSON.stringify(config.hashes, null, 2));
            logger.info('Updated hashes.json');
            yield commitAndPush();
            logger.info('Artificer completed successfully');
        }
        catch (error) {
            logger.error(`Artificer failed: ${error}`);
            yield resetToHead();
            process.exit(1);
        }
    });
}
main();

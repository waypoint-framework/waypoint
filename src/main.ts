import * as fs from 'fs/promises';
import * as path from 'path';
import toposort from 'toposort';
import { HandlebarsPromptTemplate } from "langchain/experimental/prompts/handlebars";
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import { Artifact, ArtifactHashes, ArtificerConfig, checkForUpdates, generateBasicHash, generateFileHash, readArtifactHashes, readArtificerConfig, writeArtifactHashes, writeArtificerConfig } from './utils/configUtils';
import { logger } from './utils/logger';
import { accessToken, projectRoot } from './config';
import { processJsonEnsemble } from './utils/ensemble';
import { extractAndParseJson } from './utils/parsing';
import { generateContent } from './utils/llm';
import { FilePromptGraph } from './graphs/FilePromptGraph';

// TODO REDO all the logic here
async function propagateUpdates(updatedFiles: Set<string>, config: ArtificerConfig, hashes: ArtifactHashes): Promise<void> {
  const graph = config.dependencies.map(dep => [dep.from, dep.to] as [string, string]);
  const sortedFiles = toposort(graph); 
  logger.info(`Propagating updates for ${sortedFiles.length} files in the following order: \n - ${sortedFiles.join('\n - ')}`);
  for (const fileName of sortedFiles) {
    const dependencies = config.dependencies.filter(dep => dep.to === fileName);
    let needsUpdate = !hashes[fileName] || dependencies.some(dep => 
      updatedFiles.has(dep.from) || 
      (hashes[fileName][dep.from] !== hashes[dep.from]?.current)
    );

    if (dependencies.some((dep: any) => config.artifacts[dep.from] && config.artifacts[dep.from].ensemble)) {
      needsUpdate = false;
      logger.info(`Skipping update for ${fileName} because it comes from an ensemble`);
    }

    if (needsUpdate || updatedFiles.has(fileName)) {
      const artifact = config.artifacts.find(a => a.fileName === fileName);
      if (artifact) {
        const {fileName, content, hash} = await generateArtifact(artifact, config, hashes);
        if (artifact.ensemble == "json") {
          const contentJson = extractAndParseJson(content);
          const newArtifacts = await processJsonEnsemble(fileName, contentJson, hash, hashes, config);
          newArtifacts.forEach(newArtifact => updatedFiles.add(newArtifact));
        } else {
          updatedFiles.add(fileName);
        }
        logger.info(`Updated artifact: ${fileName}`);
      }
    }
  }
}


async function generateArtifact(artifact: Artifact, config: ArtificerConfig, hashes: ArtifactHashes): Promise<{
  fileName: string, hash: string, content: string
}> {
  try {
    const templatePath = path.join(projectRoot, 'prompts', `${path.parse(artifact.fileName).name}.hbs`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');

    const dependencies = config.dependencies.filter(dep => dep.to === artifact.fileName);
    const templateData: Record<string, string> = {};

    for (const dep of dependencies) {
      const depPath = path.join(projectRoot, 'outputs', dep.from);
      const staticPath = path.join(projectRoot, 'static', dep.from);
      const fileNameWithoutExt = path.parse(dep.from).name;
      try {
        templateData[fileNameWithoutExt] = await fs.readFile(depPath, 'utf-8');
      } catch {
        templateData[fileNameWithoutExt] = await fs.readFile(staticPath, 'utf-8');
      }
    }

    const prompt = HandlebarsPromptTemplate.fromTemplate(templateContent)

    const formattedPrompt = await prompt.format(templateData);
    
    const generatedContent = await generateContent(artifact, formattedPrompt);

    const outputDir = path.join(projectRoot, 'outputs');
    await fs.mkdir(outputDir, { recursive: true }); // Ensure the outputs directory exists
    const outputPath = path.join(outputDir, artifact.fileName);
    await fs.writeFile(outputPath, generatedContent);

    // Generate hash for the new artifact
    const artifactHash = await generateFileHash(outputPath);

    // Update the config with the new hash
    if (!hashes[artifact.fileName]) {
      hashes[artifact.fileName] = { current: artifactHash };
    } else {
      hashes[artifact.fileName].current = artifactHash;
    }
    
    // Include hashes of dependencies
    for (const dep of dependencies) {
      if (hashes[dep.from]) {
        hashes[artifact.fileName][dep.from] = hashes[dep.from].current;
      }
    }
    logger.info(`Updated hash for artifact: ${artifact.fileName}`);

    logger.info(`Generated artifact: ${artifact.fileName}`);
    return {fileName: artifact.fileName, hash: artifactHash, content: generatedContent}
  } catch (error) {
    logger.error(`Failed to generate artifact ${artifact.fileName}: ${error}`);
    throw error;
  }
}

async function commitAndPush(): Promise<void> {
  try {
    const status = await git.statusMatrix({ fs, dir: projectRoot });
    const changedFiles = status
      .filter(([, , worktreeStatus]) => worktreeStatus !== 1)
      .map(([filepath]) => filepath);

    if (changedFiles.length === 0) {
      logger.info('No changes to commit');
      return;
    }

    await git.add({ fs, dir: projectRoot, filepath: 'outputs' });
    await git.add({ fs, dir: projectRoot, filepath: 'artifact-hashes.json' });
    await git.add({ fs, dir: projectRoot, filepath: 'artificer.json' });
    
    const commitMessage = new Date().toISOString();
    await git.commit({
      fs,
      dir: projectRoot,
      message: commitMessage,
      author: { name: 'Artificer', email: 'artificer@example.com' }
    });

    logger.info(`Committed changes with message: ${commitMessage}`);

    try {
      await git.push({
        fs,
        http,
        dir: projectRoot,
        remote: 'origin',
        ref: 'master',
        onAuth: () => ({ username: 'x-access-token', password: accessToken }),
      });

      logger.info('Pushed changes to remote repository');
    } catch (error) {
      logger.error(`Failed to push changes to remote repository: ${error}`);
      throw error;
    }
  } catch (error) {
    logger.error(`Failed to commit and push changes: ${error}`);
    throw error;
  }
}

async function resetToHead(): Promise<void> {
  try {
    //await git.reset({ fs, dir: projectRoot, ref: 'HEAD', hard: true });
    logger.info('Reset working directory to HEAD');
  } catch (error) {
    logger.error(`Failed to reset working directory: ${error}`);
  }
}

async function oldMain() {
  try {
    logger.info('Starting Artificer');

    // Read Config
    const config = await readArtificerConfig();
    const initialConfigHash = await generateBasicHash(JSON.stringify(config));
    const hashes = await readArtifactHashes();
    const initialHashesHash = await generateBasicHash(JSON.stringify(hashes));

    // Perform artifact updates
    const updatedFiles = await checkForUpdates(hashes);
    await propagateUpdates(updatedFiles, config, hashes);


    // Write updated hashes and config back to file
    const currentHashesHash = await generateBasicHash(JSON.stringify(hashes));
    if (currentHashesHash !== initialHashesHash) {
      await writeArtifactHashes(hashes);
    } else {
      logger.info('No changes to artifact-hashes.json');
    }
    const currentConfigHash = await generateBasicHash(JSON.stringify(config));
    if (currentConfigHash !== initialConfigHash) {
      await writeArtificerConfig(config);
    } else {
      logger.info('No changes to artificer.json');
    }

    // Commit and push changes
    await commitAndPush();

    logger.info('Artificer completed successfully');
  } catch (error) {
    logger.error(`Artificer failed: ${error}`);
    await resetToHead();
    process.exit(1);
  }
}

async function main() {
  logger.info('Starting Artificer');


  const promptGraph = new FilePromptGraph(`${projectRoot}/prompts`)



  logger.info('Artificer completed successfully', promptGraph);

}

main();

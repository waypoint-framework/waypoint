import * as path from 'path';
import * as fs from 'fs/promises';
import { projectRoot } from '../config';
import { logger } from './logger';
import { OpenAI } from "@langchain/openai";

import {Artifact, generateBasicHash} from './configUtils';

  
export async function generateContent(artifact: Artifact, formattedPrompt: string): Promise<string> {
    const inputHash = await generateBasicHash(formattedPrompt);

    const inputFilePath = path.join(projectRoot, 'generations', `${artifact.fileName}.${inputHash}.input.md`);
    const outputFilePath = path.join(projectRoot, 'generations', `${artifact.fileName}.${inputHash}.output.txt`);
    try {
        await fs.access(inputFilePath);
        await fs.access(outputFilePath);
        logger.warn(`Using cached output for generation input: ${inputFilePath}`);
        try {
            return await fs.readFile(outputFilePath, 'utf-8');
        } catch (error) {
            logger.error(`Error reading cached output for ${artifact.fileName}: ${error}`);
            logger.warn(`Regenerating ${artifact.fileName} with recognised input hash`);
        }    } catch (error) {
            logger.debug(`No cached output for ${artifact.fileName} with input hash ${inputHash}`);
        // If either file doesn't exist, we'll continue with the generation process
    }

    const model = new OpenAI({
      model: "gpt-4o",
      maxTokens: undefined,
      timeout: undefined,
      maxRetries: 2,
    });
    logger.info(`Generating content for ${artifact.fileName}`);
    const generatedContent = await model.call(formattedPrompt);

    logger.info(`Successfully generated content for ${artifact.fileName}`);

    await fs.writeFile(outputFilePath, generatedContent);
    await fs.writeFile(inputFilePath, formattedPrompt);
    logger.info(`Saved generation input and output: ${inputFilePath} and ${outputFilePath}`);

    return generatedContent;
}
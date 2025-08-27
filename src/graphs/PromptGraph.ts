import { HandlebarsPromptTemplate } from "langchain/experimental/prompts/handlebars";
import { logger } from '../utils/logger';
import { Graph, NodeType, NodeKey } from './Graph';

/**
 * PromptGraphs define a graph of prompts, where each prompt can depend on other prompts. They act as a 
 * factory for ArtifactGraphs, and a way to manage their updates. 
 * 
 * External nodes are in markdown format and can be referenced in LLM node prompts. 
 * LLM nodes are in HBS format, can reference any node, and represent a prompt to pass into an LLM.
 * Extraction nodes are in JSON format, and define a JMSEPath which extracts data from 
 */
export abstract class PromptGraph extends Graph {
    async processLLMNodeUpdate(promptKey: NodeKey) {
        const prompts = await this.getNodes();
        const templateContent = prompts[promptKey].content;
        const template = HandlebarsPromptTemplate.fromTemplate(templateContent);

        for (const param of template.inputVariables) {
            const paramContent = prompts[param];
            if (paramContent) {
                const paramHash = this.hashes[param].current;
                this.hashes[promptKey][param] = paramHash;
            } else {
                logger.error(`Dependency ${param} not found for template ${promptKey}.`);
            }
        }
    }

    async processExtractionNodeUpdate(promptKey: NodeKey) {
        const prompts = await this.getNodes();
        const promptContent = prompts[promptKey];

        if (!promptContent) {
            logger.error(`Prompt content not found for extraction ${promptKey}.`);
            return;
        }

        const { source } = JSON.parse(promptContent.content);

        const sourcePrompt = prompts[source];
        if (sourcePrompt) {
            if (prompts[source].type === NodeType.EXTERNAL) {
                logger.error(`Invalid source prompt type ${source} for extraction ${promptKey}.`);
                return;
            }
            const sourceHash = this.hashes[source].current;
            this.hashes[promptKey][source] = sourceHash;
        } else {
            logger.error(`Source prompt ${source} not found for extraction ${promptKey}.`);
        }
    }
}

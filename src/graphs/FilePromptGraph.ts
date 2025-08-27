
import * as fs from 'fs/promises';
import * as path from 'path';
import { PromptGraph } from './PromptGraph';
import { NodeContentType } from "./Graph";
import { Node } from './Graph';
import { NodeType } from './Graph';
import { generateFileHash } from '../utils/configUtils';
import { logger } from '../utils/logger';


export class FilePromptGraph extends PromptGraph {
    private files: string[] = [];
    private lockPath: string = '';

    constructor(private promptDir: string) {
        super({promptDir});
    }

    async setup() {
        this.files = await fs.readdir(this.options.promptDir);
        this.lockPath = path.join(this.promptDir, 'prompts.lock');
    }

    async getNodes(): Promise<Record<string, Node>> {
        const prompts: Record<string, Node> = {};
        for (const file of this.files) {
            if (file !== 'prompts.lock') {
                const filePath = path.join(this.promptDir, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const fileName = path.parse(file).name;
                const extension = path.extname(file);
                
                let promptType: NodeType;
                let promptContentType: NodeContentType;
                switch (extension) {
                    // TODO at some point we'll be able to mix and match prompt type and content type
                    case '.md':
                        promptType = NodeType.EXTERNAL;
                        promptContentType = NodeContentType.MD;
                        break;
                    case '.json':
                        promptType = NodeType.EXTRACTION;
                        promptContentType = NodeContentType.JSON;
                        break;
                    case '.hbs':
                        promptType = NodeType.LLM;
                        promptContentType = NodeContentType.HBS;
                        break;
                    default:
                        continue; // Skip files with unknown extensions
                }

                prompts[fileName] = {
                    key: fileName,
                    type: promptType,
                    content: content, 
                    contentType: promptContentType
                };
            }
        }
        return prompts;
    }

    async determineNewHashes(): Promise<void> {
        const newHashes: Record<string, any> = {};

        // Generate hashes for all files
        for (const file of this.files) {
            if (file !== 'prompts.lock') {
                const filePath = path.join(this.promptDir, file);
                const hash = await generateFileHash(filePath);
                const fileName = path.parse(file).name;
                newHashes[fileName] = { current: hash };
            }
        }
        this.hashes = newHashes;
    }

    async determinePreviousHashes(): Promise<void> {
        // Load and compare with prompts.lock
        let previousHashes: Record<string, any> = {};
        try {
            const lockContent = this.files.find(file => file === 'prompts.lock') as string;
            previousHashes = JSON.parse(lockContent);
        } catch (error) {
            logger.warn('prompts.lock not found or invalid. Treating all files as new.');
        }
        this.previousHashes = previousHashes;
    }

    async persistHashes(): Promise<void> {
        await fs.writeFile(this.lockPath, JSON.stringify(this.hashes, null, 2));
    }
}

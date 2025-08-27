

import { logger } from './logger';

/**
 * Extracts and parses JSON from a string enclosed in ```json and ``` tags.
 * @param input The input string containing JSON within code blocks.
 * @returns The parsed JSON object, or null if parsing fails.
 */
export function extractAndParseJson(input: string): any | null {
    try {
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = input.match(jsonRegex);
        
        if (match && match[1]) {
            const jsonString = match[1].trim();
            return JSON.parse(jsonString);
        } else {
            logger.warn('No JSON found within ```json code blocks');
            return null;
        }
    } catch (error) {
        logger.error(`Failed to parse JSON: ${error}`);
        return null;
    }
}

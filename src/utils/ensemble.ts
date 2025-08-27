import fs from 'fs/promises';
import path from 'path';
import { ArtifactHashes, ArtificerConfig, ensureArtifact, ensureDependency, generateBasicHash } from './configUtils';
import { projectRoot } from '../config';


export async function processJsonEnsemble(ensembleName: string, ensembleContent: Record<string, any>, ensembleHash: string, hashes: ArtifactHashes, config: ArtificerConfig): Promise<string[]> {
  const newArtifacts: string[] = [];

  for (const [fieldName, nestedObject] of Object.entries(ensembleContent)) {
    if (typeof nestedObject === 'object' && nestedObject !== null) {
      const artifactName = `${fieldName}.json`;
      const artifactContent = JSON.stringify(nestedObject, null, 2);
      
      // Save the nested object as a separate artifact
      const outputDir = path.join(projectRoot, 'outputs');
      await fs.mkdir(outputDir, { recursive: true }); // Ensure the outputs directory exists
      const outputPath = path.join(outputDir, artifactName);
      await fs.writeFile(outputPath, artifactContent);

      // Calculate hash for the new artifact
      const artifactHash = await generateBasicHash(artifactContent);

      // Update artificer-hashes.json
      hashes[artifactName] = {current: artifactHash, [ensembleName]: ensembleHash}

      ensureArtifact(artifactName, config);
      ensureDependency(artifactName, [ensembleName], config);

      // Add to newArtifacts array for updating artificer.json
      newArtifacts.push(artifactName);
    }
  }
  return newArtifacts
}




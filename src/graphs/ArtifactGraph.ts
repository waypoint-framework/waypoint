import { FlowJob } from "bullmq";
import { generateBasicHash } from "../utils/configUtils";
import { FlowDetails, Graph, NodeKey, NodeUpdate } from "./Graph";
import {v4} from "uuid"


export abstract class ArtifactGraph extends Graph {

    /** Artifact Graph Revision ID */
    protected agrID: uuid; 

    constructor(agrID?: uuid) {
        super()
        this.agrID = agrID || v4()
    }

    public getagrID(): string {
        return this.agrID;
    }

    processLLMNodeUpdate(promptKey: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    processExtractionNodeUpdate(promptKey: string): Promise<void> {
        throw new Error("Method not implemented.");
    }

    createUpdateFlow(details: FlowDetails, extraJobData?: (nodeKey: NodeKey, updates: NodeUpdate) => object): FlowJob {
        return super.createUpdateFlow(details, extraJobData || (() => ({agrID: this.agrID})))
    }

    /**
     * Determines the new hashes based on current node data. 
     * 
     * Although artifact graphs contain node data, 
     * they don't have a process for calculating dependency updates like PromptGraphs due. Instead, they rely
     * on the PromptGraph they're derived from to provide & persist dependency information on initial fabrication 
     * of the artifact graph. From then on, it assumes dependencies don't change (although dependant nodes propagate invalidations)
     * for the lifecycle of that artifact graph. If deriving PromptGraph dependencies change, the ArtifactGraph will then 
     * be refabricated. 
     */
    async determineNewHashes(): Promise<void> {
        const newHashes: Record<string, any> = {};

        // Generate hashes for all nodes
        for (const node of Object.values(await this.getNodes())) {
            const hash = await generateBasicHash(node.content);
            newHashes[node.key] = { current: hash };
        }

        // Copy dependencies from previousHashes to newHashes 
        for (const [nodeKey, hashObj] of Object.entries(this.previousHashes)) {
            if (newHashes[nodeKey]) {
                for (const [depKey, depHash] of Object.entries(hashObj)) {
                    if (depKey !== 'current') {
                        newHashes[nodeKey][depKey] = newHashes[depKey]?.current || depHash;
                    }
                }
            }
        }

        this.hashes = newHashes;
    }
}


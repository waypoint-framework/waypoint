import { logger } from '../utils/logger';
import toposort from 'toposort';
import { FlowJob } from 'bullmq';

export enum NodeContentType {
    MD,
    JSON,
    HBS, 
    HTML, 
    JS,
}

export interface Node {
    key: NodeKey;
    type: NodeType;
    content: any;
    contentType: NodeContentType;
}
export type NodeUpdate = 
    | { type: 'NEW' }
    | { type: 'UPDATED'; previousHash: Hash }
    | { type: 'DELETED'; previousHash: Hash }
    | { type: 'INVALIDATED', previousHash: Hash, by: NodeKey, backPropagation?: boolean} // backProp for upstream node invalidation

export enum NodeType {
    EXTERNAL, // This is text provided externally, and is not dependent on other nodes
    LLM, // These nodes associated with LLM generations. Their nodes depend on other nodes
    EXTRACTION, // These are nodes that extract data from a source node
    // TODO TEMPLATE // These nodes use generated from static templates which can be dependent on other nodes
}

export type NodeKey = string
export type Hash = string

export type NodeHash = {
    current: Hash,
    [dependency: NodeKey]: Hash
}

export type NodeHashes = Record<NodeKey, NodeHash> 

export type FlowDetails = {
    name: string
    flowQueue: string
    nodeQueue: string
}

export type GraphOptions = {
    backPropagation?: boolean
} & any

/**
 * A graph is a collection of nodes and their dependencies. Graphs are 
 * regularly updated, and each version is hashed so we can track changes.
 */
export abstract class Graph {
    protected hashes: NodeHashes = {};
    protected previousHashes: NodeHashes = {};
    protected nodeUpdates: Record<NodeKey, NodeUpdate> = {};
    protected dependencies: [NodeKey, NodeKey][] = [];
    protected sortedNodes: NodeKey[] = [];
    protected options: GraphOptions; 

    abstract getNodes(): Promise<Record<string, Node>>;
    abstract determinePreviousHashes(): Promise<void>;
    abstract determineNewHashes(): Promise<void>;
    abstract setup(): Promise<void>;
    abstract persistHashes(): Promise<void>;
    abstract processLLMNodeUpdate(nodeKey: NodeKey): Promise<void>;
    abstract processExtractionNodeUpdate(nodeKey: NodeKey): Promise<void>;

    constructor(options: GraphOptions = {}) {
        this.options = options;
    }

    public getNodeUpdates(): Record<string, NodeUpdate> {
        return this.nodeUpdates;
    }

    public getDependencies(): [string, string][] {
        return this.dependencies;
    }

    public getSortedNodes(): string[] {
        return this.sortedNodes;
    }

    public getHashes(): Record<string, any> {
        return this.hashes;
    }

    public getDownstreamKeys(key: string): string[] {
        const downstream: string[] = [];
        const visited = new Set<string>();

        const depthFirstSearch = (currentKey: string) => {
            if (visited.has(currentKey)) return;
            visited.add(currentKey);

            for (const [dep, node] of this.dependencies) {
                if (dep === currentKey && node !== key) {
                    downstream.push(node);
                    depthFirstSearch(node);
                }
            }
        };

        depthFirstSearch(key);
        return this.sortedNodes.filter(node => downstream.includes(node));
    }

    public getUpstreamKeys(key: string): string[] {
        const upstream: string[] = [];
        const visited = new Set<string>();

        const depthFirstSearch = (currentKey: string) => {
            if (visited.has(currentKey)) return;
            visited.add(currentKey);

            for (const [dep, node] of this.dependencies) {
                if (node === currentKey && dep !== key) {
                    upstream.push(dep);
                    depthFirstSearch(dep);
                }
            }
        };

        depthFirstSearch(key);
        return this.sortedNodes.filter(node => upstream.includes(node));
    }

    /** 
     * Creates a flow for the entire graph to be traversed
     * 
     * See BullMQ Flow for more details: https://docs.bullmq.io/guide/flows
     */
    public createFullFlow(details: FlowDetails): FlowJob {
        const {name, flowQueue, nodeQueue} = details
        const flow: FlowJob = { name, queueName: flowQueue, children: [] };
        const nodeJobs: Record<string, FlowJob> = {};

        // Create a job for each node
        for (const nodeKey of Object.keys(this.hashes)) {
            nodeJobs[nodeKey] = {
                name: nodeKey,
                queueName: nodeQueue,
                opts: { jobId: nodeKey },
            };
        }

        // Set up dependencies
        flow.children = Object.entries(this.hashes).map(([nodeKey, hashObj]) => ({
            ...nodeJobs[nodeKey],
            children: Object.keys(hashObj)
                            .filter(key => key !== 'current')
                            .map(depKey => nodeJobs[depKey]) 
        }))

        return flow;
    }
    
    /** 
     * Creates a flow for a subgraph of the Graph, starting at startNode, and including upstream nodes or downstream nodes, depending
     * on direction
     * 
     * See BullMQ Flow for more details: https://docs.bullmq.io/guide/flows
     */
    public createFlow(startNode: NodeKey, direction: 'up' | 'down', details: FlowDetails): FlowJob {
        const {name, flowQueue, nodeQueue} = details
        const streamNodes = direction === 'up' 
            ? this.getUpstreamKeys(startNode)
            : this.getDownstreamKeys(startNode);
        const includedNodes = [startNode, ...streamNodes];

        const flow: FlowJob = { name, queueName: flowQueue, children: [] };
        const nodeJobs: Record<string, FlowJob> = {};

        // Create a job for each included node
        for (const nodeKey of includedNodes) {
            nodeJobs[nodeKey] = {
                name: nodeKey,
                queueName: nodeQueue,
                opts: { jobId: nodeKey },
            };
        }

        // Set up dependencies
        flow.children = Object.entries(this.hashes)
            .filter(([nodeKey]) => includedNodes.includes(nodeKey))
            .map(([nodeKey, hashObj]) => ({
                ...nodeJobs[nodeKey],
                children: Object.keys(hashObj)
                    .filter(key => key !== 'current' && includedNodes.includes(key))
                    .map(depKey => nodeJobs[depKey])
            }));

        return flow;
    }

    /**
     * Creates a flow including all updated nodes
     */
    public createUpdateFlow(details: FlowDetails, extraJobData?: (nodeKey: NodeKey, updates: NodeUpdate) => object): FlowJob {
        const { name, flowQueue, nodeQueue } = details;
        const flow: FlowJob = { name, queueName: flowQueue, children: [] };
        const nodeJobs: Record<string, FlowJob> = {};

        // Create a job for each updated node
        for (const [nodeKey, update] of Object.entries(this.nodeUpdates)) {
            nodeJobs[nodeKey] = {
                name: nodeKey,
                queueName: nodeQueue,
                data: { update, ...(extraJobData?.(nodeKey, update) || {}) }, // Include the update information
                opts: { 
                    jobId: nodeKey,
                },
            };
        }

        // Set up dependencies
        flow.children = Object.keys(this.nodeUpdates)
            .map(nodeKey => {
                const hashObj = this.hashes[nodeKey] || this.previousHashes[nodeKey] || {};
                return {
                    ...nodeJobs[nodeKey],
                    children: this.nodeUpdates[nodeKey].type === 'DELETED' ? [] : Object.keys(hashObj)
                        .filter(key => key !== 'current' && key in this.nodeUpdates)
                        .map(depKey => {
                            if (!nodeJobs[depKey]) {
                                logger.error(`This dependency was missed: ${depKey}`);
                                return null;
                            }
                            return nodeJobs[depKey];
                        })
                        .filter(Boolean)
                } as FlowJob;
            });

        return flow;
    }

    public async initialize() {
        await this.setup();
        await this.determinePreviousHashes();
        await this.determineNewHashes();
        this.sortDependencies();
        await this.determineNodeUpdates();
        // await this.processUpdates(); one day
        
    }

    private sortDependencies(): void {
        // Create dependency array and topologically sort
        this.dependencies = Object.entries(this.hashes).flatMap(([nodeKey, hashObj]) => 
            Object.keys(hashObj).filter(key => key !== 'current')
                .map(dep => [dep, nodeKey] as [string, string])
        );
        this.sortedNodes = toposort(this.dependencies);
    }

    private invalidateDownstreamNodes(nodeKey: NodeKey) {
        const downstreamKeys = this.getDownstreamKeys(nodeKey);
        for (const key of downstreamKeys) {
            if (!this.nodeUpdates[key]) {
                this.nodeUpdates[key] = {
                    type: 'INVALIDATED',
                    previousHash: this.previousHashes[key]?.current,
                    by: nodeKey
                };
            }
        }
    }

    private invalidateUpstreamNodes(nodeKey: NodeKey) {
        const upstreamKeys = this.getUpstreamKeys(nodeKey);
        for (const key of upstreamKeys) {
            if (!this.nodeUpdates[key]) {
                this.nodeUpdates[key] = {
                    type: 'INVALIDATED',
                    previousHash: this.previousHashes[key]?.current,
                    by: nodeKey,
                    backPropagation: true
                };
            }
        }
    }

    private async determineNodeUpdates(): Promise<void> {
        this.nodeUpdates = {};
        for (const [nodeKey, hashObj] of Object.entries(this.hashes)) {
            if (!this.previousHashes[nodeKey]) {
                this.nodeUpdates[nodeKey] = { type: 'NEW' };
            } else if (this.previousHashes[nodeKey].current !== hashObj.current) {
                this.nodeUpdates[nodeKey] = { 
                    type: 'UPDATED', 
                    previousHash: this.previousHashes[nodeKey].current 
                };
                this.invalidateDownstreamNodes(nodeKey);
                if (this.options.backPropagation) {
                    this.invalidateUpstreamNodes(nodeKey);
                }
            }
        }

        for (const nodeKey of Object.keys(this.previousHashes)) {
            if (!this.hashes[nodeKey]) {
                this.nodeUpdates[nodeKey] = { 
                    type:'DELETED', 
                    previousHash: this.previousHashes[nodeKey].current 
                };
                logger.info(`File ${nodeKey} has been deleted.`);
                this.invalidateDownstreamNodes(nodeKey);
                if (this.options.backPropagation) {
                    this.invalidateUpstreamNodes(nodeKey);
                }
            }
        }
    }

    private async processUpdates(): Promise<void> {
        // Process updates
        const nodes = await this.getNodes();
        for (const [nodeKey, update] of Object.entries(this.nodeUpdates)) {
            if (update.type !== 'DELETED') {
                const node = nodes[nodeKey];
                if (node) {
                    switch (node.type) {
                        case NodeType.LLM:
                            await this.processLLMNodeUpdate(nodeKey);
                            break;
                        case NodeType.EXTRACTION:
                            await this.processExtractionNodeUpdate(nodeKey);
                            break;
                        default:
                            logger.warn(`Unknown node type for ${nodeKey}. Skipping processing.`);
                    }
                } else {
                    logger.warn(`node ${nodeKey} not found. Skipping processing.`);
                }
            }
        }
    }
}

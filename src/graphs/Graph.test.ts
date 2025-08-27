import { Graph, NodeType, Node, NodeUpdate, GraphOptions } from './Graph';
import { NodeContentType } from "./Graph";

// Mock implementation of the abstract Graph class for testing
class TestGraph extends Graph {
  constructor(
    private mockNodes: Record<string, Node>,
    private mockPreviousHashes: Record<string, any>,
    private mockNewHashes: Record<string, any>,
    public options: GraphOptions = {},
  ) {
    super(options);
  }

  async getNodes(): Promise<Record<string, Node>> {
    return this.mockNodes;
  }

  async determinePreviousHashes(): Promise<void> {
    this.previousHashes = this.mockPreviousHashes;
  }

  async determineNewHashes(): Promise<void> {
    this.hashes = this.mockNewHashes;
  }

  async setup(): Promise<void> {}
  async persistHashes(): Promise<void> {}
  async processLLMNodeUpdate(promptKey: string): Promise<void> {}
  async processExtractionNodeUpdate(promptKey: string): Promise<void> {}
}

describe('Graph', () => {
  describe('getNodeUpdates', () => {
    it.each([
      [
        'should return node updates',
        {
          mockNodes: {
            node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
            node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
            node3: { key: 'node3', type: NodeType.LLM, content: 'content3', contentType: NodeContentType.HBS },
          },
          mockPreviousHashes: { node1: { current: 'hash1' }, node2: { current: 'hash2' }, node3: { current: 'hash3', node2: 'hash2' } },
          mockNewHashes: { node1: { current: 'hash1' }, node2: { current: 'hash3' }, node3: { current: 'hash3', node2: 'hash3' } },
          expectedUpdates: { 
            node2: { type: 'UPDATED', previousHash: 'hash2' },
            node3: { type: 'INVALIDATED', previousHash: 'hash3', by: 'node2' }
          },
          backPropagation: false,
        },
      ],
      [
        'should detect new nodes',
        {
          mockNodes: {
            node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
            node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
          },
          mockPreviousHashes: { node1: { current: 'hash1' } },
          mockNewHashes: { node1: { current: 'hash1' }, node2: { current: 'hash2' } },
          expectedUpdates: { node2: { type: 'NEW' } },
          backPropagation: false,
        },
      ],
      [
        'should detect deleted nodes',
        {
          mockNodes: {
            node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
          },
          mockPreviousHashes: { node1: { current: 'hash1' }, node2: { current: 'hash2' } },
          mockNewHashes: { node1: { current: 'hash1' } },
          expectedUpdates: { node2: { type: 'DELETED', previousHash: 'hash2' } },
          backPropagation: false,
        },
      ],
      [
        'should detect invalidated upstream nodes with backPropagation',
        {
          mockNodes: {
            node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
            node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
            node3: { key: 'node3', type: NodeType.LLM, content: 'content3', contentType: NodeContentType.HBS },
          },
          mockPreviousHashes: { 
            node1: { current: 'hash1' }, 
            node2: { current: 'hash2', node1: 'hash1' }, 
            node3: { current: 'hash3', node2: 'hash2' } 
          },
          mockNewHashes: { 
            node1: { current: 'hash1' }, 
            node2: { current: 'hash2', node1: 'hash1' }, 
            node3: { current: 'hash4', node2: 'hash2' } 
          },
          expectedUpdates: { 
            node3: { type: 'UPDATED', previousHash: 'hash3' },
            node2: { type: 'INVALIDATED', previousHash: 'hash2', by: 'node3', backPropagation: true },
            node1: { type: 'INVALIDATED', previousHash: 'hash1', by: 'node3', backPropagation: true }
          },
          backPropagation: true,
        },
      ],
    ])('%s', async (_, testCase) => {
      const graph = new TestGraph(testCase.mockNodes, testCase.mockPreviousHashes, testCase.mockNewHashes, {backPropagation: testCase.backPropagation});
      await graph.ready;
      expect(graph.getNodeUpdates()).toEqual(testCase.expectedUpdates);
    });
  });

  describe('getDependencies', () => {
    it.each([
      [
        'should return correct dependencies',
        {
          mockNodes: {
            node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
            node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
            node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
          },
          mockNewHashes: { 
            node1: { current: 'hash1' },
            node2: { current: 'hash2', node1: 'hash1' },
            node3: { current: 'hash3', node2: 'hash2' }
          },
          expectedDependencies: [['node1', 'node2'], ['node2', 'node3']],
        },
      ],
    ])('%s', async (_, testCase) => {
      const graph = new TestGraph(testCase.mockNodes, {}, testCase.mockNewHashes);
      await graph.ready;
      expect(graph.getDependencies()).toEqual(testCase.expectedDependencies);
    });
  });

  describe('getSortedNodes', () => {
    it.each([
      [
        'should return topologically sorted nodes',
        {
          mockNodes: {
            node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
            node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
            node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
          },
          mockNewHashes: { 
            node1: { current: 'hash1' },
            node2: { current: 'hash2', node1: 'hash1' },
            node3: { current: 'hash3', node2: 'hash2' }
          },
          expectedSortedNodes: ['node1', 'node2', 'node3'],
        },
      ],
    ])('%s', async (_, testCase) => {
      const graph = new TestGraph(testCase.mockNodes, {}, testCase.mockNewHashes);
      await graph.ready
      expect(graph.getSortedNodes()).toEqual(testCase.expectedSortedNodes);
    });
  });

  describe('getDownstreamKeys', () => {
    it.each([
      [
        'should return correct downstream keys',
        {
          mockNodes: {
            node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
            node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
            node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
            node4: { key: 'node4', type: NodeType.LLM, content: 'content4', contentType: NodeContentType.HBS },
          },
          mockNewHashes: { 
            node1: { current: 'hash1' },
            node2: { current: 'hash2', node1: 'hash1' },
            node3: { current: 'hash3', node2: 'hash2' },
            node4: { current: 'hash4', node2: 'hash2' }
          },
          testKey: 'node1',
          expectedDownstream: ['node2', 'node3', 'node4'],
        },
      ],
      [
        'should return empty array for leaf node',
        {
          mockNodes: {
            node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
            node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
          },
          mockNewHashes: { 
            node1: { current: 'hash1' },
            node2: { current: 'hash2', node1: 'hash1' },
          },
          testKey: 'node2',
          expectedDownstream: [],
        },
      ],
    ])('%s', async (_, testCase) => {
      const graph = new TestGraph(testCase.mockNodes, {}, testCase.mockNewHashes);
      await graph.ready      
      expect(graph.getDownstreamKeys(testCase.testKey)).toEqual(testCase.expectedDownstream);
    });
  });

  describe('getUpstreamKeys', () => {
    it.each([
      [
        'should return correct upstream keys',
        {
          mockNodes: {
            node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
            node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
            node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
            node4: { key: 'node4', type: NodeType.LLM, content: 'content4', contentType: NodeContentType.HBS },
          },
          mockNewHashes: { 
            node1: { current: 'hash1' },
            node2: { current: 'hash2', node1: 'hash1' },
            node3: { current: 'hash3', node2: 'hash2' },
            node4: { current: 'hash4', node2: 'hash2', node1: 'hash1' }
          },
          testKey: 'node4',
          expectedUpstream: ['node1', 'node2'],
        },
      ],
      [
        'should return empty array for root node',
        {
          mockNodes: {
            node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
            node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
          },
          mockNewHashes: { 
            node1: { current: 'hash1' },
            node2: { current: 'hash2', node1: 'hash1' },
          },
          testKey: 'node1',
          expectedUpstream: [],
        },
      ],
    ])('%s', async (_, testCase) => {
      const graph = new TestGraph(testCase.mockNodes, {}, testCase.mockNewHashes);
      await graph.ready      
      expect(graph.getUpstreamKeys(testCase.testKey)).toEqual(testCase.expectedUpstream);
    });
  });

  describe('createFullFlow', () => {
    it('should create a full flow with correct job dependencies', async () => {
      const mockNodes = {
        node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
        node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
        node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
      };
      const mockNewHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'hash2', node1: 'hash1' },
        node3: { current: 'hash3', node2: 'hash2' }
      };
      const graph = new TestGraph(mockNodes, {}, mockNewHashes);
      await graph.ready
      const flow = graph.createFullFlow({ name: 'testFlow', flowQueue: 'flowQueue', nodeQueue: 'nodeQueue' });

      expect(flow.children).toHaveLength(3);
      expect(flow.children?.[0]).toEqual(expect.objectContaining({ 
        name: 'node1', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node1' },
        children: [] 
      }));
      expect(flow.children?.[1]).toEqual(expect.objectContaining({ 
        name: 'node2', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node2' },
        children: [expect.objectContaining({ name: 'node1' })]
      }));
      expect(flow.children?.[2]).toEqual(expect.objectContaining({ 
        name: 'node3', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node3' },
        children: [expect.objectContaining({ name: 'node2' })]
      }));
    });

    it('should handle complex dependencies correctly in full flow', async () => {
      const mockNodes = {
        node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
        node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
        node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
        node4: { key: 'node4', type: NodeType.LLM, content: 'content4', contentType: NodeContentType.HBS },
      };
      const mockNewHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'hash2', node1: 'hash1' },
        node3: { current: 'hash3', node2: 'hash2' },
        node4: { current: 'hash4', node1: 'hash1', node3: 'hash3' }
      };
      const graph = new TestGraph(mockNodes, {}, mockNewHashes);
      await graph.ready
      const flow = graph.createFullFlow({ name: 'testFlow', flowQueue: 'flowQueue', nodeQueue: 'nodeQueue' });

      expect(flow.children).toHaveLength(4);
      expect(flow.children?.[0]).toEqual(expect.objectContaining({ 
        name: 'node1', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node1' },
        children: [] 
      }));
      expect(flow.children?.[1]).toEqual(expect.objectContaining({ 
        name: 'node2', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node2' },
        children: [expect.objectContaining({ name: 'node1' })]
      }));
      expect(flow.children?.[2]).toEqual(expect.objectContaining({ 
        name: 'node3', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node3' },
        children: [expect.objectContaining({ name: 'node2' })]
      }));
      expect(flow.children?.[3]).toEqual(expect.objectContaining({ 
        name: 'node4', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node4' },
        children: [
          expect.objectContaining({ name: 'node1' }),
          expect.objectContaining({ name: 'node3' })
        ]
      }));
    });
  });

  describe('createFlow', () => {
    it('should create a downstream flow correctly', async () => {
      const mockNodes = {
        node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
        node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
        node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
      };
      const mockNewHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'hash2', node1: 'hash1' },
        node3: { current: 'hash3', node2: 'hash2' }
      };
      const graph = new TestGraph(mockNodes, {}, mockNewHashes);
      await graph.ready
      const flow = graph.createFlow('node1', 'down', { name: 'testFlow', flowQueue: 'flowQueue', nodeQueue: 'nodeQueue' });

      expect(flow.children).toHaveLength(3);
      expect(flow.children?.[0]).toEqual(expect.objectContaining({ 
        name: 'node1', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node1' },
        children: [] 
      }));
      expect(flow.children?.[1]).toEqual(expect.objectContaining({ 
        name: 'node2', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node2' },
        children: [expect.objectContaining({ name: 'node1' })]
      }));
      expect(flow.children?.[2]).toEqual(expect.objectContaining({ 
        name: 'node3', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node3' },
        children: [expect.objectContaining({ name: 'node2' })]
      }));
    });

    it('should create an upstream flow correctly', async () => {
      const mockNodes = {
        node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
        node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
        node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
      };
      const mockNewHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'hash2', node1: 'hash1' },
        node3: { current: 'hash3', node2: 'hash2' }
      };
      const graph = new TestGraph(mockNodes, {}, mockNewHashes);
      await graph.ready
      const flow = graph.createFlow('node3', 'up', { name: 'testFlow', flowQueue: 'flowQueue', nodeQueue: 'nodeQueue' });

      expect(flow.children).toHaveLength(3);
      expect(flow.children?.[0]).toEqual(expect.objectContaining({ 
        name: 'node1', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node1' },
        children: [] 
      }));
      expect(flow.children?.[1]).toEqual(expect.objectContaining({ 
        name: 'node2', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node2' },
        children: [expect.objectContaining({ name: 'node1' })]
      }));
      expect(flow.children?.[2]).toEqual(expect.objectContaining({ 
        name: 'node3', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node3' },
        children: [expect.objectContaining({ name: 'node2' })]
      }));
    });
    it('should create a partial upstream flow correctly', async () => {
      const mockNodes = {
        node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
        node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
        node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
        node4: { key: 'node4', type: NodeType.LLM, content: 'content4', contentType: NodeContentType.HBS },
      };
      const mockNewHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'hash2', node1: 'hash1' },
        node3: { current: 'hash3', node2: 'hash2' },
        node4: { current: 'hash4', node2: 'hash2', node3: 'hash3' }
      };
      const graph = new TestGraph(mockNodes, {}, mockNewHashes);
      await graph.ready
      const flow = graph.createFlow('node3', 'up', { name: 'testFlow', flowQueue: 'flowQueue', nodeQueue: 'nodeQueue' });

      expect(flow.children).toHaveLength(3);
      expect(flow.children?.[0]).toEqual(expect.objectContaining({ 
        name: 'node1', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node1' },
        children: [] 
      }));
      expect(flow.children?.[1]).toEqual(expect.objectContaining({ 
        name: 'node2', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node2' },
        children: [expect.objectContaining({ name: 'node1' })]
      }));
      expect(flow.children?.[2]).toEqual(expect.objectContaining({ 
        name: 'node3', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node3' },
        children: [expect.objectContaining({ name: 'node2' })]
      }));
      // Ensure node4 is not included in the flow
      expect(flow.children?.find(child => child.name === 'node4')).toBeUndefined();
    });

    it('should create a partial downstream flow correctly', async () => {
      const mockNodes = {
        node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
        node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
        node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
        node4: { key: 'node4', type: NodeType.LLM, content: 'content4', contentType: NodeContentType.HBS },
      };
      const mockNewHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'hash2', node1: 'hash1' },
        node3: { current: 'hash3', node2: 'hash2' },
        node4: { current: 'hash4', node2: 'hash2', node3: 'hash3' }
      };
      const graph = new TestGraph(mockNodes, {}, mockNewHashes);
      await graph.ready
      const flow = graph.createFlow('node2', 'down', { name: 'testFlow', flowQueue: 'flowQueue', nodeQueue: 'nodeQueue' });

      expect(flow.children).toHaveLength(3);
      expect(flow.children?.[0]).toEqual(expect.objectContaining({ 
        name: 'node2', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node2' },
        children: [] 
      }));
      expect(flow.children?.[1]).toEqual(expect.objectContaining({ 
        name: 'node3', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node3' },
        children: [expect.objectContaining({ name: 'node2' })]
      }));
      expect(flow.children?.[2]).toEqual(expect.objectContaining({ 
        name: 'node4', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node4' },
        children: [expect.objectContaining({ name: 'node2' }), expect.objectContaining({ name: 'node3' })]
      }));
      // Ensure node1 is not included in the flow
      expect(flow.children?.find(child => child.name === 'node1')).toBeUndefined();
    });
  });

  describe('createUpdateFlow', () => {
    it('should create a flow with only updated nodes', async () => {
      const mockNodes = {
        node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
        node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
        node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
        node4: { key: 'node4', type: NodeType.LLM, content: 'content4', contentType: NodeContentType.HBS },
      };
      const mockNewHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'hash2', node1: 'hash1' },
        node3: { current: 'hash3', node2: 'hash2' },
        node4: { current: 'hash4', node2: 'hash2', node3: 'hash3' }
      };
      const mockPreviousHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'oldHash2', node1: 'hash1' },
        node3: { current: 'oldHash3', node2: 'oldHash2' },
        node4: { current: 'hash4', node2: 'oldHash2', node3: 'oldHash3' }
      };
      const graph = new TestGraph(mockNodes, mockPreviousHashes, mockNewHashes);
      await graph.ready;

      const flow = graph.createUpdateFlow({ name: 'testFlow', flowQueue: 'flowQueue', nodeQueue: 'nodeQueue' });

      expect(flow.children).toHaveLength(3);
      expect(flow.children?.[0]).toEqual(expect.objectContaining({ 
        name: 'node2', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node2' },
        data: { update: { type: 'UPDATED', previousHash: 'oldHash2' } },
        children: [] 
      }));
      expect(flow.children?.[1]).toEqual(expect.objectContaining({ 
        name: 'node3', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node3' },
        data: { update: { type: 'UPDATED', previousHash: 'oldHash3' } },
        children: [expect.objectContaining({ name: 'node2' })]
      }));
      expect(flow.children?.[2]).toEqual(expect.objectContaining({ 
        name: 'node4', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node4' },
        data: { update: { type: 'INVALIDATED', previousHash: 'hash4', by: 'node2' } },
        children: [expect.objectContaining({ name: 'node2' }), expect.objectContaining({ name: 'node3' })]
      }));
      // Ensure node1 is not included in the flow
      expect(flow.children?.find(child => child.name === 'node1')).toBeUndefined();
    });

    it('should handle new and deleted nodes in the update flow', async () => {
      const mockNodes = {
        node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
        node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
        node3: { key: 'node3', type: NodeType.EXTRACTION, content: 'content3', contentType: NodeContentType.JSON },
      };
      const mockNewHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'hash2', node1: 'hash1' },
        node3: { current: 'hash3', node2: 'hash2' },
      };
      const mockPreviousHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'oldHash2', node1: 'hash1' },
        node4: { current: 'hash4', node2: 'oldHash2' },
      };
      const graph = new TestGraph(mockNodes, mockPreviousHashes, mockNewHashes);
      await graph.ready;

      const flow = graph.createUpdateFlow({ name: 'testFlow', flowQueue: 'flowQueue', nodeQueue: 'nodeQueue' });

      expect(flow.children).toHaveLength(3);
      expect(flow.children?.[0]).toEqual(expect.objectContaining({ 
        name: 'node2', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node2' },
        data: { update: { type: 'UPDATED', previousHash: 'oldHash2' } },
        children: [] 
      }));
      expect(flow.children?.[1]).toEqual(expect.objectContaining({ 
        name: 'node3', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node3' },
        data: { update: { type: 'NEW' } },
        children: [expect.objectContaining({ name: 'node2' })]
      }));
      expect(flow.children?.[2]).toEqual(expect.objectContaining({ 
        name: 'node4', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node4' },
        data: { update: { type: 'DELETED', previousHash: 'hash4' } },
        children: []
      }));
      // Ensure node1 is not included in the flow
      expect(flow.children?.find(child => child.name === 'node1')).toBeUndefined();
    });

    it('should handle backpropagation in the update flow', async () => {
      const mockNodes = {
        node1: { key: 'node1', type: NodeType.EXTERNAL, content: 'content1', contentType: NodeContentType.MD },
        node2: { key: 'node2', type: NodeType.LLM, content: 'content2', contentType: NodeContentType.HBS },
        node3: { key: 'node3', type: NodeType.LLM, content: 'content3', contentType: NodeContentType.HBS },
      };
      const mockNewHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'hash2', node1: 'hash1' },
        node3: { current: 'hash4', node2: 'hash2' },
      };
      const mockPreviousHashes = { 
        node1: { current: 'hash1' },
        node2: { current: 'hash2', node1: 'hash1' },
        node3: { current: 'hash3', node2: 'hash2' },
      };
      const graph = new TestGraph(mockNodes, mockPreviousHashes, mockNewHashes, { backPropagation: true });
      await graph.ready;

      const flow = graph.createUpdateFlow({ name: 'testFlow', flowQueue: 'flowQueue', nodeQueue: 'nodeQueue' });

      expect(flow.children).toHaveLength(3);
      expect(flow.children?.[0]).toEqual(expect.objectContaining({ 
        name: 'node3', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node3' },
        data: { update: { type: 'UPDATED', previousHash: 'hash3' } },
        children: [expect.objectContaining({name: 'node2'})]
      }));
      expect(flow.children?.[2]).toEqual(expect.objectContaining({ 
        name: 'node2', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node2' },
        data: { update: { type: 'INVALIDATED', previousHash: 'hash2', by: 'node3', backPropagation: true } },
        children: [expect.objectContaining({ name: 'node1' })]
      }));
      expect(flow.children?.[1]).toEqual(expect.objectContaining({ 
        name: 'node1', 
        queueName: 'nodeQueue',
        opts: { jobId: 'node1' },
        data: { update: { type: 'INVALIDATED', previousHash: 'hash1', by: 'node3', backPropagation: true } },
        children: []
      }));
    });
  });
});
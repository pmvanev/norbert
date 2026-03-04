/**
 * Graph Builder tests for @norbert/config-explorer.
 *
 * Verifies the pure buildGraphData function correctly transforms a ConfigModel
 * into a flat graph structure (nodes + links) suitable for D3.js force simulation.
 *
 * Tests cover:
 * - Correct node structure from ConfigModel nodes
 * - Scope color assignment on graph nodes
 * - Plugin node identification (isPlugin flag)
 * - Conflict-marked nodes (isConflicted flag)
 * - Link creation from ConfigEdge values
 * - Conflict links marked with isConflict flag
 * - Empty model produces empty graph
 * - Virtual targets filtered from graph nodes
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildGraphData } from '../graph-builder.js';
import type { ConfigModel, ConfigNode, ConfigEdge, NamingConflict } from '../types/index.js';
import type { ScopeName, SubsystemName } from '../types/index.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const createConfigNode = (
  overrides: Partial<ConfigNode> = {},
): ConfigNode => ({
  id: overrides.id ?? 'project:default',
  name: overrides.name ?? 'default',
  scope: overrides.scope ?? 'project',
  subsystem: overrides.subsystem ?? 'agents',
  nodeType: overrides.nodeType ?? 'agent',
  filePath: overrides.filePath ?? 'agents/default.md',
  relativePath: overrides.relativePath ?? 'agents/default.md',
  content: '',
  parsedContent: { format: 'markdown', body: '' },
  loadBehavior: 'always',
  error: null,
  ...overrides,
});

const createEdge = (
  sourceId: string,
  targetId: string,
  edgeType: ConfigEdge['edgeType'] = 'agent-references-skill',
  label: string = 'test edge',
): ConfigEdge => ({
  sourceId,
  targetId,
  edgeType,
  label,
});

const createConflict = (
  name: string,
  higherNode: ConfigNode,
  lowerNode: ConfigNode,
): NamingConflict => ({
  name,
  nodeType: higherNode.nodeType,
  higherScope: higherNode,
  lowerScope: lowerNode,
  resolution: `${higherNode.scope} scope overrides ${lowerNode.scope} scope`,
});

const createModel = (
  nodes: readonly ConfigNode[] = [],
  edges: readonly ConfigEdge[] = [],
  conflicts: readonly NamingConflict[] = [],
): ConfigModel => {
  const scopeSummary: Partial<Record<ScopeName, number>> = {};
  const subsystemSummary: Partial<Record<SubsystemName, number>> = {};
  for (const node of nodes) {
    scopeSummary[node.scope] = (scopeSummary[node.scope] ?? 0) + 1;
    subsystemSummary[node.subsystem] = (subsystemSummary[node.subsystem] ?? 0) + 1;
  }
  return {
    nodes,
    edges,
    precedenceChains: {},
    scopeSummary,
    subsystemSummary,
    totalFiles: nodes.length,
    conflicts,
    scanTimestamp: '2026-03-03T00:00:00.000Z',
  };
};

// ---------------------------------------------------------------------------
// Empty model
// ---------------------------------------------------------------------------

describe('buildGraphData - empty model', () => {
  it('returns empty nodes and links for empty model', () => {
    const model = createModel();
    const result = buildGraphData(model);

    expect(result.nodes).toHaveLength(0);
    expect(result.links).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Node structure
// ---------------------------------------------------------------------------

describe('buildGraphData - node structure', () => {
  it('creates graph nodes with correct id, label, nodeType, and scope', () => {
    const agentNode = createConfigNode({
      id: 'project:agents/reviewer.md',
      name: 'reviewer.md',
      scope: 'project',
      subsystem: 'agents',
      nodeType: 'agent',
    });
    const model = createModel([agentNode]);
    const result = buildGraphData(model);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('project:agents/reviewer.md');
    expect(result.nodes[0].label).toBe('reviewer.md');
    expect(result.nodes[0].nodeType).toBe('agent');
    expect(result.nodes[0].scope).toBe('project');
  });

  it('assigns correct subsystem from source node', () => {
    const skillNode = createConfigNode({
      id: 'user:skills/deploy/SKILL.md',
      name: 'SKILL.md',
      subsystem: 'skills',
      nodeType: 'skill',
    });
    const model = createModel([skillNode]);
    const result = buildGraphData(model);

    expect(result.nodes[0].subsystem).toBe('skills');
  });
});

// ---------------------------------------------------------------------------
// Scope colors
// ---------------------------------------------------------------------------

describe('buildGraphData - scope colors', () => {
  it('assigns correct scope color for each scope', () => {
    const expectedColors: Record<ScopeName, string> = {
      user: '#3B82F6',
      project: '#22C55E',
      local: '#EAB308',
      plugin: '#A855F7',
      managed: '#EF4444',
    };

    for (const [scope, expectedColor] of Object.entries(expectedColors)) {
      const node = createConfigNode({
        id: `${scope}:test`,
        scope: scope as ScopeName,
      });
      const model = createModel([node]);
      const result = buildGraphData(model);

      expect(result.nodes[0].scopeColor).toBe(expectedColor);
    }
  });
});

// ---------------------------------------------------------------------------
// Plugin node identification
// ---------------------------------------------------------------------------

describe('buildGraphData - plugin nodes', () => {
  it('marks plugin nodeType nodes with isPlugin true', () => {
    const pluginNode = createConfigNode({
      id: 'plugin:my-plugin/.claude-plugin/plugin.json',
      nodeType: 'plugin',
      subsystem: 'plugins',
      scope: 'plugin',
    });
    const model = createModel([pluginNode]);
    const result = buildGraphData(model);

    expect(result.nodes[0].isPlugin).toBe(true);
  });

  it('marks non-plugin nodes with isPlugin false', () => {
    const agentNode = createConfigNode({ nodeType: 'agent' });
    const model = createModel([agentNode]);
    const result = buildGraphData(model);

    expect(result.nodes[0].isPlugin).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Conflict-marked nodes
// ---------------------------------------------------------------------------

describe('buildGraphData - conflicted nodes', () => {
  it('marks nodes involved in naming conflicts as isConflicted', () => {
    const higherNode = createConfigNode({
      id: 'project:agents/reviewer.md',
      name: 'reviewer.md',
      scope: 'project',
      nodeType: 'agent',
    });
    const lowerNode = createConfigNode({
      id: 'user:agents/reviewer.md',
      name: 'reviewer.md',
      scope: 'user',
      nodeType: 'agent',
    });
    const conflict = createConflict('reviewer', higherNode, lowerNode);
    const model = createModel([higherNode, lowerNode], [], [conflict]);
    const result = buildGraphData(model);

    const higherGraphNode = result.nodes.find((n) => n.id === higherNode.id);
    const lowerGraphNode = result.nodes.find((n) => n.id === lowerNode.id);

    expect(higherGraphNode!.isConflicted).toBe(true);
    expect(lowerGraphNode!.isConflicted).toBe(true);
  });

  it('nodes not in any conflict are marked isConflicted false', () => {
    const node = createConfigNode({ id: 'project:standalone' });
    const model = createModel([node]);
    const result = buildGraphData(model);

    expect(result.nodes[0].isConflicted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Links from edges
// ---------------------------------------------------------------------------

describe('buildGraphData - links from edges', () => {
  it('creates links for edges between real nodes', () => {
    const agent = createConfigNode({
      id: 'project:agents/reviewer.md',
      nodeType: 'agent',
      subsystem: 'agents',
    });
    const skill = createConfigNode({
      id: 'user:skills/deploy/SKILL.md',
      nodeType: 'skill',
      subsystem: 'skills',
    });
    const edge = createEdge(agent.id, skill.id, 'agent-references-skill', 'references skill');
    const model = createModel([agent, skill], [edge]);
    const result = buildGraphData(model);

    expect(result.links).toHaveLength(1);
    expect(result.links[0].source).toBe(agent.id);
    expect(result.links[0].target).toBe(skill.id);
    expect(result.links[0].edgeType).toBe('agent-references-skill');
  });

  it('filters out edges pointing to virtual targets (pattern:, tool:, event:)', () => {
    const ruleNode = createConfigNode({
      id: 'project:rules/coding.md',
      nodeType: 'rule',
      subsystem: 'rules',
    });
    const virtualEdge = createEdge(ruleNode.id, 'pattern:*.ts', 'rule-scoped-to-path');
    const model = createModel([ruleNode], [virtualEdge]);
    const result = buildGraphData(model);

    expect(result.links).toHaveLength(0);
  });

  it('filters out edges with virtual source ids', () => {
    const node = createConfigNode({ id: 'project:test' });
    const edge = createEdge('tool:bash', node.id);
    const model = createModel([node], [edge]);
    const result = buildGraphData(model);

    expect(result.links).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Naming conflict links
// ---------------------------------------------------------------------------

describe('buildGraphData - conflict links', () => {
  it('creates conflict links marked with isConflict true', () => {
    const higherNode = createConfigNode({
      id: 'project:agents/reviewer.md',
      scope: 'project',
      nodeType: 'agent',
    });
    const lowerNode = createConfigNode({
      id: 'user:agents/reviewer.md',
      scope: 'user',
      nodeType: 'agent',
    });
    const conflict = createConflict('reviewer', higherNode, lowerNode);
    const model = createModel([higherNode, lowerNode], [], [conflict]);
    const result = buildGraphData(model);

    const conflictLinks = result.links.filter((l) => l.isConflict);
    expect(conflictLinks).toHaveLength(1);
    expect(conflictLinks[0].source).toBe(higherNode.id);
    expect(conflictLinks[0].target).toBe(lowerNode.id);
    expect(conflictLinks[0].edgeType).toBe('naming-conflict');
  });

  it('non-conflict links have isConflict false', () => {
    const agent = createConfigNode({ id: 'a', nodeType: 'agent' });
    const skill = createConfigNode({ id: 'b', nodeType: 'skill' });
    const edge = createEdge(agent.id, skill.id, 'agent-references-skill');
    const model = createModel([agent, skill], [edge]);
    const result = buildGraphData(model);

    expect(result.links[0].isConflict).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Conflicts passthrough
// ---------------------------------------------------------------------------

describe('buildGraphData - conflicts passthrough', () => {
  it('passes NamingConflict values through to result', () => {
    const higherNode = createConfigNode({ id: 'a', scope: 'project', nodeType: 'agent' });
    const lowerNode = createConfigNode({ id: 'b', scope: 'user', nodeType: 'agent' });
    const conflict = createConflict('reviewer', higherNode, lowerNode);
    const model = createModel([higherNode, lowerNode], [], [conflict]);
    const result = buildGraphData(model);

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].name).toBe('reviewer');
  });
});

// ---------------------------------------------------------------------------
// Model with 3 nodes and 2 edges
// ---------------------------------------------------------------------------

describe('buildGraphData - 3 nodes, 2 edges', () => {
  it('produces graph with correct structure', () => {
    const agent = createConfigNode({
      id: 'project:agents/orchestrator.md',
      name: 'orchestrator.md',
      nodeType: 'agent',
      subsystem: 'agents',
      scope: 'project',
    });
    const skill1 = createConfigNode({
      id: 'user:skills/deploy/SKILL.md',
      name: 'SKILL.md',
      nodeType: 'skill',
      subsystem: 'skills',
      scope: 'user',
    });
    const skill2 = createConfigNode({
      id: 'user:skills/review/SKILL.md',
      name: 'SKILL.md',
      nodeType: 'skill',
      subsystem: 'skills',
      scope: 'user',
    });
    const edge1 = createEdge(agent.id, skill1.id, 'agent-references-skill');
    const edge2 = createEdge(agent.id, skill2.id, 'agent-references-skill');
    const model = createModel([agent, skill1, skill2], [edge1, edge2]);
    const result = buildGraphData(model);

    expect(result.nodes).toHaveLength(3);
    expect(result.links).toHaveLength(2);
    expect(result.links.every((l) => l.source === agent.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('buildGraphData - properties', () => {
  const scopeArb: fc.Arbitrary<ScopeName> = fc.constantFrom(
    'managed' as const,
    'user' as const,
    'project' as const,
    'local' as const,
    'plugin' as const,
  );

  const subsystemArb: fc.Arbitrary<SubsystemName> = fc.constantFrom(
    'memory' as const,
    'settings' as const,
    'rules' as const,
    'skills' as const,
    'agents' as const,
    'hooks' as const,
    'plugins' as const,
    'mcp' as const,
  );

  const nodeTypeArb = fc.constantFrom(
    'agent' as const,
    'skill' as const,
    'rule' as const,
    'hook' as const,
    'mcp' as const,
    'memory' as const,
    'settings' as const,
    'plugin' as const,
  );

  const configNodeArb: fc.Arbitrary<ConfigNode> = fc.record({
    scope: scopeArb,
    subsystem: subsystemArb,
    nodeType: nodeTypeArb,
    name: fc.string({ minLength: 1, maxLength: 20 }),
  }).map(({ scope, subsystem, nodeType, name }) =>
    createConfigNode({
      id: `${scope}:${subsystem}/${name}`,
      name,
      scope,
      subsystem,
      nodeType,
    }),
  );

  const modelArb: fc.Arbitrary<ConfigModel> = fc
    .array(configNodeArb, { maxLength: 30 })
    .map((nodes) => createModel(nodes));

  it('graph node count equals model node count', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const result = buildGraphData(model);
        expect(result.nodes).toHaveLength(model.nodes.length);
      }),
    );
  });

  it('every graph node has a valid scope color', () => {
    const validColors = new Set(['#3B82F6', '#22C55E', '#EAB308', '#A855F7', '#EF4444']);
    fc.assert(
      fc.property(modelArb, (model) => {
        const result = buildGraphData(model);
        for (const node of result.nodes) {
          expect(validColors.has(node.scopeColor)).toBe(true);
        }
      }),
    );
  });

  it('isPlugin is true only for plugin nodeType nodes', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const result = buildGraphData(model);
        for (const graphNode of result.nodes) {
          expect(graphNode.isPlugin).toBe(graphNode.nodeType === 'plugin');
        }
      }),
    );
  });
});

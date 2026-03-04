/**
 * Mind Map Builder tests for @norbert/config-explorer.
 *
 * Verifies the pure buildMindMapData function correctly transforms a ConfigModel
 * into a hierarchical tree structure suitable for D3.js tree layout rendering.
 *
 * Uses example-based tests for known assembly scenarios and property-based
 * tests for structural invariants.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildMindMapData } from '../mind-map-builder.js';
import type { ConfigModel, ConfigNode } from '../types/index.js';
import type { ScopeName, SubsystemName } from '../types/index.js';
import type { MindMapNode } from '../mind-map-builder.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const ALL_SUBSYSTEM_NAMES: readonly SubsystemName[] = [
  'memory', 'settings', 'rules', 'skills', 'agents', 'hooks', 'plugins', 'mcp',
] as const;

const createConfigNode = (
  name: string,
  subsystem: SubsystemName,
  scope: ScopeName,
): ConfigNode => ({
  id: `${scope}:${name}`,
  name,
  scope,
  subsystem,
  nodeType: subsystem === 'rules' ? 'rule' : subsystem === 'agents' ? 'agent' : subsystem === 'skills' ? 'skill' : subsystem === 'plugins' ? 'plugin' : subsystem as ConfigNode['nodeType'],
  filePath: name,
  relativePath: name,
  content: '',
  parsedContent: { format: 'markdown', body: '' },
  loadBehavior: 'always',
  error: null,
});

const createModel = (
  nodes: readonly ConfigNode[],
  subsystemSummary?: Partial<Record<SubsystemName, number>>,
): ConfigModel => {
  const computedSummary: Partial<Record<SubsystemName, number>> = {};
  for (const node of nodes) {
    computedSummary[node.subsystem] = (computedSummary[node.subsystem] ?? 0) + 1;
  }

  const scopeSummary: Partial<Record<ScopeName, number>> = {};
  for (const node of nodes) {
    scopeSummary[node.scope] = (scopeSummary[node.scope] ?? 0) + 1;
  }

  return {
    nodes,
    edges: [],
    precedenceChains: {},
    scopeSummary,
    subsystemSummary: subsystemSummary ?? computedSummary,
    totalFiles: nodes.length,
    conflicts: [],
    scanTimestamp: '2026-03-03T00:00:00.000Z',
  };
};

// ---------------------------------------------------------------------------
// Root structure
// ---------------------------------------------------------------------------

describe('buildMindMapData - root structure', () => {
  it('returns a root node named Configuration', () => {
    const model = createModel([]);
    const result = buildMindMapData(model);

    expect(result.name).toBe('Configuration');
  });

  it('root has no scope assignment', () => {
    const model = createModel([]);
    const result = buildMindMapData(model);

    expect(result.scope).toBeNull();
  });

  it('root has exactly 8 children for the 8 subsystems', () => {
    const model = createModel([]);
    const result = buildMindMapData(model);

    expect(result.children).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// 8 subsystem branches
// ---------------------------------------------------------------------------

describe('buildMindMapData - subsystem branches', () => {
  it('all 8 subsystem names appear as branch names', () => {
    const model = createModel([]);
    const result = buildMindMapData(model);

    const branchNames = result.children.map((child) => child.subsystem);

    for (const subsystemName of ALL_SUBSYSTEM_NAMES) {
      expect(branchNames).toContain(subsystemName);
    }
  });

  it('branches use human-readable labels', () => {
    const model = createModel([]);
    const result = buildMindMapData(model);

    const expectedLabels: Record<SubsystemName, string> = {
      memory: 'Memory',
      settings: 'Settings',
      rules: 'Rules',
      skills: 'Skills',
      agents: 'Agents',
      hooks: 'Hooks',
      plugins: 'Plugins',
      mcp: 'MCP',
    };

    for (const branch of result.children) {
      expect(branch.name).toBe(expectedLabels[branch.subsystem!]);
    }
  });

  it('branches with files report correct count', () => {
    const nodes = [
      createConfigNode('CLAUDE.md', 'memory', 'project'),
      createConfigNode('MEMORY.md', 'memory', 'user'),
      createConfigNode('settings.json', 'settings', 'project'),
    ];
    const model = createModel(nodes);
    const result = buildMindMapData(model);

    const memoryBranch = result.children.find((c) => c.subsystem === 'memory');
    const settingsBranch = result.children.find((c) => c.subsystem === 'settings');

    expect(memoryBranch!.count).toBe(2);
    expect(settingsBranch!.count).toBe(1);
  });

  it('empty subsystems have zero count', () => {
    const model = createModel([]);
    const result = buildMindMapData(model);

    for (const branch of result.children) {
      expect(branch.count).toBe(0);
    }
  });

  it('empty subsystems are marked as empty', () => {
    const nodes = [createConfigNode('CLAUDE.md', 'memory', 'project')];
    const model = createModel(nodes);
    const result = buildMindMapData(model);

    const rulesBranch = result.children.find((c) => c.subsystem === 'rules');
    const memoryBranch = result.children.find((c) => c.subsystem === 'memory');

    expect(rulesBranch!.isEmpty).toBe(true);
    expect(memoryBranch!.isEmpty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Leaf nodes (individual config files)
// ---------------------------------------------------------------------------

describe('buildMindMapData - leaf nodes', () => {
  it('branch children contain individual config nodes', () => {
    const nodes = [
      createConfigNode('CLAUDE.md', 'memory', 'project'),
      createConfigNode('MEMORY.md', 'memory', 'user'),
    ];
    const model = createModel(nodes);
    const result = buildMindMapData(model);

    const memoryBranch = result.children.find((c) => c.subsystem === 'memory');
    expect(memoryBranch!.children).toHaveLength(2);
  });

  it('leaf nodes carry scope for coloring', () => {
    const nodes = [
      createConfigNode('CLAUDE.md', 'memory', 'project'),
      createConfigNode('MEMORY.md', 'memory', 'user'),
    ];
    const model = createModel(nodes);
    const result = buildMindMapData(model);

    const memoryBranch = result.children.find((c) => c.subsystem === 'memory');
    const scopes = memoryBranch!.children.map((c) => c.scope);

    expect(scopes).toContain('project');
    expect(scopes).toContain('user');
  });

  it('leaf nodes carry file name', () => {
    const nodes = [createConfigNode('CLAUDE.md', 'memory', 'project')];
    const model = createModel(nodes);
    const result = buildMindMapData(model);

    const memoryBranch = result.children.find((c) => c.subsystem === 'memory');
    expect(memoryBranch!.children[0].name).toBe('CLAUDE.md');
  });

  it('leaf nodes have empty children array', () => {
    const nodes = [createConfigNode('CLAUDE.md', 'memory', 'project')];
    const model = createModel(nodes);
    const result = buildMindMapData(model);

    const memoryBranch = result.children.find((c) => c.subsystem === 'memory');
    expect(memoryBranch!.children[0].children).toHaveLength(0);
  });

  it('empty subsystem branches have no children', () => {
    const model = createModel([]);
    const result = buildMindMapData(model);

    for (const branch of result.children) {
      expect(branch.children).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Model with 3 populated and 5 empty subsystems
// ---------------------------------------------------------------------------

describe('buildMindMapData - mixed population', () => {
  it('model with files in 3 subsystems yields 8 branches, 3 with children, 5 empty', () => {
    const nodes = [
      createConfigNode('CLAUDE.md', 'memory', 'project'),
      createConfigNode('settings.json', 'settings', 'user'),
      createConfigNode('coding.md', 'rules', 'project'),
      createConfigNode('testing.md', 'rules', 'project'),
    ];
    const model = createModel(nodes);
    const result = buildMindMapData(model);

    expect(result.children).toHaveLength(8);

    const populated = result.children.filter((c) => c.count > 0);
    const empty = result.children.filter((c) => c.count === 0);

    expect(populated).toHaveLength(3);
    expect(empty).toHaveLength(5);

    for (const branch of empty) {
      expect(branch.isEmpty).toBe(true);
      expect(branch.children).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('buildMindMapData - properties', () => {
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

  const nodeArb: fc.Arbitrary<ConfigNode> = fc.record({
    subsystem: subsystemArb,
    scope: scopeArb,
    name: fc.string({ minLength: 1, maxLength: 20 }),
  }).map(({ subsystem, scope, name }) => createConfigNode(name, subsystem, scope));

  const modelArb: fc.Arbitrary<ConfigModel> = fc
    .array(nodeArb, { maxLength: 30 })
    .map((nodes) => createModel(nodes));

  it('always produces exactly 8 branches', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const result = buildMindMapData(model);
        expect(result.children).toHaveLength(8);
      }),
    );
  });

  it('branch counts sum to model totalFiles', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const result = buildMindMapData(model);
        const countSum = result.children.reduce((sum, branch) => sum + branch.count, 0);
        expect(countSum).toBe(model.totalFiles);
      }),
    );
  });

  it('total leaf nodes equals model totalFiles', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const result = buildMindMapData(model);
        const leafCount = result.children.reduce(
          (sum, branch) => sum + branch.children.length,
          0,
        );
        expect(leafCount).toBe(model.totalFiles);
      }),
    );
  });

  it('every leaf node has a valid scope name', () => {
    const validScopes: ScopeName[] = ['managed', 'user', 'project', 'local', 'plugin'];
    fc.assert(
      fc.property(modelArb, (model) => {
        const result = buildMindMapData(model);
        for (const branch of result.children) {
          for (const leaf of branch.children) {
            expect(validScopes).toContain(leaf.scope);
          }
        }
      }),
    );
  });

  it('isEmpty is true if and only if count is zero', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const result = buildMindMapData(model);
        for (const branch of result.children) {
          expect(branch.isEmpty).toBe(branch.count === 0);
        }
      }),
    );
  });
});

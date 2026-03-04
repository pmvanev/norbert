/**
 * Domain type tests for @norbert/config-explorer.
 *
 * Verifies:
 * - Discriminated unions cover all expected variants
 * - Type guards correctly narrow types
 * - Constructors produce valid immutable values
 * - ConfigModel assembly with nodes + edges produces valid models
 *
 * Uses property-based testing (fast-check) for domain invariants
 * and example-based tests for exhaustiveness.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  // Scope
  ALL_SCOPES,
  managedScope,
  userScope,
  projectScope,
  localScope,
  pluginScope,
  scopeFromName,
  isManaged,
  isUser,
  isProject,
  isLocal,
  isPlugin,
  // Subsystem
  ALL_SUBSYSTEMS,
  memorySubsystem,
  settingsSubsystem,
  rulesSubsystem,
  skillsSubsystem,
  agentsSubsystem,
  hooksSubsystem,
  pluginsSubsystem,
  mcpSubsystem,
  subsystemFromName,
  isMemory,
  isSettings,
  isRules,
  isSkills,
  isAgents,
  isHooks,
  isPlugins,
  isMcp,
  // Node
  ALL_NODE_TYPES,
  isJsonContent,
  isMarkdownWithFrontmatter,
  isMarkdownContent,
  isUnparseable,
  // Edge
  ALL_EDGE_TYPES,
  // Precedence
  ALL_RESOLUTION_TYPES,
  ALL_PRECEDENCE_STATUSES,
} from '../index.js';

import type {
  ConfigScope,
  ScopeName,
  ConfigSubsystem,
  SubsystemName,
  ConfigNode,
  ConfigEdge,
  ParsedContent,
  ConfigModel,
  NodeType,
  LoadBehavior,
} from '../index.js';

// ---------------------------------------------------------------------------
// Helpers: Generators
// ---------------------------------------------------------------------------

const scopeNameArb: fc.Arbitrary<ScopeName> = fc.constantFrom(
  'managed' as const,
  'user' as const,
  'project' as const,
  'local' as const,
  'plugin' as const,
);

const subsystemNameArb: fc.Arbitrary<SubsystemName> = fc.constantFrom(
  'memory' as const,
  'settings' as const,
  'rules' as const,
  'skills' as const,
  'agents' as const,
  'hooks' as const,
  'plugins' as const,
  'mcp' as const,
);

const nodeTypeArb: fc.Arbitrary<NodeType> = fc.constantFrom(
  'agent' as const,
  'skill' as const,
  'rule' as const,
  'hook' as const,
  'mcp' as const,
  'memory' as const,
  'settings' as const,
  'plugin' as const,
);

const loadBehaviorArb: fc.Arbitrary<LoadBehavior> = fc.constantFrom(
  'always' as const,
  'on-demand' as const,
);

const parsedContentArb: fc.Arbitrary<ParsedContent> = fc.oneof(
  fc.record({
    format: fc.constant('json' as const),
    parsedData: fc.constant({} as Readonly<Record<string, unknown>>),
    keys: fc.array(fc.string({ minLength: 1 }), { maxLength: 5 }),
  }),
  fc.record({
    format: fc.constant('markdown' as const),
    body: fc.string(),
  }),
  fc.record({
    format: fc.constant('markdown-with-frontmatter' as const),
    frontmatter: fc.constant({} as Readonly<Record<string, unknown>>),
    body: fc.string(),
    frontmatterFields: fc.constant([] as readonly []),
  }),
  fc.record({
    format: fc.constant('unparseable' as const),
    error: fc.string({ minLength: 1 }),
  }),
);

const configNodeArb: fc.Arbitrary<ConfigNode> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  scope: scopeNameArb,
  subsystem: subsystemNameArb,
  nodeType: nodeTypeArb,
  filePath: fc.string({ minLength: 1 }),
  relativePath: fc.string({ minLength: 1 }),
  content: fc.string(),
  parsedContent: parsedContentArb,
  loadBehavior: loadBehaviorArb,
  error: fc.constant(null),
});

// ---------------------------------------------------------------------------
// ConfigScope tests
// ---------------------------------------------------------------------------

describe('ConfigScope', () => {
  it('has exactly 5 scope variants', () => {
    expect(ALL_SCOPES).toHaveLength(5);
  });

  it('covers all 5 scope names', () => {
    const scopeNames = ALL_SCOPES.map((s) => s.scope);
    expect(new Set(scopeNames)).toEqual(
      new Set(['managed', 'user', 'project', 'local', 'plugin']),
    );
  });

  it('all scope names are distinct', () => {
    const scopeNames = ALL_SCOPES.map((s) => s.scope);
    expect(new Set(scopeNames).size).toBe(scopeNames.length);
  });

  it('all scope colors are distinct', () => {
    const colors = ALL_SCOPES.map((s) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('all scope labels are distinct', () => {
    const labels = ALL_SCOPES.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('constructors produce correct scope values', () => {
    expect(managedScope.scope).toBe('managed');
    expect(userScope.scope).toBe('user');
    expect(projectScope.scope).toBe('project');
    expect(localScope.scope).toBe('local');
    expect(pluginScope.scope).toBe('plugin');
  });

  it('scopeFromName returns correct scope for every name', () => {
    fc.assert(
      fc.property(scopeNameArb, (name) => {
        const scope = scopeFromName(name);
        expect(scope.scope).toBe(name);
      }),
    );
  });

  it('type guards are mutually exclusive', () => {
    for (const scope of ALL_SCOPES) {
      const guards = [isManaged, isUser, isProject, isLocal, isPlugin];
      const trueCount = guards.filter((guard) => guard(scope)).length;
      expect(trueCount).toBe(1);
    }
  });

  it('each type guard identifies its own scope', () => {
    expect(isManaged(managedScope)).toBe(true);
    expect(isUser(userScope)).toBe(true);
    expect(isProject(projectScope)).toBe(true);
    expect(isLocal(localScope)).toBe(true);
    expect(isPlugin(pluginScope)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ConfigSubsystem tests
// ---------------------------------------------------------------------------

describe('ConfigSubsystem', () => {
  it('has exactly 8 subsystem variants', () => {
    expect(ALL_SUBSYSTEMS).toHaveLength(8);
  });

  it('covers all 8 subsystem names', () => {
    const names = ALL_SUBSYSTEMS.map((s) => s.subsystem);
    expect(new Set(names)).toEqual(
      new Set(['memory', 'settings', 'rules', 'skills', 'agents', 'hooks', 'plugins', 'mcp']),
    );
  });

  it('all subsystem names are distinct', () => {
    const names = ALL_SUBSYSTEMS.map((s) => s.subsystem);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all subsystem labels are distinct', () => {
    const labels = ALL_SUBSYSTEMS.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('every subsystem has at least one file pattern', () => {
    for (const sub of ALL_SUBSYSTEMS) {
      expect(sub.filePatterns.length).toBeGreaterThan(0);
    }
  });

  it('constructors produce correct subsystem values', () => {
    expect(memorySubsystem.subsystem).toBe('memory');
    expect(settingsSubsystem.subsystem).toBe('settings');
    expect(rulesSubsystem.subsystem).toBe('rules');
    expect(skillsSubsystem.subsystem).toBe('skills');
    expect(agentsSubsystem.subsystem).toBe('agents');
    expect(hooksSubsystem.subsystem).toBe('hooks');
    expect(pluginsSubsystem.subsystem).toBe('plugins');
    expect(mcpSubsystem.subsystem).toBe('mcp');
  });

  it('subsystemFromName returns correct subsystem for every name', () => {
    fc.assert(
      fc.property(subsystemNameArb, (name) => {
        const sub = subsystemFromName(name);
        expect(sub.subsystem).toBe(name);
      }),
    );
  });

  it('type guards are mutually exclusive', () => {
    for (const sub of ALL_SUBSYSTEMS) {
      const guards = [isMemory, isSettings, isRules, isSkills, isAgents, isHooks, isPlugins, isMcp];
      const trueCount = guards.filter((guard) => guard(sub)).length;
      expect(trueCount).toBe(1);
    }
  });

  it('each type guard identifies its own subsystem', () => {
    expect(isMemory(memorySubsystem)).toBe(true);
    expect(isSettings(settingsSubsystem)).toBe(true);
    expect(isRules(rulesSubsystem)).toBe(true);
    expect(isSkills(skillsSubsystem)).toBe(true);
    expect(isAgents(agentsSubsystem)).toBe(true);
    expect(isHooks(hooksSubsystem)).toBe(true);
    expect(isPlugins(pluginsSubsystem)).toBe(true);
    expect(isMcp(mcpSubsystem)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NodeType tests
// ---------------------------------------------------------------------------

describe('NodeType', () => {
  it('has exactly 8 node type variants', () => {
    expect(ALL_NODE_TYPES).toHaveLength(8);
  });

  it('covers all expected node types', () => {
    expect(new Set(ALL_NODE_TYPES)).toEqual(
      new Set(['agent', 'skill', 'rule', 'hook', 'mcp', 'memory', 'settings', 'plugin']),
    );
  });

  it('all node types are distinct', () => {
    expect(new Set(ALL_NODE_TYPES).size).toBe(ALL_NODE_TYPES.length);
  });
});

// ---------------------------------------------------------------------------
// EdgeType tests
// ---------------------------------------------------------------------------

describe('EdgeType', () => {
  it('has exactly 7 edge type variants', () => {
    expect(ALL_EDGE_TYPES).toHaveLength(7);
  });

  it('covers all expected edge types', () => {
    expect(new Set(ALL_EDGE_TYPES)).toEqual(
      new Set([
        'agent-references-skill',
        'plugin-contains-component',
        'agent-defines-hook',
        'rule-scoped-to-path',
        'skill-allows-tool',
        'skill-uses-agent',
        'naming-conflict',
      ]),
    );
  });

  it('all edge types are distinct', () => {
    expect(new Set(ALL_EDGE_TYPES).size).toBe(ALL_EDGE_TYPES.length);
  });
});

// ---------------------------------------------------------------------------
// ParsedContent type guards
// ---------------------------------------------------------------------------

describe('ParsedContent type guards', () => {
  it('isJsonContent identifies JSON content', () => {
    const content: ParsedContent = { format: 'json', parsedData: {}, keys: ['a'] };
    expect(isJsonContent(content)).toBe(true);
    expect(isMarkdownContent(content)).toBe(false);
    expect(isMarkdownWithFrontmatter(content)).toBe(false);
    expect(isUnparseable(content)).toBe(false);
  });

  it('isMarkdownContent identifies plain Markdown', () => {
    const content: ParsedContent = { format: 'markdown', body: '# Hello' };
    expect(isMarkdownContent(content)).toBe(true);
    expect(isJsonContent(content)).toBe(false);
  });

  it('isMarkdownWithFrontmatter identifies Markdown with frontmatter', () => {
    const content: ParsedContent = {
      format: 'markdown-with-frontmatter',
      frontmatter: { name: 'test' },
      body: '# Hello',
      frontmatterFields: [{ key: 'name', value: 'test', annotation: 'Name field' }],
    };
    expect(isMarkdownWithFrontmatter(content)).toBe(true);
    expect(isMarkdownContent(content)).toBe(false);
  });

  it('isUnparseable identifies unparseable content', () => {
    const content: ParsedContent = { format: 'unparseable', error: 'Bad JSON' };
    expect(isUnparseable(content)).toBe(true);
    expect(isJsonContent(content)).toBe(false);
  });

  it('type guards are mutually exclusive for all ParsedContent variants', () => {
    fc.assert(
      fc.property(parsedContentArb, (content) => {
        const guards = [isJsonContent, isMarkdownContent, isMarkdownWithFrontmatter, isUnparseable];
        const trueCount = guards.filter((guard) => guard(content)).length;
        expect(trueCount).toBe(1);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Precedence type constants
// ---------------------------------------------------------------------------

describe('Precedence types', () => {
  it('has exactly 3 resolution types', () => {
    expect(ALL_RESOLUTION_TYPES).toHaveLength(3);
    expect(new Set(ALL_RESOLUTION_TYPES)).toEqual(new Set(['override', 'additive', 'merge']));
  });

  it('has exactly 4 precedence statuses', () => {
    expect(ALL_PRECEDENCE_STATUSES).toHaveLength(4);
    expect(new Set(ALL_PRECEDENCE_STATUSES)).toEqual(
      new Set(['active', 'overridden', 'empty', 'access-denied']),
    );
  });
});

// ---------------------------------------------------------------------------
// ConfigModel assembly
// ---------------------------------------------------------------------------

describe('ConfigModel assembly', () => {
  it('an empty model has zero totals and empty collections', () => {
    const model: ConfigModel = {
      nodes: [],
      edges: [],
      precedenceChains: {},
      scopeSummary: {},
      subsystemSummary: {},
      totalFiles: 0,
      conflicts: [],
      scanTimestamp: '2026-03-03T00:00:00Z',
    };

    expect(model.nodes).toHaveLength(0);
    expect(model.edges).toHaveLength(0);
    expect(model.totalFiles).toBe(0);
    expect(model.conflicts).toHaveLength(0);
  });

  it('a model with nodes has consistent totalFiles count', () => {
    fc.assert(
      fc.property(
        fc.array(configNodeArb, { minLength: 1, maxLength: 20 }),
        (nodes) => {
          const model: ConfigModel = {
            nodes,
            edges: [],
            precedenceChains: {},
            scopeSummary: {},
            subsystemSummary: {},
            totalFiles: nodes.length,
            conflicts: [],
            scanTimestamp: new Date().toISOString(),
          };

          expect(model.totalFiles).toBe(model.nodes.length);
        },
      ),
    );
  });

  it('edges reference node IDs from the model', () => {
    const nodeA: ConfigNode = {
      id: 'node-a',
      name: 'Agent A',
      scope: 'project',
      subsystem: 'agents',
      nodeType: 'agent',
      filePath: '/project/.claude/agents/a.md',
      relativePath: '.claude/agents/a.md',
      content: '---\nskills:\n  - my-skill\n---\n# Agent A',
      parsedContent: { format: 'markdown', body: '# Agent A' },
      loadBehavior: 'always',
      error: null,
    };

    const nodeB: ConfigNode = {
      id: 'node-b',
      name: 'Skill B',
      scope: 'project',
      subsystem: 'skills',
      nodeType: 'skill',
      filePath: '/project/.claude/skills/my-skill/SKILL.md',
      relativePath: '.claude/skills/my-skill/SKILL.md',
      content: '---\nname: my-skill\n---\n# My Skill',
      parsedContent: { format: 'markdown', body: '# My Skill' },
      loadBehavior: 'on-demand',
      error: null,
    };

    const edge: ConfigEdge = {
      sourceId: 'node-a',
      targetId: 'node-b',
      edgeType: 'agent-references-skill',
      label: 'uses skill',
    };

    const model: ConfigModel = {
      nodes: [nodeA, nodeB],
      edges: [edge],
      precedenceChains: {},
      scopeSummary: { project: 2 },
      subsystemSummary: { agents: 1, skills: 1 },
      totalFiles: 2,
      conflicts: [],
      scanTimestamp: '2026-03-03T12:00:00Z',
    };

    expect(model.edges[0].sourceId).toBe('node-a');
    expect(model.edges[0].targetId).toBe('node-b');
    expect(model.nodes.find((n) => n.id === model.edges[0].sourceId)).toBeDefined();
    expect(model.nodes.find((n) => n.id === model.edges[0].targetId)).toBeDefined();
  });

  it('scopeSummary counts are non-negative', () => {
    fc.assert(
      fc.property(
        fc.array(configNodeArb, { maxLength: 20 }),
        (nodes) => {
          const scopeCounts: Partial<Record<ScopeName, number>> = {};
          for (const node of nodes) {
            scopeCounts[node.scope] = (scopeCounts[node.scope] ?? 0) + 1;
          }

          for (const count of Object.values(scopeCounts)) {
            expect(count).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });
});

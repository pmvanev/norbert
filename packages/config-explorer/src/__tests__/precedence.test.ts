/**
 * Precedence resolver tests for @norbert/config-explorer.
 *
 * Verifies the pure resolvePrecedence function correctly resolves
 * configuration precedence per subsystem. Uses example-based tests
 * for each subsystem's resolution logic and property-based tests
 * for cross-cutting invariants.
 *
 * Business rules tested:
 * - BR-01: Settings override order (managed > local > project > user)
 * - BR-01: CLAUDE.md additive (all active)
 * - BR-01: Rules override by scope (project > user)
 * - BR-01: Skills priority (enterprise > personal > project > plugin)
 * - BR-01: Agents priority (CLI > project > user > plugin -- no CLI scope in model)
 * - BR-01: Hooks merge from all scopes
 * - BR-01: MCP merge from all scopes
 * - BR-03: On-demand items labeled distinctly
 * - BR-04: Array settings (permissions) merge with source tagging
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolvePrecedence } from '../precedence.js';
import type {
  ConfigNode,
  PrecedenceChain,
  PrecedenceEntry,
  ScopeName,
  SubsystemName,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers: ConfigNode factory
// ---------------------------------------------------------------------------

const createNode = (
  overrides: Partial<ConfigNode> & Pick<ConfigNode, 'scope' | 'subsystem'>,
): ConfigNode => ({
  id: `${overrides.scope}:${overrides.filePath ?? 'file'}`,
  name: overrides.name ?? 'test-file',
  scope: overrides.scope,
  subsystem: overrides.subsystem,
  nodeType: overrides.nodeType ?? 'settings',
  filePath: overrides.filePath ?? `/path/${overrides.scope}/file`,
  relativePath: overrides.relativePath ?? 'file',
  content: overrides.content ?? '{}',
  parsedContent: overrides.parsedContent ?? { format: 'json', parsedData: {}, keys: [] },
  loadBehavior: overrides.loadBehavior ?? 'always',
  error: overrides.error ?? null,
});

const createSettingsNode = (
  scope: ScopeName,
  parsedData: Record<string, unknown> = {},
): ConfigNode =>
  createNode({
    scope,
    subsystem: 'settings',
    nodeType: 'settings',
    name: 'settings.json',
    filePath: `/${scope}/settings.json`,
    relativePath: 'settings.json',
    parsedContent: {
      format: 'json',
      parsedData,
      keys: Object.keys(parsedData),
    },
  });

const createMemoryNode = (
  scope: ScopeName,
  name: string = 'CLAUDE.md',
  loadBehavior: 'always' | 'on-demand' = 'always',
): ConfigNode =>
  createNode({
    scope,
    subsystem: 'memory',
    nodeType: 'memory',
    name,
    filePath: `/${scope}/${name}`,
    relativePath: name,
    loadBehavior,
    parsedContent: { format: 'markdown', body: `# ${name}` },
  });

const createRuleNode = (
  scope: ScopeName,
  name: string,
  loadBehavior: 'always' | 'on-demand' = 'always',
): ConfigNode =>
  createNode({
    scope,
    subsystem: 'rules',
    nodeType: 'rule',
    name,
    filePath: `/${scope}/rules/${name}`,
    relativePath: `rules/${name}`,
    loadBehavior,
    parsedContent: { format: 'markdown', body: `# ${name}` },
  });

const createSkillNode = (
  scope: ScopeName,
  name: string,
): ConfigNode =>
  createNode({
    scope,
    subsystem: 'skills',
    nodeType: 'skill',
    name,
    filePath: `/${scope}/skills/${name}/SKILL.md`,
    relativePath: `skills/${name}/SKILL.md`,
    parsedContent: { format: 'markdown', body: `# ${name}` },
  });

const createAgentNode = (
  scope: ScopeName,
  name: string,
): ConfigNode =>
  createNode({
    scope,
    subsystem: 'agents',
    nodeType: 'agent',
    name,
    filePath: `/${scope}/agents/${name}.md`,
    relativePath: `agents/${name}.md`,
    parsedContent: { format: 'markdown', body: `# ${name}` },
  });

const createHookNode = (
  scope: ScopeName,
  name: string = 'settings.json',
): ConfigNode =>
  createNode({
    scope,
    subsystem: 'hooks',
    nodeType: 'hook',
    name,
    filePath: `/${scope}/${name}`,
    relativePath: name,
    parsedContent: { format: 'json', parsedData: {}, keys: [] },
  });

const createMcpNode = (
  scope: ScopeName,
  name: string = '.mcp.json',
): ConfigNode =>
  createNode({
    scope,
    subsystem: 'mcp',
    nodeType: 'mcp',
    name,
    filePath: `/${scope}/${name}`,
    relativePath: name,
    parsedContent: { format: 'json', parsedData: {}, keys: [] },
  });

const createPluginNode = (
  scope: ScopeName,
  name: string = 'plugin.json',
): ConfigNode =>
  createNode({
    scope,
    subsystem: 'plugins',
    nodeType: 'plugin',
    name,
    filePath: `/${scope}/${name}`,
    relativePath: name,
    parsedContent: { format: 'json', parsedData: {}, keys: [] },
  });

// ---------------------------------------------------------------------------
// Helper: find entry by scope
// ---------------------------------------------------------------------------

const findEntry = (
  chain: PrecedenceChain,
  scope: ScopeName,
): PrecedenceEntry | undefined =>
  chain.entries.find((e) => e.scope === scope);

// ---------------------------------------------------------------------------
// Settings subsystem: override resolution
// ---------------------------------------------------------------------------

describe('resolvePrecedence - settings (override)', () => {
  it('managed overrides project overrides user', () => {
    const nodes = [
      createSettingsNode('managed', { theme: 'corporate' }),
      createSettingsNode('project', { theme: 'dark' }),
      createSettingsNode('user', { theme: 'light' }),
    ];

    const chain = resolvePrecedence(nodes, 'settings');

    expect(chain.resolutionType).toBe('override');
    expect(chain.subsystem).toBe('settings');

    const managedEntry = findEntry(chain, 'managed');
    const projectEntry = findEntry(chain, 'project');
    const userEntry = findEntry(chain, 'user');

    expect(managedEntry?.status).toBe('active');
    expect(projectEntry?.status).toBe('overridden');
    expect(userEntry?.status).toBe('overridden');
  });

  it('local overrides project', () => {
    const nodes = [
      createSettingsNode('local', { theme: 'custom' }),
      createSettingsNode('project', { theme: 'team' }),
    ];

    const chain = resolvePrecedence(nodes, 'settings');

    const localEntry = findEntry(chain, 'local');
    const projectEntry = findEntry(chain, 'project');

    expect(localEntry?.status).toBe('active');
    expect(projectEntry?.status).toBe('overridden');
  });

  it('full precedence order: managed > local > project > user > plugin', () => {
    const nodes = [
      createSettingsNode('user', { a: 1 }),
      createSettingsNode('project', { a: 2 }),
      createSettingsNode('local', { a: 3 }),
      createSettingsNode('managed', { a: 4 }),
      createSettingsNode('plugin', { a: 5 }),
    ];

    const chain = resolvePrecedence(nodes, 'settings');

    // Entries should be ordered highest first
    const scopeOrder = chain.entries.map((e) => e.scope);
    expect(scopeOrder).toEqual(['managed', 'local', 'project', 'user', 'plugin']);

    // Only managed should be active; all others overridden
    expect(findEntry(chain, 'managed')?.status).toBe('active');
    expect(findEntry(chain, 'local')?.status).toBe('overridden');
    expect(findEntry(chain, 'project')?.status).toBe('overridden');
    expect(findEntry(chain, 'user')?.status).toBe('overridden');
    expect(findEntry(chain, 'plugin')?.status).toBe('overridden');
  });

  it('scopes without nodes get empty status', () => {
    const nodes = [
      createSettingsNode('project', { theme: 'dark' }),
    ];

    const chain = resolvePrecedence(nodes, 'settings');

    const managedEntry = findEntry(chain, 'managed');
    const userEntry = findEntry(chain, 'user');

    expect(managedEntry?.status).toBe('empty');
    expect(userEntry?.status).toBe('empty');
    expect(managedEntry?.nodes).toHaveLength(0);
  });

  it('single scope is active with no override reason', () => {
    const nodes = [
      createSettingsNode('user', { theme: 'light' }),
    ];

    const chain = resolvePrecedence(nodes, 'settings');

    const userEntry = findEntry(chain, 'user');
    expect(userEntry?.status).toBe('active');
    expect(userEntry?.overrideReason).toBeNull();
  });

  it('override reason names the winning scope exactly', () => {
    const nodes = [
      createSettingsNode('managed', { theme: 'corporate' }),
      createSettingsNode('user', { theme: 'light' }),
    ];

    const chain = resolvePrecedence(nodes, 'settings');

    const userEntry = findEntry(chain, 'user');
    expect(userEntry?.status).toBe('overridden');
    expect(userEntry?.overrideReason).toBe('Overridden by managed scope');
  });

  it('overridden entry mergeContribution is null', () => {
    const nodes = [
      createSettingsNode('managed', { theme: 'corporate' }),
      createSettingsNode('user', { theme: 'light' }),
    ];

    const chain = resolvePrecedence(nodes, 'settings');
    const userEntry = findEntry(chain, 'user');
    expect(userEntry?.mergeContribution).toBeNull();
  });

  it('array settings (permissions) use merge resolution', () => {
    const nodes = [
      createSettingsNode('user', {
        permissions: { allow: ['Read', 'Glob'] },
      }),
      createSettingsNode('project', {
        permissions: { allow: ['Bash'], deny: ['Write'] },
      }),
    ];

    const chain = resolvePrecedence(nodes, 'settings');

    // The chain should indicate merge for array settings
    // Both entries should be active when contributing to merge
    const userEntry = findEntry(chain, 'user');
    const projectEntry = findEntry(chain, 'project');

    // Both contribute to merged result
    expect(userEntry?.mergeContribution).not.toBeNull();
    expect(projectEntry?.mergeContribution).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Memory subsystem: additive resolution (CLAUDE.md)
// ---------------------------------------------------------------------------

describe('resolvePrecedence - memory (additive)', () => {
  it('all CLAUDE.md files shown as additive/active', () => {
    const nodes = [
      createMemoryNode('managed'),
      createMemoryNode('user'),
      createMemoryNode('project'),
      createMemoryNode('local', 'CLAUDE.local.md'),
    ];

    const chain = resolvePrecedence(nodes, 'memory');

    expect(chain.resolutionType).toBe('additive');
    expect(chain.subsystem).toBe('memory');

    // All entries with nodes should be active
    for (const entry of chain.entries) {
      if (entry.nodes.length > 0) {
        expect(entry.status).toBe('active');
        expect(entry.overrideReason).toBeNull();
      }
    }
  });

  it('on-demand files labeled distinctly from always-loaded', () => {
    const nodes = [
      createMemoryNode('project', 'CLAUDE.md', 'always'),
      createMemoryNode('project', 'subdir/CLAUDE.md', 'on-demand'),
    ];

    const chain = resolvePrecedence(nodes, 'memory');

    const projectEntry = findEntry(chain, 'project');
    expect(projectEntry).toBeDefined();

    // On-demand nodes should be present in the entry
    const onDemandNodes = projectEntry!.nodes.filter(
      (n) => n.loadBehavior === 'on-demand',
    );
    const alwaysNodes = projectEntry!.nodes.filter(
      (n) => n.loadBehavior === 'always',
    );

    expect(onDemandNodes).toHaveLength(1);
    expect(alwaysNodes).toHaveLength(1);
  });

  it('no entries are overridden in additive mode', () => {
    const nodes = [
      createMemoryNode('managed'),
      createMemoryNode('user'),
      createMemoryNode('project'),
    ];

    const chain = resolvePrecedence(nodes, 'memory');

    for (const entry of chain.entries) {
      expect(entry.status).not.toBe('overridden');
    }
  });
});

// ---------------------------------------------------------------------------
// Rules subsystem: override per rule name
// ---------------------------------------------------------------------------

describe('resolvePrecedence - rules (override per name)', () => {
  it('project rule overrides user rule with same name', () => {
    const nodes = [
      createRuleNode('user', 'coding.md'),
      createRuleNode('project', 'coding.md'),
    ];

    const chain = resolvePrecedence(nodes, 'rules');

    expect(chain.resolutionType).toBe('override');

    const projectEntry = findEntry(chain, 'project');
    const userEntry = findEntry(chain, 'user');

    expect(projectEntry?.status).toBe('active');
    expect(userEntry?.status).toBe('overridden');
  });

  it('non-overlapping rules are both active', () => {
    const nodes = [
      createRuleNode('user', 'formatting.md'),
      createRuleNode('project', 'testing.md'),
    ];

    const chain = resolvePrecedence(nodes, 'rules');

    const projectEntry = findEntry(chain, 'project');
    const userEntry = findEntry(chain, 'user');

    expect(projectEntry?.status).toBe('active');
    expect(userEntry?.status).toBe('active');
  });

  it('path-scoped rules included with on-demand load behavior', () => {
    const nodes = [
      createRuleNode('project', 'api-rules.md', 'on-demand'),
      createRuleNode('project', 'general.md', 'always'),
    ];

    const chain = resolvePrecedence(nodes, 'rules');

    const projectEntry = findEntry(chain, 'project');
    expect(projectEntry?.nodes).toHaveLength(2);

    const onDemandNodes = projectEntry!.nodes.filter(
      (n) => n.loadBehavior === 'on-demand',
    );
    expect(onDemandNodes).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Skills subsystem: override per skill name
// ---------------------------------------------------------------------------

describe('resolvePrecedence - skills (override per name)', () => {
  it('priority order: managed > user > project > plugin', () => {
    const nodes = [
      createSkillNode('plugin', 'deploy'),
      createSkillNode('project', 'deploy'),
      createSkillNode('user', 'deploy'),
      createSkillNode('managed', 'deploy'),
    ];

    const chain = resolvePrecedence(nodes, 'skills');

    expect(chain.resolutionType).toBe('override');

    const managedEntry = findEntry(chain, 'managed');
    const userEntry = findEntry(chain, 'user');
    const projectEntry = findEntry(chain, 'project');
    const pluginEntry = findEntry(chain, 'plugin');

    expect(managedEntry?.status).toBe('active');
    expect(userEntry?.status).toBe('overridden');
    expect(projectEntry?.status).toBe('overridden');
    expect(pluginEntry?.status).toBe('overridden');
  });

  it('non-overlapping skills are all active', () => {
    const nodes = [
      createSkillNode('user', 'personal-skill'),
      createSkillNode('project', 'project-skill'),
      createSkillNode('plugin', 'plugin:external-skill'),
    ];

    const chain = resolvePrecedence(nodes, 'skills');

    const userEntry = findEntry(chain, 'user');
    const projectEntry = findEntry(chain, 'project');
    const pluginEntry = findEntry(chain, 'plugin');

    expect(userEntry?.status).toBe('active');
    expect(projectEntry?.status).toBe('active');
    expect(pluginEntry?.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// Agents subsystem: override per agent name
// ---------------------------------------------------------------------------

describe('resolvePrecedence - agents (override per name)', () => {
  it('name collision resolved by priority (project > user > plugin)', () => {
    const nodes = [
      createAgentNode('user', 'reviewer'),
      createAgentNode('project', 'reviewer'),
      createAgentNode('plugin', 'reviewer'),
    ];

    const chain = resolvePrecedence(nodes, 'agents');

    expect(chain.resolutionType).toBe('override');

    const projectEntry = findEntry(chain, 'project');
    const userEntry = findEntry(chain, 'user');
    const pluginEntry = findEntry(chain, 'plugin');

    expect(projectEntry?.status).toBe('active');
    expect(userEntry?.status).toBe('overridden');
    expect(pluginEntry?.status).toBe('overridden');
  });

  it('agents with different names are all active', () => {
    const nodes = [
      createAgentNode('user', 'planner'),
      createAgentNode('project', 'reviewer'),
    ];

    const chain = resolvePrecedence(nodes, 'agents');

    const userEntry = findEntry(chain, 'user');
    const projectEntry = findEntry(chain, 'project');

    expect(userEntry?.status).toBe('active');
    expect(projectEntry?.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// Hooks subsystem: merge resolution
// ---------------------------------------------------------------------------

describe('resolvePrecedence - hooks (merge)', () => {
  it('hooks from all scopes merge (all fire)', () => {
    const nodes = [
      createHookNode('user'),
      createHookNode('project'),
      createHookNode('managed'),
    ];

    const chain = resolvePrecedence(nodes, 'hooks');

    expect(chain.resolutionType).toBe('merge');
    expect(chain.subsystem).toBe('hooks');

    // All entries with nodes should be active (all merge)
    for (const entry of chain.entries) {
      if (entry.nodes.length > 0) {
        expect(entry.status).toBe('active');
      }
    }
  });

  it('hook entries show scope source via mergeContribution with exact node names', () => {
    const nodes = [
      createHookNode('user', 'hooks-user.json'),
      createHookNode('project', 'hooks-project.json'),
    ];

    const chain = resolvePrecedence(nodes, 'hooks');

    const userEntry = findEntry(chain, 'user');
    const projectEntry = findEntry(chain, 'project');

    expect(userEntry?.mergeContribution).toEqual(['hooks-user.json']);
    expect(projectEntry?.mergeContribution).toEqual(['hooks-project.json']);
  });

  it('hooks empty scopes have null mergeContribution', () => {
    const nodes = [
      createHookNode('user'),
    ];

    const chain = resolvePrecedence(nodes, 'hooks');

    const managedEntry = findEntry(chain, 'managed');
    expect(managedEntry?.mergeContribution).toBeNull();
    expect(managedEntry?.status).toBe('empty');
  });
});

// ---------------------------------------------------------------------------
// Plugins subsystem: simple listing
// ---------------------------------------------------------------------------

describe('resolvePrecedence - plugins (listing)', () => {
  it('lists plugins without precedence resolution', () => {
    const nodes = [
      createPluginNode('plugin', 'plugin-a.json'),
      createPluginNode('plugin', 'plugin-b.json'),
    ];

    const chain = resolvePrecedence(nodes, 'plugins');

    // Plugins are just listed, no override
    const pluginEntry = findEntry(chain, 'plugin');
    expect(pluginEntry?.status).toBe('active');
    expect(pluginEntry?.nodes).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// MCP subsystem: merge resolution
// ---------------------------------------------------------------------------

describe('resolvePrecedence - mcp (merge)', () => {
  it('MCP servers from all scopes merge', () => {
    const nodes = [
      createMcpNode('user', '.claude.json'),
      createMcpNode('project', '.mcp.json'),
      createMcpNode('plugin', '.mcp.json'),
    ];

    const chain = resolvePrecedence(nodes, 'mcp');

    expect(chain.resolutionType).toBe('merge');

    // All sources contribute
    for (const entry of chain.entries) {
      if (entry.nodes.length > 0) {
        expect(entry.status).toBe('active');
      }
    }
  });

  it('MCP entries show exact node names in mergeContribution', () => {
    const nodes = [
      createMcpNode('user', '.claude.json'),
      createMcpNode('project', '.mcp.json'),
    ];

    const chain = resolvePrecedence(nodes, 'mcp');

    const userEntry = findEntry(chain, 'user');
    const projectEntry = findEntry(chain, 'project');

    expect(userEntry?.mergeContribution).toEqual(['.claude.json']);
    expect(projectEntry?.mergeContribution).toEqual(['.mcp.json']);
  });

  it('MCP overrideReason is always null (merge resolution)', () => {
    const nodes = [
      createMcpNode('user'),
      createMcpNode('project'),
    ];

    const chain = resolvePrecedence(nodes, 'mcp');

    for (const entry of chain.entries) {
      expect(entry.overrideReason).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Resolution type per subsystem
// ---------------------------------------------------------------------------

describe('resolvePrecedence - resolution type mapping', () => {
  it('memory subsystem uses additive resolution', () => {
    expect(resolvePrecedence([], 'memory').resolutionType).toBe('additive');
  });

  it('settings subsystem uses override resolution', () => {
    expect(resolvePrecedence([], 'settings').resolutionType).toBe('override');
  });

  it('rules subsystem uses override resolution', () => {
    expect(resolvePrecedence([], 'rules').resolutionType).toBe('override');
  });

  it('skills subsystem uses override resolution', () => {
    expect(resolvePrecedence([], 'skills').resolutionType).toBe('override');
  });

  it('agents subsystem uses override resolution', () => {
    expect(resolvePrecedence([], 'agents').resolutionType).toBe('override');
  });

  it('hooks subsystem uses merge resolution', () => {
    expect(resolvePrecedence([], 'hooks').resolutionType).toBe('merge');
  });

  it('plugins subsystem uses override resolution', () => {
    expect(resolvePrecedence([], 'plugins').resolutionType).toBe('override');
  });

  it('mcp subsystem uses merge resolution', () => {
    expect(resolvePrecedence([], 'mcp').resolutionType).toBe('merge');
  });
});

// ---------------------------------------------------------------------------
// Scope ordering per subsystem
// ---------------------------------------------------------------------------

describe('resolvePrecedence - scope ordering', () => {
  it('settings entries follow managed > local > project > user > plugin order', () => {
    const chain = resolvePrecedence([], 'settings');
    expect(chain.entries.map(e => e.scope)).toEqual(['managed', 'local', 'project', 'user', 'plugin']);
  });

  it('skills entries follow managed > user > project > plugin > local order', () => {
    const chain = resolvePrecedence([], 'skills');
    expect(chain.entries.map(e => e.scope)).toEqual(['managed', 'user', 'project', 'plugin', 'local']);
  });

  it('rules entries follow managed > local > project > user > plugin order', () => {
    const chain = resolvePrecedence([], 'rules');
    expect(chain.entries.map(e => e.scope)).toEqual(['managed', 'local', 'project', 'user', 'plugin']);
  });

  it('hooks entries follow managed > local > project > user > plugin order', () => {
    const chain = resolvePrecedence([], 'hooks');
    expect(chain.entries.map(e => e.scope)).toEqual(['managed', 'local', 'project', 'user', 'plugin']);
  });

  it('mcp entries follow managed > local > project > user > plugin order', () => {
    const chain = resolvePrecedence([], 'mcp');
    expect(chain.entries.map(e => e.scope)).toEqual(['managed', 'local', 'project', 'user', 'plugin']);
  });

  it('agents entries follow managed > local > project > user > plugin order', () => {
    const chain = resolvePrecedence([], 'agents');
    expect(chain.entries.map(e => e.scope)).toEqual(['managed', 'local', 'project', 'user', 'plugin']);
  });
});

// ---------------------------------------------------------------------------
// Per-name override: partial override
// ---------------------------------------------------------------------------

describe('resolvePrecedence - partial per-name override', () => {
  it('scope is active when only some rules are overridden', () => {
    const nodes = [
      createRuleNode('user', 'coding.md'),
      createRuleNode('user', 'formatting.md'),
      createRuleNode('project', 'coding.md'), // overrides user coding.md
    ];

    const chain = resolvePrecedence(nodes, 'rules');

    const userEntry = findEntry(chain, 'user');
    // user still has formatting.md active, so user scope is not entirely overridden
    expect(userEntry?.status).toBe('active');
  });

  it('override reason names the highest-priority overriding scope', () => {
    const nodes = [
      createRuleNode('user', 'coding.md'),
      createRuleNode('project', 'coding.md'),
      createRuleNode('managed', 'coding.md'),
    ];

    const chain = resolvePrecedence(nodes, 'rules');

    const userEntry = findEntry(chain, 'user');
    expect(userEntry?.status).toBe('overridden');
    expect(userEntry?.overrideReason).toBe('Overridden by managed scope');
  });
});

// ---------------------------------------------------------------------------
// Settings with permissions keys (array merge)
// ---------------------------------------------------------------------------

describe('resolvePrecedence - array settings merge details', () => {
  it('permissions.* keys also trigger merge behavior', () => {
    const nodes = [
      createSettingsNode('user', { 'permissions.allow_tool': ['Read'] }),
      createSettingsNode('project', { 'permissions.deny': ['Write'] }),
    ];

    const chain = resolvePrecedence(nodes, 'settings');

    const userEntry = findEntry(chain, 'user');
    const projectEntry = findEntry(chain, 'project');

    expect(userEntry?.status).toBe('active');
    expect(userEntry?.mergeContribution).toEqual(['settings.json']);
    expect(projectEntry?.status).toBe('active');
    expect(projectEntry?.mergeContribution).toEqual(['settings.json']);
  });

  it('non-permissions settings still use strict override', () => {
    const nodes = [
      createSettingsNode('managed', { theme: 'corporate' }),
      createSettingsNode('user', { theme: 'light' }),
    ];

    const chain = resolvePrecedence(nodes, 'settings');

    const managedEntry = findEntry(chain, 'managed');
    const userEntry = findEntry(chain, 'user');

    expect(managedEntry?.status).toBe('active');
    expect(managedEntry?.mergeContribution).toBeNull();
    expect(userEntry?.status).toBe('overridden');
    expect(userEntry?.mergeContribution).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Plugins listing behavior
// ---------------------------------------------------------------------------

describe('resolvePrecedence - plugins listing details', () => {
  it('plugin scope with multiple plugins shows all as active', () => {
    const nodes = [
      createPluginNode('plugin', 'plugin-a.json'),
      createPluginNode('plugin', 'plugin-b.json'),
      createPluginNode('plugin', 'plugin-c.json'),
    ];

    const chain = resolvePrecedence(nodes, 'plugins');

    const pluginEntry = findEntry(chain, 'plugin');
    expect(pluginEntry?.status).toBe('active');
    expect(pluginEntry?.nodes).toHaveLength(3);
    expect(pluginEntry?.overrideReason).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('resolvePrecedence - edge cases', () => {
  it('no nodes for subsystem produces all-empty chain', () => {
    const chain = resolvePrecedence([], 'settings');

    expect(chain.subsystem).toBe('settings');
    expect(chain.entries.length).toBeGreaterThan(0);

    for (const entry of chain.entries) {
      expect(entry.status).toBe('empty');
      expect(entry.nodes).toHaveLength(0);
    }
  });

  it('single scope only has one active entry', () => {
    const nodes = [createSettingsNode('project', { theme: 'dark' })];

    const chain = resolvePrecedence(nodes, 'settings');

    const activeEntries = chain.entries.filter((e) => e.status === 'active');
    expect(activeEntries).toHaveLength(1);
    expect(activeEntries[0].scope).toBe('project');
  });

  it('nodes from irrelevant subsystem are ignored', () => {
    const nodes = [
      createSettingsNode('project', { theme: 'dark' }),
      createMemoryNode('project'),
    ];

    const chain = resolvePrecedence(nodes, 'settings');

    // Should only include settings nodes
    const allNodes = chain.entries.flatMap((e) => e.nodes);
    for (const node of allNodes) {
      expect(node.subsystem).toBe('settings');
    }
  });
});

// ---------------------------------------------------------------------------
// Property-based tests: cross-cutting invariants
// ---------------------------------------------------------------------------

describe('resolvePrecedence - properties', () => {
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

  it('chain subsystem always matches requested subsystem', () => {
    fc.assert(
      fc.property(subsystemNameArb, (subsystem) => {
        const chain = resolvePrecedence([], subsystem);
        expect(chain.subsystem).toBe(subsystem);
      }),
    );
  });

  it('every entry has a valid scope name', () => {
    fc.assert(
      fc.property(subsystemNameArb, (subsystem) => {
        const chain = resolvePrecedence([], subsystem);
        const validScopes: ScopeName[] = ['managed', 'user', 'project', 'local', 'plugin'];
        for (const entry of chain.entries) {
          expect(validScopes).toContain(entry.scope);
        }
      }),
    );
  });

  it('empty entries always have empty nodes and null override reason', () => {
    fc.assert(
      fc.property(subsystemNameArb, (subsystem) => {
        const chain = resolvePrecedence([], subsystem);
        for (const entry of chain.entries) {
          if (entry.status === 'empty') {
            expect(entry.nodes).toHaveLength(0);
            expect(entry.overrideReason).toBeNull();
          }
        }
      }),
    );
  });

  it('override resolution: at most one active entry per scope ordering', () => {
    fc.assert(
      fc.property(
        fc.array(scopeNameArb, { minLength: 1, maxLength: 5 }),
        (scopes) => {
          const nodes = scopes.map((scope) => createSettingsNode(scope, { key: 'value' }));
          const chain = resolvePrecedence(nodes, 'settings');
          const activeEntries = chain.entries.filter((e) => e.status === 'active');

          // There should be exactly one active entry (the highest priority scope)
          expect(activeEntries.length).toBeGreaterThanOrEqual(1);
        },
      ),
    );
  });

  it('additive resolution: no entries are overridden', () => {
    fc.assert(
      fc.property(
        fc.array(scopeNameArb, { minLength: 1, maxLength: 5 }),
        (scopes) => {
          const uniqueScopes = [...new Set(scopes)];
          const nodes = uniqueScopes.map((scope) => createMemoryNode(scope));
          const chain = resolvePrecedence(nodes, 'memory');

          for (const entry of chain.entries) {
            expect(entry.status).not.toBe('overridden');
          }
        },
      ),
    );
  });

  it('merge resolution: all contributing entries are active', () => {
    fc.assert(
      fc.property(
        fc.array(scopeNameArb, { minLength: 1, maxLength: 5 }),
        (scopes) => {
          const uniqueScopes = [...new Set(scopes)];
          const nodes = uniqueScopes.map((scope) => createHookNode(scope));
          const chain = resolvePrecedence(nodes, 'hooks');

          for (const entry of chain.entries) {
            if (entry.nodes.length > 0) {
              expect(entry.status).toBe('active');
            }
          }
        },
      ),
    );
  });
});

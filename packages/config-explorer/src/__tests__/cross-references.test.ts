/**
 * Cross-reference extraction tests for @norbert/config-explorer.
 *
 * Verifies that extractEdges produces correct ConfigEdge values
 * from ConfigNode arrays. Tests cover agent-skill references,
 * plugin-component containment, rule-path patterns, and
 * edge cases (no frontmatter, empty nodes).
 */

import { describe, it, expect } from 'vitest';
import { extractEdges } from '../cross-references.js';
import type { ConfigNode, ConfigEdge } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers: create test ConfigNode values
// ---------------------------------------------------------------------------

const createAgentNode = (
  overrides: Partial<ConfigNode> = {},
): ConfigNode => ({
  id: 'project:agents/reviewer.md',
  name: 'reviewer.md',
  scope: 'project',
  subsystem: 'agents',
  nodeType: 'agent',
  filePath: 'agents/reviewer.md',
  relativePath: 'agents/reviewer.md',
  content: '',
  parsedContent: {
    format: 'markdown-with-frontmatter',
    frontmatter: {
      name: 'reviewer',
      skills: ['api-conventions', 'code-review'],
    },
    body: 'You are a code reviewer.',
    frontmatterFields: [
      { key: 'name', value: 'reviewer', annotation: 'Name: reviewer' },
      { key: 'skills', value: ['api-conventions', 'code-review'], annotation: 'Skills: api-conventions, code-review' },
    ],
  },
  loadBehavior: 'always',
  error: null,
  ...overrides,
});

const createSkillNode = (
  name: string,
  scope: ConfigNode['scope'] = 'project',
  overrides: Partial<ConfigNode> = {},
): ConfigNode => ({
  id: `${scope}:skills/${name}/SKILL.md`,
  name: 'SKILL.md',
  scope,
  subsystem: 'skills',
  nodeType: 'skill',
  filePath: `skills/${name}/SKILL.md`,
  relativePath: `skills/${name}/SKILL.md`,
  content: '',
  parsedContent: {
    format: 'markdown-with-frontmatter',
    frontmatter: { name },
    body: `# ${name}`,
    frontmatterFields: [
      { key: 'name', value: name, annotation: `Name: ${name}` },
    ],
  },
  loadBehavior: 'on-demand',
  error: null,
  ...overrides,
});

const createPluginNode = (
  pluginName: string,
  overrides: Partial<ConfigNode> = {},
): ConfigNode => ({
  id: `plugin:${pluginName}/.claude-plugin/plugin.json`,
  name: 'plugin.json',
  scope: 'plugin',
  subsystem: 'plugins',
  nodeType: 'plugin',
  filePath: `${pluginName}/.claude-plugin/plugin.json`,
  relativePath: `${pluginName}/.claude-plugin/plugin.json`,
  content: JSON.stringify({ name: pluginName }),
  parsedContent: {
    format: 'json',
    parsedData: { name: pluginName },
    keys: ['name'],
  },
  loadBehavior: 'always',
  error: null,
  ...overrides,
});

const createPluginComponentNode = (
  pluginName: string,
  componentPath: string,
  nodeType: ConfigNode['nodeType'],
  subsystem: ConfigNode['subsystem'],
  overrides: Partial<ConfigNode> = {},
): ConfigNode => ({
  id: `plugin:${pluginName}/${componentPath}`,
  name: componentPath.split('/').pop() ?? componentPath,
  scope: 'plugin',
  subsystem,
  nodeType,
  filePath: `${pluginName}/${componentPath}`,
  relativePath: `${pluginName}/${componentPath}`,
  content: '',
  parsedContent: { format: 'markdown', body: '' },
  loadBehavior: 'always',
  error: null,
  ...overrides,
});

const createRuleNode = (
  name: string,
  paths: string[] = [],
  overrides: Partial<ConfigNode> = {},
): ConfigNode => ({
  id: `project:rules/${name}.md`,
  name: `${name}.md`,
  scope: 'project',
  subsystem: 'rules',
  nodeType: 'rule',
  filePath: `rules/${name}.md`,
  relativePath: `rules/${name}.md`,
  content: '',
  parsedContent: paths.length > 0
    ? {
        format: 'markdown-with-frontmatter',
        frontmatter: { paths },
        body: `# ${name}`,
        frontmatterFields: [
          { key: 'paths', value: paths, annotation: `Applies to: ${paths.join(', ')}` },
        ],
      }
    : { format: 'markdown', body: `# ${name}` },
  loadBehavior: 'always',
  error: null,
  ...overrides,
});

const createHookNode = (
  overrides: Partial<ConfigNode> = {},
): ConfigNode => ({
  id: 'project:hooks/hooks.json',
  name: 'hooks.json',
  scope: 'project',
  subsystem: 'hooks',
  nodeType: 'hook',
  filePath: 'hooks/hooks.json',
  relativePath: 'hooks/hooks.json',
  content: JSON.stringify({
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './validate.sh' }] }],
      PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: './format.sh' }] }],
    },
  }),
  parsedContent: {
    format: 'json',
    parsedData: {
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './validate.sh' }] }],
        PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: './format.sh' }] }],
      },
    },
    keys: ['hooks'],
  },
  loadBehavior: 'always',
  error: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Agent -> Skill reference edges
// ---------------------------------------------------------------------------

describe('extractEdges - agent references skill', () => {
  it('produces references-skill edges for agent with skills field', () => {
    const agent = createAgentNode();
    const skill1 = createSkillNode('api-conventions');
    const skill2 = createSkillNode('code-review');

    const edges = extractEdges([agent, skill1, skill2]);

    const skillEdges = edges.filter((e) => e.edgeType === 'agent-references-skill');
    expect(skillEdges).toHaveLength(2);
    expect(skillEdges[0].sourceId).toBe(agent.id);
    expect(skillEdges[0].targetId).toBe(skill1.id);
    expect(skillEdges[1].sourceId).toBe(agent.id);
    expect(skillEdges[1].targetId).toBe(skill2.id);
  });

  it('skips skill references when no matching skill node exists', () => {
    const agent = createAgentNode();
    // Only one of the two skills exists as a node
    const skill1 = createSkillNode('api-conventions');

    const edges = extractEdges([agent, skill1]);

    const skillEdges = edges.filter((e) => e.edgeType === 'agent-references-skill');
    expect(skillEdges).toHaveLength(1);
    expect(skillEdges[0].targetId).toBe(skill1.id);
  });

  it('produces no skill edges when agent has no skills field', () => {
    const agent = createAgentNode({
      parsedContent: {
        format: 'markdown-with-frontmatter',
        frontmatter: { name: 'reviewer' },
        body: 'Just a reviewer.',
        frontmatterFields: [
          { key: 'name', value: 'reviewer', annotation: 'Name: reviewer' },
        ],
      },
    });

    const edges = extractEdges([agent]);

    const skillEdges = edges.filter((e) => e.edgeType === 'agent-references-skill');
    expect(skillEdges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Plugin -> Component containment edges
// ---------------------------------------------------------------------------

describe('extractEdges - plugin contains component', () => {
  it('produces contains edges for components within plugin directory', () => {
    const plugin = createPluginNode('my-plugin');
    const skill = createPluginComponentNode('my-plugin', 'skills/deploy/SKILL.md', 'skill', 'skills');
    const agent = createPluginComponentNode('my-plugin', 'agents/reviewer.md', 'agent', 'agents');
    const hook = createPluginComponentNode('my-plugin', 'hooks/hooks.json', 'hook', 'hooks');

    const edges = extractEdges([plugin, skill, agent, hook]);

    const containsEdges = edges.filter((e) => e.edgeType === 'plugin-contains-component');
    expect(containsEdges).toHaveLength(3);
    expect(containsEdges.every((e) => e.sourceId === plugin.id)).toBe(true);
    expect(containsEdges.map((e) => e.targetId)).toContain(skill.id);
    expect(containsEdges.map((e) => e.targetId)).toContain(agent.id);
    expect(containsEdges.map((e) => e.targetId)).toContain(hook.id);
  });

  it('does not create contains edge from plugin to itself', () => {
    const plugin = createPluginNode('my-plugin');

    const edges = extractEdges([plugin]);

    const containsEdges = edges.filter((e) => e.edgeType === 'plugin-contains-component');
    expect(containsEdges).toHaveLength(0);
  });

  it('does not create contains edge for nodes outside plugin directory', () => {
    const plugin = createPluginNode('my-plugin');
    const projectSkill = createSkillNode('deploy', 'project');

    const edges = extractEdges([plugin, projectSkill]);

    const containsEdges = edges.filter((e) => e.edgeType === 'plugin-contains-component');
    expect(containsEdges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule -> Path pattern edges
// ---------------------------------------------------------------------------

describe('extractEdges - rule scoped to path', () => {
  it('produces rule-scoped-to-path edges for rules with paths frontmatter', () => {
    const rule = createRuleNode('typescript', ['src/**/*.ts', 'src/**/*.tsx']);

    const edges = extractEdges([rule]);

    const pathEdges = edges.filter((e) => e.edgeType === 'rule-scoped-to-path');
    expect(pathEdges).toHaveLength(2);
    expect(pathEdges[0].sourceId).toBe(rule.id);
    expect(pathEdges[0].targetId).toBe('pattern:src/**/*.ts');
    expect(pathEdges[1].targetId).toBe('pattern:src/**/*.tsx');
  });

  it('produces no path edges for rules without paths frontmatter', () => {
    const rule = createRuleNode('general');

    const edges = extractEdges([rule]);

    const pathEdges = edges.filter((e) => e.edgeType === 'rule-scoped-to-path');
    expect(pathEdges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Agent -> Tool allowlist edges
// ---------------------------------------------------------------------------

describe('extractEdges - skill allows tool', () => {
  it('produces skill-allows-tool edges for agent with tools field', () => {
    const agent = createAgentNode({
      parsedContent: {
        format: 'markdown-with-frontmatter',
        frontmatter: { name: 'reviewer', tools: ['Read', 'Glob', 'Grep'] },
        body: 'You are a reviewer.',
        frontmatterFields: [
          { key: 'name', value: 'reviewer', annotation: 'Name: reviewer' },
          { key: 'tools', value: ['Read', 'Glob', 'Grep'], annotation: 'Tools: Read, Glob, Grep' },
        ],
      },
    });

    const edges = extractEdges([agent]);

    const toolEdges = edges.filter((e) => e.edgeType === 'skill-allows-tool');
    expect(toolEdges).toHaveLength(3);
    expect(toolEdges.every((e) => e.sourceId === agent.id)).toBe(true);
    expect(toolEdges.map((e) => e.targetId)).toEqual([
      'tool:Read', 'tool:Glob', 'tool:Grep',
    ]);
  });
});

// ---------------------------------------------------------------------------
// No frontmatter / empty nodes
// ---------------------------------------------------------------------------

describe('extractEdges - edge cases', () => {
  it('returns empty array for empty node list', () => {
    const edges = extractEdges([]);
    expect(edges).toHaveLength(0);
  });

  it('returns empty array when no nodes have frontmatter', () => {
    const memoryNode: ConfigNode = {
      id: 'project:CLAUDE.md',
      name: 'CLAUDE.md',
      scope: 'project',
      subsystem: 'memory',
      nodeType: 'memory',
      filePath: 'CLAUDE.md',
      relativePath: 'CLAUDE.md',
      content: '# Hello',
      parsedContent: { format: 'markdown', body: '# Hello' },
      loadBehavior: 'always',
      error: null,
    };

    const edges = extractEdges([memoryNode]);
    expect(edges).toHaveLength(0);
  });

  it('edges reference correct source and target node IDs', () => {
    const agent = createAgentNode({
      id: 'user:agents/my-agent.md',
    });
    const skill = createSkillNode('api-conventions', 'user', {
      id: 'user:skills/api-conventions/SKILL.md',
    });

    const edges = extractEdges([agent, skill]);

    const skillEdges = edges.filter((e) => e.edgeType === 'agent-references-skill');
    expect(skillEdges).toHaveLength(1);
    expect(skillEdges[0].sourceId).toBe('user:agents/my-agent.md');
    expect(skillEdges[0].targetId).toBe('user:skills/api-conventions/SKILL.md');
  });
});

// ---------------------------------------------------------------------------
// Hook -> Event type edges
// ---------------------------------------------------------------------------

describe('extractEdges - hook listens to event', () => {
  it('produces agent-defines-hook edges for settings with hooks config', () => {
    const hookNode = createHookNode();

    const edges = extractEdges([hookNode]);

    const hookEdges = edges.filter((e) => e.edgeType === 'agent-defines-hook');
    expect(hookEdges).toHaveLength(2);
    expect(hookEdges[0].sourceId).toBe(hookNode.id);
    expect(hookEdges[0].targetId).toBe('event:PreToolUse');
    expect(hookEdges[1].targetId).toBe('event:PostToolUse');
  });
});

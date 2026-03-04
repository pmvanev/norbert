/**
 * Conflict detection tests for @norbert/config-explorer.
 *
 * Verifies that detectConflicts finds naming conflicts between nodes
 * at different scopes, respects plugin namespacing, and determines
 * the winning node by scope priority.
 */

import { describe, it, expect } from 'vitest';
import { detectConflicts } from '../conflict-detector.js';
import type { ConfigNode, NamingConflict } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers: create test ConfigNode values
// ---------------------------------------------------------------------------

const createNode = (
  overrides: Partial<ConfigNode>,
): ConfigNode => ({
  id: 'default:id',
  name: 'default',
  scope: 'project',
  subsystem: 'agents',
  nodeType: 'agent',
  filePath: 'agents/default.md',
  relativePath: 'agents/default.md',
  content: '',
  parsedContent: { format: 'markdown', body: '' },
  loadBehavior: 'always',
  error: null,
  ...overrides,
});

const createAgentAtScope = (
  agentName: string,
  scope: ConfigNode['scope'],
): ConfigNode => createNode({
  id: `${scope}:agents/${agentName}.md`,
  name: `${agentName}.md`,
  scope,
  subsystem: 'agents',
  nodeType: 'agent',
  filePath: `agents/${agentName}.md`,
  relativePath: `agents/${agentName}.md`,
  parsedContent: {
    format: 'markdown-with-frontmatter',
    frontmatter: { name: agentName },
    body: `# ${agentName}`,
    frontmatterFields: [
      { key: 'name', value: agentName, annotation: `Name: ${agentName}` },
    ],
  },
});

const createSkillAtScope = (
  skillName: string,
  scope: ConfigNode['scope'],
): ConfigNode => createNode({
  id: `${scope}:skills/${skillName}/SKILL.md`,
  name: 'SKILL.md',
  scope,
  subsystem: 'skills',
  nodeType: 'skill',
  filePath: `skills/${skillName}/SKILL.md`,
  relativePath: `skills/${skillName}/SKILL.md`,
  parsedContent: {
    format: 'markdown-with-frontmatter',
    frontmatter: { name: skillName },
    body: `# ${skillName}`,
    frontmatterFields: [
      { key: 'name', value: skillName, annotation: `Name: ${skillName}` },
    ],
  },
});

const createPluginSkill = (
  pluginName: string,
  skillName: string,
): ConfigNode => createNode({
  id: `plugin:${pluginName}/skills/${skillName}/SKILL.md`,
  name: 'SKILL.md',
  scope: 'plugin',
  subsystem: 'skills',
  nodeType: 'skill',
  filePath: `${pluginName}/skills/${skillName}/SKILL.md`,
  relativePath: `${pluginName}/skills/${skillName}/SKILL.md`,
  parsedContent: {
    format: 'markdown-with-frontmatter',
    frontmatter: { name: `${pluginName}:${skillName}` },
    body: `# ${skillName}`,
    frontmatterFields: [
      { key: 'name', value: `${pluginName}:${skillName}`, annotation: `Name: ${pluginName}:${skillName}` },
    ],
  },
});

// ---------------------------------------------------------------------------
// Same agent name at different scopes -> conflict
// ---------------------------------------------------------------------------

describe('detectConflicts - agent conflicts', () => {
  it('detects conflict when same agent name exists at user and project scope', () => {
    const userAgent = createAgentAtScope('reviewer', 'user');
    const projectAgent = createAgentAtScope('reviewer', 'project');

    const conflicts = detectConflicts([userAgent, projectAgent]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].name).toBe('reviewer');
    expect(conflicts[0].nodeType).toBe('agent');
  });

  it('winning node is determined by scope priority (project wins over user)', () => {
    const userAgent = createAgentAtScope('reviewer', 'user');
    const projectAgent = createAgentAtScope('reviewer', 'project');

    const conflicts = detectConflicts([userAgent, projectAgent]);

    expect(conflicts[0].higherScope).toBe(projectAgent);
    expect(conflicts[0].lowerScope).toBe(userAgent);
  });

  it('includes resolution reason explaining which scope wins', () => {
    const userAgent = createAgentAtScope('reviewer', 'user');
    const projectAgent = createAgentAtScope('reviewer', 'project');

    const conflicts = detectConflicts([userAgent, projectAgent]);

    expect(conflicts[0].resolution).toContain('project');
    expect(conflicts[0].resolution.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Same skill name at different scopes -> conflict
// ---------------------------------------------------------------------------

describe('detectConflicts - skill conflicts', () => {
  it('detects conflict when same skill name exists at user and project scope', () => {
    const userSkill = createSkillAtScope('deploy', 'user');
    const projectSkill = createSkillAtScope('deploy', 'project');

    const conflicts = detectConflicts([userSkill, projectSkill]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].name).toBe('deploy');
    expect(conflicts[0].nodeType).toBe('skill');
  });
});

// ---------------------------------------------------------------------------
// Plugin-namespaced skills do NOT conflict
// ---------------------------------------------------------------------------

describe('detectConflicts - plugin namespace', () => {
  it('plugin-namespaced skill does not conflict with non-namespaced skill', () => {
    const projectSkill = createSkillAtScope('deploy', 'project');
    const pluginSkill = createPluginSkill('my-plugin', 'deploy');

    const conflicts = detectConflicts([projectSkill, pluginSkill]);

    expect(conflicts).toHaveLength(0);
  });

  it('two different plugin-namespaced skills do not conflict', () => {
    const plugin1Skill = createPluginSkill('plugin-a', 'deploy');
    const plugin2Skill = createPluginSkill('plugin-b', 'deploy');

    const conflicts = detectConflicts([plugin1Skill, plugin2Skill]);

    expect(conflicts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Unique names -> no conflicts
// ---------------------------------------------------------------------------

describe('detectConflicts - no conflicts', () => {
  it('returns empty array when all names are unique', () => {
    const agent1 = createAgentAtScope('reviewer', 'project');
    const agent2 = createAgentAtScope('planner', 'user');
    const skill1 = createSkillAtScope('deploy', 'project');

    const conflicts = detectConflicts([agent1, agent2, skill1]);

    expect(conflicts).toHaveLength(0);
  });

  it('returns empty array for empty node list', () => {
    const conflicts = detectConflicts([]);
    expect(conflicts).toHaveLength(0);
  });

  it('same name in different node types does not conflict', () => {
    const agent = createAgentAtScope('deploy', 'project');
    const skill = createSkillAtScope('deploy', 'project');

    const conflicts = detectConflicts([agent, skill]);

    expect(conflicts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Priority order
// ---------------------------------------------------------------------------

describe('detectConflicts - scope priority', () => {
  it('managed scope wins over all others', () => {
    const managedAgent = createAgentAtScope('reviewer', 'managed');
    const projectAgent = createAgentAtScope('reviewer', 'project');

    const conflicts = detectConflicts([managedAgent, projectAgent]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].higherScope).toBe(managedAgent);
    expect(conflicts[0].lowerScope).toBe(projectAgent);
  });

  it('local scope wins over project scope', () => {
    const localAgent = createAgentAtScope('reviewer', 'local');
    const projectAgent = createAgentAtScope('reviewer', 'project');

    const conflicts = detectConflicts([localAgent, projectAgent]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].higherScope).toBe(localAgent);
    expect(conflicts[0].lowerScope).toBe(projectAgent);
  });

  it('project scope wins over plugin scope', () => {
    const projectAgent = createAgentAtScope('reviewer', 'project');
    const pluginAgent = createAgentAtScope('reviewer', 'plugin');

    const conflicts = detectConflicts([projectAgent, pluginAgent]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].higherScope).toBe(projectAgent);
    expect(conflicts[0].lowerScope).toBe(pluginAgent);
  });

  it('plugin scope wins over user scope', () => {
    const pluginAgent = createAgentAtScope('reviewer', 'plugin');
    const userAgent = createAgentAtScope('reviewer', 'user');

    const conflicts = detectConflicts([pluginAgent, userAgent]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].higherScope).toBe(pluginAgent);
    expect(conflicts[0].lowerScope).toBe(userAgent);
  });

  it('resolution message includes both scope names', () => {
    const managedAgent = createAgentAtScope('reviewer', 'managed');
    const userAgent = createAgentAtScope('reviewer', 'user');

    const conflicts = detectConflicts([managedAgent, userAgent]);

    expect(conflicts[0].resolution).toBe('managed scope overrides user scope');
  });
});

// ---------------------------------------------------------------------------
// Multi-scope conflicts (pairwise reporting)
// ---------------------------------------------------------------------------

describe('detectConflicts - multi-scope conflicts', () => {
  it('reports pairwise conflicts from highest scope to each lower scope', () => {
    const managedAgent = createAgentAtScope('reviewer', 'managed');
    const projectAgent = createAgentAtScope('reviewer', 'project');
    const userAgent = createAgentAtScope('reviewer', 'user');

    const conflicts = detectConflicts([managedAgent, projectAgent, userAgent]);

    // Should report 2 conflicts: managed vs project, managed vs user
    expect(conflicts).toHaveLength(2);
    expect(conflicts.every(c => c.higherScope === managedAgent)).toBe(true);
    const lowerScopes = conflicts.map(c => c.lowerScope.scope);
    expect(lowerScopes).toContain('project');
    expect(lowerScopes).toContain('user');
  });
});

// ---------------------------------------------------------------------------
// Non-conflictable node types
// ---------------------------------------------------------------------------

describe('detectConflicts - non-conflictable node types', () => {
  it('settings nodes do not create conflicts', () => {
    const node1 = createNode({
      name: 'settings.json',
      scope: 'user',
      nodeType: 'settings',
      subsystem: 'settings',
    });
    const node2 = createNode({
      name: 'settings.json',
      scope: 'project',
      nodeType: 'settings',
      subsystem: 'settings',
    });

    const conflicts = detectConflicts([node1, node2]);
    expect(conflicts).toHaveLength(0);
  });

  it('rule nodes do not create conflicts', () => {
    const node1 = createNode({
      name: 'coding.md',
      scope: 'user',
      nodeType: 'rule',
      subsystem: 'rules',
    });
    const node2 = createNode({
      name: 'coding.md',
      scope: 'project',
      nodeType: 'rule',
      subsystem: 'rules',
    });

    const conflicts = detectConflicts([node1, node2]);
    expect(conflicts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Logical name from frontmatter
// ---------------------------------------------------------------------------

describe('detectConflicts - logical name resolution', () => {
  it('uses frontmatter name when present for conflict detection', () => {
    const agent1 = createAgentAtScope('reviewer', 'user');
    // agent2 has different file name but same frontmatter name
    const agent2 = createNode({
      id: 'project:agents/my-reviewer.md',
      name: 'my-reviewer.md',
      scope: 'project',
      subsystem: 'agents',
      nodeType: 'agent',
      filePath: 'agents/my-reviewer.md',
      relativePath: 'agents/my-reviewer.md',
      parsedContent: {
        format: 'markdown-with-frontmatter',
        frontmatter: { name: 'reviewer' }, // same logical name
        body: '# reviewer',
        frontmatterFields: [
          { key: 'name', value: 'reviewer', annotation: 'Name: reviewer' },
        ],
      },
    });

    const conflicts = detectConflicts([agent1, agent2]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].name).toBe('reviewer');
  });

  it('falls back to node name when no frontmatter', () => {
    const agent1 = createNode({
      name: 'reviewer',
      scope: 'user',
      subsystem: 'agents',
      nodeType: 'agent',
      parsedContent: { format: 'markdown', body: '# reviewer' },
    });
    const agent2 = createNode({
      name: 'reviewer',
      scope: 'project',
      subsystem: 'agents',
      nodeType: 'agent',
      parsedContent: { format: 'markdown', body: '# reviewer' },
    });

    const conflicts = detectConflicts([agent1, agent2]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].name).toBe('reviewer');
  });
});

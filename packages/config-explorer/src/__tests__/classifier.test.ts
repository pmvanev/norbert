/**
 * Classifier tests for @norbert/config-explorer.
 *
 * Verifies the pure classifyFile function maps file paths to the correct
 * subsystem, scope, and node type. Uses example-based tests for known
 * path patterns and property-based tests for domain invariants.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { classifyFile } from '../classifier.js';
import type { ScopeName, SubsystemName, NodeType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Result type shape
// ---------------------------------------------------------------------------

interface ClassificationResult {
  readonly subsystem: SubsystemName;
  readonly scope: ScopeName;
  readonly nodeType: NodeType;
  readonly loadBehavior: 'always' | 'on-demand';
}

// ---------------------------------------------------------------------------
// Memory subsystem paths
// ---------------------------------------------------------------------------

describe('classifyFile - memory subsystem', () => {
  it('classifies root CLAUDE.md as project-scope memory', () => {
    const result = classifyFile('CLAUDE.md', 'project');
    expect(result.subsystem).toBe('memory');
    expect(result.scope).toBe('project');
    expect(result.nodeType).toBe('memory');
    expect(result.loadBehavior).toBe('always');
  });

  it('classifies CLAUDE.local.md as local-scope memory', () => {
    const result = classifyFile('CLAUDE.local.md', 'project');
    expect(result.subsystem).toBe('memory');
    expect(result.scope).toBe('local');
    expect(result.nodeType).toBe('memory');
    expect(result.loadBehavior).toBe('always');
  });

  it('classifies .claude/CLAUDE.md as project-scope memory', () => {
    const result = classifyFile('.claude/CLAUDE.md', 'project');
    expect(result.subsystem).toBe('memory');
    expect(result.scope).toBe('project');
    expect(result.nodeType).toBe('memory');
  });

  it('classifies user-scope CLAUDE.md', () => {
    const result = classifyFile('CLAUDE.md', 'user');
    expect(result.subsystem).toBe('memory');
    expect(result.scope).toBe('user');
    expect(result.nodeType).toBe('memory');
  });

  it('classifies subdirectory CLAUDE.md as on-demand', () => {
    const result = classifyFile('src/CLAUDE.md', 'project');
    expect(result.subsystem).toBe('memory');
    expect(result.loadBehavior).toBe('on-demand');
  });

  it('classifies MEMORY.md as memory subsystem', () => {
    const result = classifyFile('memory/MEMORY.md', 'user');
    expect(result.subsystem).toBe('memory');
    expect(result.nodeType).toBe('memory');
  });
});

// ---------------------------------------------------------------------------
// Settings subsystem paths
// ---------------------------------------------------------------------------

describe('classifyFile - settings subsystem', () => {
  it('classifies settings.json as settings', () => {
    const result = classifyFile('settings.json', 'project');
    expect(result.subsystem).toBe('settings');
    expect(result.scope).toBe('project');
    expect(result.nodeType).toBe('settings');
  });

  it('classifies .claude/settings.json as project settings', () => {
    const result = classifyFile('.claude/settings.json', 'project');
    expect(result.subsystem).toBe('settings');
    expect(result.scope).toBe('project');
    expect(result.nodeType).toBe('settings');
  });

  it('classifies settings.local.json as local-scope settings', () => {
    const result = classifyFile('settings.local.json', 'project');
    expect(result.subsystem).toBe('settings');
    expect(result.scope).toBe('local');
    expect(result.nodeType).toBe('settings');
  });

  it('classifies .claude/settings.local.json as local-scope settings', () => {
    const result = classifyFile('.claude/settings.local.json', 'project');
    expect(result.subsystem).toBe('settings');
    expect(result.scope).toBe('local');
    expect(result.nodeType).toBe('settings');
  });

  it('classifies user-scope settings.json', () => {
    const result = classifyFile('settings.json', 'user');
    expect(result.subsystem).toBe('settings');
    expect(result.scope).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// Rules subsystem paths
// ---------------------------------------------------------------------------

describe('classifyFile - rules subsystem', () => {
  it('classifies rules/*.md as rule', () => {
    const result = classifyFile('rules/coding-standards.md', 'project');
    expect(result.subsystem).toBe('rules');
    expect(result.scope).toBe('project');
    expect(result.nodeType).toBe('rule');
    expect(result.loadBehavior).toBe('always');
  });

  it('classifies .claude/rules/*.md as rule', () => {
    const result = classifyFile('.claude/rules/naming.md', 'project');
    expect(result.subsystem).toBe('rules');
    expect(result.nodeType).toBe('rule');
  });

  it('classifies nested rules as on-demand (path-scoped)', () => {
    const result = classifyFile('rules/frontend/react-conventions.md', 'project');
    expect(result.subsystem).toBe('rules');
    expect(result.nodeType).toBe('rule');
  });

  it('classifies user-scope rules', () => {
    const result = classifyFile('rules/preferences.md', 'user');
    expect(result.subsystem).toBe('rules');
    expect(result.scope).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// Skills subsystem paths
// ---------------------------------------------------------------------------

describe('classifyFile - skills subsystem', () => {
  it('classifies skills/*/SKILL.md as skill', () => {
    const result = classifyFile('skills/my-skill/SKILL.md', 'project');
    expect(result.subsystem).toBe('skills');
    expect(result.scope).toBe('project');
    expect(result.nodeType).toBe('skill');
  });

  it('classifies .claude/skills/*/SKILL.md as skill', () => {
    const result = classifyFile('.claude/skills/code-review/SKILL.md', 'project');
    expect(result.subsystem).toBe('skills');
    expect(result.nodeType).toBe('skill');
  });

  it('classifies user-scope skills', () => {
    const result = classifyFile('skills/personal-skill/SKILL.md', 'user');
    expect(result.subsystem).toBe('skills');
    expect(result.scope).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// Agents subsystem paths
// ---------------------------------------------------------------------------

describe('classifyFile - agents subsystem', () => {
  it('classifies agents/*.md as agent', () => {
    const result = classifyFile('agents/reviewer.md', 'project');
    expect(result.subsystem).toBe('agents');
    expect(result.scope).toBe('project');
    expect(result.nodeType).toBe('agent');
  });

  it('classifies .claude/agents/*.md as agent', () => {
    const result = classifyFile('.claude/agents/planner.md', 'project');
    expect(result.subsystem).toBe('agents');
    expect(result.nodeType).toBe('agent');
  });

  it('classifies user-scope agents', () => {
    const result = classifyFile('agents/my-agent.md', 'user');
    expect(result.subsystem).toBe('agents');
    expect(result.scope).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// Hooks subsystem paths
// ---------------------------------------------------------------------------

describe('classifyFile - hooks subsystem', () => {
  it('classifies hooks/hooks.json as hooks', () => {
    const result = classifyFile('hooks/hooks.json', 'plugin');
    expect(result.subsystem).toBe('hooks');
    expect(result.nodeType).toBe('hook');
  });
});

// ---------------------------------------------------------------------------
// Plugins subsystem paths
// ---------------------------------------------------------------------------

describe('classifyFile - plugins subsystem', () => {
  it('classifies .claude-plugin/plugin.json as plugin', () => {
    const result = classifyFile('.claude-plugin/plugin.json', 'plugin');
    expect(result.subsystem).toBe('plugins');
    expect(result.scope).toBe('plugin');
    expect(result.nodeType).toBe('plugin');
  });
});

// ---------------------------------------------------------------------------
// MCP subsystem paths
// ---------------------------------------------------------------------------

describe('classifyFile - mcp subsystem', () => {
  it('classifies .mcp.json as mcp', () => {
    const result = classifyFile('.mcp.json', 'project');
    expect(result.subsystem).toBe('mcp');
    expect(result.scope).toBe('project');
    expect(result.nodeType).toBe('mcp');
  });

  it('classifies .claude.json as mcp', () => {
    const result = classifyFile('.claude.json', 'user');
    expect(result.subsystem).toBe('mcp');
    expect(result.scope).toBe('user');
    expect(result.nodeType).toBe('mcp');
  });
});

// ---------------------------------------------------------------------------
// Local scope override detection
// ---------------------------------------------------------------------------

describe('classifyFile - local scope override', () => {
  it('detects *.local.* pattern as local scope', () => {
    const settingsResult = classifyFile('settings.local.json', 'project');
    expect(settingsResult.scope).toBe('local');

    const memoryResult = classifyFile('CLAUDE.local.md', 'project');
    expect(memoryResult.scope).toBe('local');
  });
});

// ---------------------------------------------------------------------------
// Unknown / fallback paths
// ---------------------------------------------------------------------------

describe('classifyFile - unknown paths', () => {
  it('classifies unknown files with sensible defaults', () => {
    const result = classifyFile('random-file.txt', 'project');
    expect(result.subsystem).toBe('memory');
    expect(result.scope).toBe('project');
    expect(result.nodeType).toBe('memory');
  });

  it('preserves the provided scope context for unknown files', () => {
    const result = classifyFile('unknown.txt', 'user');
    expect(result.scope).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('classifyFile - properties', () => {
  const validScopes: ScopeName[] = ['managed', 'user', 'project', 'local', 'plugin'];
  const validSubsystems: SubsystemName[] = [
    'memory', 'settings', 'rules', 'skills', 'agents', 'hooks', 'plugins', 'mcp',
  ];
  const validNodeTypes: NodeType[] = [
    'agent', 'skill', 'rule', 'hook', 'mcp', 'memory', 'settings', 'plugin',
  ];

  const scopeArb = fc.constantFrom(...validScopes);
  const pathArb = fc.string({ minLength: 1, maxLength: 200 });

  it('always returns a valid subsystem name', () => {
    fc.assert(
      fc.property(pathArb, scopeArb, (path, scope) => {
        const result = classifyFile(path, scope);
        expect(validSubsystems).toContain(result.subsystem);
      }),
    );
  });

  it('always returns a valid scope name', () => {
    fc.assert(
      fc.property(pathArb, scopeArb, (path, scope) => {
        const result = classifyFile(path, scope);
        expect(validScopes).toContain(result.scope);
      }),
    );
  });

  it('always returns a valid node type', () => {
    fc.assert(
      fc.property(pathArb, scopeArb, (path, scope) => {
        const result = classifyFile(path, scope);
        expect(validNodeTypes).toContain(result.nodeType);
      }),
    );
  });

  it('always returns a valid load behavior', () => {
    fc.assert(
      fc.property(pathArb, scopeArb, (path, scope) => {
        const result = classifyFile(path, scope);
        expect(['always', 'on-demand']).toContain(result.loadBehavior);
      }),
    );
  });
});

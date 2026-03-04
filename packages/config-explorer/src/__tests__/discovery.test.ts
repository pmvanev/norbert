/**
 * Discovery tests for @norbert/config-explorer.
 *
 * Verifies the pure assembleConfigModel function correctly builds a ConfigModel
 * from an array of discovered file entries. Uses example-based tests for
 * known assembly scenarios and property-based tests for domain invariants.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { assembleConfigModel } from '../discovery.js';
import type { ScopeName, SubsystemName } from '../types/index.js';

// ---------------------------------------------------------------------------
// Types for test inputs
// ---------------------------------------------------------------------------

interface DiscoveredFileEntry {
  readonly path: string;
  readonly content: string;
  readonly scope: ScopeName;
}

// ---------------------------------------------------------------------------
// Helpers: create test file entries
// ---------------------------------------------------------------------------

const createFileEntry = (
  path: string,
  content: string,
  scope: ScopeName,
): DiscoveredFileEntry => ({ path, content, scope });

// ---------------------------------------------------------------------------
// Assembly from multiple scopes
// ---------------------------------------------------------------------------

describe('assembleConfigModel - multi-scope assembly', () => {
  it('assembles nodes from files across user and project scopes', () => {
    const entries: DiscoveredFileEntry[] = [
      createFileEntry('settings.json', '{"theme": "dark"}', 'user'),
      createFileEntry('settings.json', '{"permissions": {}}', 'project'),
    ];

    const model = assembleConfigModel(entries);

    expect(model.nodes).toHaveLength(2);
    expect(model.totalFiles).toBe(2);
  });

  it('assembles nodes from all 5 scopes', () => {
    const entries: DiscoveredFileEntry[] = [
      createFileEntry('managed-settings.json', '{"managed": true}', 'managed'),
      createFileEntry('settings.json', '{"user": true}', 'user'),
      createFileEntry('settings.json', '{"project": true}', 'project'),
      createFileEntry('settings.local.json', '{"local": true}', 'local'),
      createFileEntry('.claude-plugin/plugin.json', '{"name": "test"}', 'plugin'),
    ];

    const model = assembleConfigModel(entries);

    expect(model.nodes).toHaveLength(5);
    expect(model.totalFiles).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Subsystem classification correctness
// ---------------------------------------------------------------------------

describe('assembleConfigModel - subsystem classification', () => {
  it('classifies CLAUDE.md as memory subsystem', () => {
    const entries = [createFileEntry('CLAUDE.md', '# Project instructions', 'project')];
    const model = assembleConfigModel(entries);

    expect(model.nodes[0].subsystem).toBe('memory');
    expect(model.nodes[0].nodeType).toBe('memory');
  });

  it('classifies settings.json as settings subsystem', () => {
    const entries = [createFileEntry('settings.json', '{}', 'user')];
    const model = assembleConfigModel(entries);

    expect(model.nodes[0].subsystem).toBe('settings');
    expect(model.nodes[0].nodeType).toBe('settings');
  });

  it('classifies rules/*.md as rules subsystem', () => {
    const entries = [createFileEntry('rules/coding.md', '# Coding rules', 'project')];
    const model = assembleConfigModel(entries);

    expect(model.nodes[0].subsystem).toBe('rules');
    expect(model.nodes[0].nodeType).toBe('rule');
  });

  it('classifies skills/*/SKILL.md as skills subsystem', () => {
    const entries = [createFileEntry('skills/deploy/SKILL.md', '---\nname: deploy\n---\n# Deploy', 'project')];
    const model = assembleConfigModel(entries);

    expect(model.nodes[0].subsystem).toBe('skills');
    expect(model.nodes[0].nodeType).toBe('skill');
  });

  it('classifies agents/*.md as agents subsystem', () => {
    const entries = [createFileEntry('agents/reviewer.md', '---\nname: reviewer\n---\n# Reviewer', 'project')];
    const model = assembleConfigModel(entries);

    expect(model.nodes[0].subsystem).toBe('agents');
    expect(model.nodes[0].nodeType).toBe('agent');
  });

  it('classifies .mcp.json as mcp subsystem', () => {
    const entries = [createFileEntry('.mcp.json', '{"mcpServers": {}}', 'project')];
    const model = assembleConfigModel(entries);

    expect(model.nodes[0].subsystem).toBe('mcp');
    expect(model.nodes[0].nodeType).toBe('mcp');
  });

  it('classifies .claude-plugin/plugin.json as plugins subsystem', () => {
    const entries = [createFileEntry('.claude-plugin/plugin.json', '{"name": "test"}', 'plugin')];
    const model = assembleConfigModel(entries);

    expect(model.nodes[0].subsystem).toBe('plugins');
    expect(model.nodes[0].nodeType).toBe('plugin');
  });

  it('classifies hooks/hooks.json as hooks subsystem', () => {
    const entries = [createFileEntry('hooks/hooks.json', '{}', 'plugin')];
    const model = assembleConfigModel(entries);

    expect(model.nodes[0].subsystem).toBe('hooks');
    expect(model.nodes[0].nodeType).toBe('hook');
  });
});

// ---------------------------------------------------------------------------
// Node counts match filesystem input
// ---------------------------------------------------------------------------

describe('assembleConfigModel - node counts', () => {
  it('totalFiles matches number of input entries', () => {
    const entries = [
      createFileEntry('settings.json', '{}', 'user'),
      createFileEntry('CLAUDE.md', '# Hello', 'project'),
      createFileEntry('rules/test.md', '# Test', 'project'),
    ];
    const model = assembleConfigModel(entries);

    expect(model.totalFiles).toBe(entries.length);
    expect(model.nodes).toHaveLength(entries.length);
  });

  it('scopeSummary counts match scope distribution of inputs', () => {
    const entries = [
      createFileEntry('settings.json', '{}', 'user'),
      createFileEntry('CLAUDE.md', '# User', 'user'),
      createFileEntry('settings.json', '{}', 'project'),
    ];
    const model = assembleConfigModel(entries);

    expect(model.scopeSummary.user).toBe(2);
    expect(model.scopeSummary.project).toBe(1);
  });

  it('subsystemSummary counts match subsystem distribution of inputs', () => {
    const entries = [
      createFileEntry('settings.json', '{}', 'user'),
      createFileEntry('settings.json', '{}', 'project'),
      createFileEntry('CLAUDE.md', '# Hello', 'project'),
    ];
    const model = assembleConfigModel(entries);

    expect(model.subsystemSummary.settings).toBe(2);
    expect(model.subsystemSummary.memory).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Empty scopes produce zero counts
// ---------------------------------------------------------------------------

describe('assembleConfigModel - empty input', () => {
  it('produces empty model from empty input', () => {
    const model = assembleConfigModel([]);

    expect(model.nodes).toHaveLength(0);
    expect(model.edges).toHaveLength(0);
    expect(model.totalFiles).toBe(0);
    expect(model.conflicts).toHaveLength(0);
  });

  it('scopeSummary is empty when no entries', () => {
    const model = assembleConfigModel([]);
    expect(Object.keys(model.scopeSummary)).toHaveLength(0);
  });

  it('subsystemSummary is empty when no entries', () => {
    const model = assembleConfigModel([]);
    expect(Object.keys(model.subsystemSummary)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Malformed files produce error nodes
// ---------------------------------------------------------------------------

describe('assembleConfigModel - malformed files', () => {
  it('creates node with error for malformed JSON', () => {
    const entries = [createFileEntry('settings.json', '{ invalid json', 'user')];
    const model = assembleConfigModel(entries);

    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].error).not.toBeNull();
    expect(model.nodes[0].parsedContent.format).toBe('unparseable');
  });

  it('does not break the model when one file is malformed', () => {
    const entries = [
      createFileEntry('settings.json', '{ invalid json', 'user'),
      createFileEntry('CLAUDE.md', '# Valid markdown', 'project'),
    ];
    const model = assembleConfigModel(entries);

    expect(model.nodes).toHaveLength(2);
    expect(model.totalFiles).toBe(2);

    const errorNode = model.nodes.find((n) => n.error !== null);
    const validNode = model.nodes.find((n) => n.error === null);
    expect(errorNode).toBeDefined();
    expect(validNode).toBeDefined();
  });

  it('malformed files are included in scope and subsystem counts', () => {
    const entries = [
      createFileEntry('settings.json', '{ bad }', 'user'),
      createFileEntry('settings.json', '{}', 'project'),
    ];
    const model = assembleConfigModel(entries);

    expect(model.scopeSummary.user).toBe(1);
    expect(model.scopeSummary.project).toBe(1);
    expect(model.subsystemSummary.settings).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Scan timestamp
// ---------------------------------------------------------------------------

describe('assembleConfigModel - metadata', () => {
  it('includes a valid ISO 8601 scanTimestamp', () => {
    const model = assembleConfigModel([]);
    expect(model.scanTimestamp).toBeDefined();
    // ISO date should parse without NaN
    expect(Number.isNaN(new Date(model.scanTimestamp).getTime())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('assembleConfigModel - properties', () => {
  const scopeArb: fc.Arbitrary<ScopeName> = fc.constantFrom(
    'managed' as const,
    'user' as const,
    'project' as const,
    'local' as const,
    'plugin' as const,
  );

  const fileEntryArb: fc.Arbitrary<DiscoveredFileEntry> = fc.oneof(
    fc.record({
      path: fc.constant('settings.json'),
      content: fc.constant('{}'),
      scope: scopeArb,
    }),
    fc.record({
      path: fc.constant('CLAUDE.md'),
      content: fc.string(),
      scope: scopeArb,
    }),
    fc.record({
      path: fc.constant('rules/test.md'),
      content: fc.string(),
      scope: scopeArb,
    }),
    fc.record({
      path: fc.constant('agents/test.md'),
      content: fc.string(),
      scope: scopeArb,
    }),
    fc.record({
      path: fc.constant('skills/test/SKILL.md'),
      content: fc.string(),
      scope: scopeArb,
    }),
    fc.record({
      path: fc.constant('.mcp.json'),
      content: fc.constant('{}'),
      scope: scopeArb,
    }),
  );

  it('totalFiles always equals nodes.length', () => {
    fc.assert(
      fc.property(fc.array(fileEntryArb, { maxLength: 20 }), (entries) => {
        const model = assembleConfigModel(entries);
        expect(model.totalFiles).toBe(model.nodes.length);
      }),
    );
  });

  it('scopeSummary values sum to totalFiles', () => {
    fc.assert(
      fc.property(fc.array(fileEntryArb, { maxLength: 20 }), (entries) => {
        const model = assembleConfigModel(entries);
        const scopeSum = Object.values(model.scopeSummary).reduce(
          (sum, count) => sum + (count ?? 0),
          0,
        );
        expect(scopeSum).toBe(model.totalFiles);
      }),
    );
  });

  it('subsystemSummary values sum to totalFiles', () => {
    fc.assert(
      fc.property(fc.array(fileEntryArb, { maxLength: 20 }), (entries) => {
        const model = assembleConfigModel(entries);
        const subsystemSum = Object.values(model.subsystemSummary).reduce(
          (sum, count) => sum + (count ?? 0),
          0,
        );
        expect(subsystemSum).toBe(model.totalFiles);
      }),
    );
  });

  it('every node has a valid scope name', () => {
    const validScopes: ScopeName[] = ['managed', 'user', 'project', 'local', 'plugin'];
    fc.assert(
      fc.property(fc.array(fileEntryArb, { maxLength: 20 }), (entries) => {
        const model = assembleConfigModel(entries);
        for (const node of model.nodes) {
          expect(validScopes).toContain(node.scope);
        }
      }),
    );
  });

  it('every node has a non-empty id', () => {
    fc.assert(
      fc.property(fc.array(fileEntryArb, { minLength: 1, maxLength: 20 }), (entries) => {
        const model = assembleConfigModel(entries);
        for (const node of model.nodes) {
          expect(node.id.length).toBeGreaterThan(0);
        }
      }),
    );
  });
});

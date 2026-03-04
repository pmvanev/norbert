/**
 * Search tests for @norbert/config-explorer.
 *
 * Verifies the pure searchConfig function correctly finds matching content
 * across all config nodes using case-insensitive substring search.
 *
 * Test budget: 7 behaviors x 2 = 14 max tests.
 * Behaviors: file path match, content match, case-insensitive, empty query,
 *   no matches, matching line context, max results limit, cross-scope search.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ConfigNode, SearchResult } from '../types/index.js';
import { searchConfig } from '../search.js';

// ---------------------------------------------------------------------------
// Helpers: create config nodes for testing
// ---------------------------------------------------------------------------

const createNode = (
  overrides: Partial<ConfigNode> & { name: string; scope: ConfigNode['scope']; content: string },
): ConfigNode => ({
  id: `${overrides.scope}:${overrides.filePath ?? overrides.name}`,
  name: overrides.name,
  scope: overrides.scope,
  subsystem: overrides.subsystem ?? 'settings',
  nodeType: overrides.nodeType ?? 'settings',
  filePath: overrides.filePath ?? overrides.name,
  relativePath: overrides.relativePath ?? overrides.filePath ?? overrides.name,
  content: overrides.content,
  parsedContent: overrides.parsedContent ?? { format: 'json' as const, parsedData: {}, keys: [] },
  loadBehavior: overrides.loadBehavior ?? 'always',
  error: overrides.error ?? null,
});

// ---------------------------------------------------------------------------
// Searching by file path
// ---------------------------------------------------------------------------

describe('searchConfig - file path matching', () => {
  it('finds nodes whose file path contains the query', () => {
    const nodes: ConfigNode[] = [
      createNode({ name: 'settings.json', scope: 'user', filePath: 'settings.json', content: '{"theme":"dark"}' }),
      createNode({ name: 'coding.md', scope: 'project', filePath: 'rules/coding.md', content: '# Coding rules', subsystem: 'rules', nodeType: 'rule', parsedContent: { format: 'markdown' as const, body: '# Coding rules' } }),
    ];

    const results = searchConfig(nodes, 'settings');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.node.filePath === 'settings.json')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Searching across content
// ---------------------------------------------------------------------------

describe('searchConfig - content matching', () => {
  it('finds nodes whose raw content contains the query', () => {
    const nodes: ConfigNode[] = [
      createNode({
        name: 'settings.json',
        scope: 'project',
        content: '{"permissions":{"allow_tool":["Read","Write"]}}',
        parsedContent: {
          format: 'json' as const,
          parsedData: { permissions: { allow_tool: ['Read', 'Write'] } },
          keys: ['permissions'],
        },
      }),
      createNode({
        name: 'CLAUDE.md',
        scope: 'user',
        content: '# Global instructions\nThis is a project.',
        subsystem: 'memory',
        nodeType: 'memory',
        parsedContent: { format: 'markdown' as const, body: '# Global instructions\nThis is a project.' },
      }),
    ];

    const results = searchConfig(nodes, 'permissions');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.node.name === 'settings.json')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-scope search
// ---------------------------------------------------------------------------

describe('searchConfig - cross-scope search', () => {
  it('finds matches across user and project scopes', () => {
    const nodes: ConfigNode[] = [
      createNode({
        name: 'settings.json',
        scope: 'user',
        content: '{"theme":"dark"}',
        parsedContent: { format: 'json' as const, parsedData: { theme: 'dark' }, keys: ['theme'] },
      }),
      createNode({
        name: 'settings.json',
        scope: 'project',
        content: '{"theme":"light"}',
        parsedContent: { format: 'json' as const, parsedData: { theme: 'light' }, keys: ['theme'] },
      }),
    ];

    const results = searchConfig(nodes, 'theme');

    expect(results).toHaveLength(2);
    const scopes = results.map(r => r.node.scope);
    expect(scopes).toContain('user');
    expect(scopes).toContain('project');
  });
});

// ---------------------------------------------------------------------------
// Case-insensitive matching
// ---------------------------------------------------------------------------

describe('searchConfig - case insensitivity', () => {
  it('matches regardless of case', () => {
    const nodes: ConfigNode[] = [
      createNode({
        name: 'CLAUDE.md',
        scope: 'project',
        content: '# Project Instructions\nWrite clean code.',
        subsystem: 'memory',
        nodeType: 'memory',
        parsedContent: { format: 'markdown' as const, body: '# Project Instructions\nWrite clean code.' },
      }),
    ];

    const upperResults = searchConfig(nodes, 'INSTRUCTIONS');
    const lowerResults = searchConfig(nodes, 'instructions');
    const mixedResults = searchConfig(nodes, 'InStRuCtIoNs');

    expect(upperResults).toHaveLength(1);
    expect(lowerResults).toHaveLength(1);
    expect(mixedResults).toHaveLength(1);
  });

  it('matches mixed-case file path with lowercase query', () => {
    const nodes: ConfigNode[] = [
      createNode({
        name: 'MyConfig.JSON',
        scope: 'user',
        filePath: 'Rules/MyConfig.JSON',
        content: 'no match here',
      }),
    ];

    // File path contains "Rules/MyConfig.JSON" -- query "myconfig" should match via toLowerCase
    const results = searchConfig(nodes, 'myconfig');
    expect(results).toHaveLength(1);
    expect(results[0].node.filePath).toBe('Rules/MyConfig.JSON');
  });
});

// ---------------------------------------------------------------------------
// Empty query and whitespace handling
// ---------------------------------------------------------------------------

describe('searchConfig - empty query', () => {
  it('returns empty results for empty query', () => {
    const nodes: ConfigNode[] = [
      createNode({ name: 'settings.json', scope: 'user', content: '{}' }),
    ];

    expect(searchConfig(nodes, '')).toEqual([]);
  });

  it('returns empty results for whitespace-only query', () => {
    const nodes: ConfigNode[] = [
      createNode({ name: 'settings.json', scope: 'user', content: '{}' }),
    ];

    expect(searchConfig(nodes, '   ')).toEqual([]);
  });

  it('trims whitespace from query before matching', () => {
    const nodes: ConfigNode[] = [
      createNode({
        name: 'settings.json',
        scope: 'user',
        content: '{"theme":"dark"}',
      }),
    ];

    // Padded query should match identically to trimmed query
    const paddedResults = searchConfig(nodes, '  theme  ');
    const trimmedResults = searchConfig(nodes, 'theme');

    expect(paddedResults).toHaveLength(1);
    expect(paddedResults).toEqual(trimmedResults);
  });
});

// ---------------------------------------------------------------------------
// No matches
// ---------------------------------------------------------------------------

describe('searchConfig - no matches', () => {
  it('returns empty results when no content matches the query', () => {
    const nodes: ConfigNode[] = [
      createNode({
        name: 'settings.json',
        scope: 'user',
        content: '{"theme":"dark"}',
        parsedContent: { format: 'json' as const, parsedData: { theme: 'dark' }, keys: ['theme'] },
      }),
    ];

    const results = searchConfig(nodes, 'nonexistent-query-xyz');

    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Matching line context
// ---------------------------------------------------------------------------

describe('searchConfig - matching line context', () => {
  it('returns the matching line containing the query', () => {
    const content = '# Rules\n\nAlways write tests first.\nUse clear names.\nAvoid mutation.';
    const nodes: ConfigNode[] = [
      createNode({
        name: 'coding.md',
        scope: 'project',
        content,
        subsystem: 'rules',
        nodeType: 'rule',
        parsedContent: { format: 'markdown' as const, body: content },
      }),
    ];

    const results = searchConfig(nodes, 'tests first');

    expect(results).toHaveLength(1);
    expect(results[0].matchingLine).toContain('Always write tests first.');
  });

  it('includes line number for the matching line', () => {
    const content = 'line one\nline two\nline three with target\nline four';
    const nodes: ConfigNode[] = [
      createNode({
        name: 'test.md',
        scope: 'user',
        content,
        subsystem: 'memory',
        nodeType: 'memory',
        parsedContent: { format: 'markdown' as const, body: content },
      }),
    ];

    const results = searchConfig(nodes, 'target');

    expect(results).toHaveLength(1);
    expect(results[0].lineNumber).toBe(3);
  });

  it('context is the trimmed version of the matching line', () => {
    const content = 'line one\n   indented match here   \nline three';
    const nodes: ConfigNode[] = [
      createNode({
        name: 'test.md',
        scope: 'user',
        content,
        subsystem: 'memory',
        nodeType: 'memory',
        parsedContent: { format: 'markdown' as const, body: content },
      }),
    ];

    const results = searchConfig(nodes, 'match');

    expect(results).toHaveLength(1);
    // matchingLine is the raw line (with whitespace)
    expect(results[0].matchingLine).toBe('   indented match here   ');
    // context is the trimmed version
    expect(results[0].context).toBe('indented match here');
  });

  it('file path match returns lineNumber 0 and filePath as context', () => {
    const nodes: ConfigNode[] = [
      createNode({
        name: 'special.json',
        scope: 'user',
        filePath: 'config/special.json',
        content: 'no query match in content',
      }),
    ];

    const results = searchConfig(nodes, 'special');

    expect(results).toHaveLength(1);
    // Match is in filePath, not content lines
    expect(results[0].lineNumber).toBe(0);
    expect(results[0].context).toBe('config/special.json');
    expect(results[0].matchingLine).toBe('config/special.json');
  });

  it('name-only match returns lineNumber 0 and name as context', () => {
    const nodes: ConfigNode[] = [
      createNode({
        name: 'unique-name',
        scope: 'user',
        filePath: 'no-match-path.txt',
        content: 'no match in content either',
      }),
    ];

    const results = searchConfig(nodes, 'unique-name');

    expect(results).toHaveLength(1);
    expect(results[0].lineNumber).toBe(0);
    expect(results[0].context).toBe('unique-name');
  });
});

// ---------------------------------------------------------------------------
// Max results limit
// ---------------------------------------------------------------------------

describe('searchConfig - max results limit', () => {
  it('limits results to a maximum count', () => {
    // Create 60 nodes that all match
    const nodes: ConfigNode[] = Array.from({ length: 60 }, (_, i) =>
      createNode({
        name: `file-${i}.json`,
        scope: 'project',
        filePath: `config/file-${i}.json`,
        content: `{"setting_${i}": "value"}`,
        parsedContent: { format: 'json' as const, parsedData: { [`setting_${i}`]: 'value' }, keys: [`setting_${i}`] },
      }),
    );

    const results = searchConfig(nodes, 'file');

    expect(results.length).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// Property: search results are subset of input nodes
// ---------------------------------------------------------------------------

describe('searchConfig - properties', () => {
  it('every result references a node from the input array', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        (query) => {
          const nodes: ConfigNode[] = [
            createNode({ name: 'a.json', scope: 'user', content: `{"${query}": true}` }),
            createNode({ name: 'b.md', scope: 'project', content: '# Nothing here', subsystem: 'memory', nodeType: 'memory', parsedContent: { format: 'markdown' as const, body: '# Nothing here' } }),
          ];

          const results = searchConfig(nodes, query);

          for (const result of results) {
            expect(nodes).toContainEqual(result.node);
          }
        },
      ),
    );
  });
});

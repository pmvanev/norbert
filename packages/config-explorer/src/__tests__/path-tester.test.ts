/**
 * Path Tester tests for @norbert/config-explorer.
 *
 * Verifies the pure testPath function correctly matches file paths against
 * rule node glob patterns using picomatch-compatible semantics.
 *
 * Test budget: 6 behaviors x 2 = 12 max tests.
 * Behaviors: glob match, glob no-match, unconditional, multiple patterns,
 *   empty rules, complex globs.
 */

import { describe, it, expect } from 'vitest';
import type { ConfigNode, MatchResult, PathTestResult } from '../types/index.js';
import { testPath } from '../path-tester.js';

// ---------------------------------------------------------------------------
// Helpers: create rule nodes with frontmatter
// ---------------------------------------------------------------------------

const createRuleNode = (
  name: string,
  frontmatter?: Record<string, unknown>,
): ConfigNode => ({
  id: `project:rules/${name}`,
  name,
  scope: 'project',
  subsystem: 'rules',
  nodeType: 'rule',
  filePath: `rules/${name}`,
  relativePath: `rules/${name}`,
  content: frontmatter
    ? `---\npaths:\n${(frontmatter.paths as string[])?.map((p: string) => `  - "${p}"`).join('\n')}\n---\n# ${name}`
    : `# ${name}`,
  parsedContent: frontmatter
    ? {
        format: 'markdown-with-frontmatter' as const,
        frontmatter,
        body: `# ${name}`,
        frontmatterFields: Object.entries(frontmatter).map(([key, value]) => ({
          key,
          value,
          annotation: typeof value === 'object' ? 'array' : typeof value,
        })),
      }
    : {
        format: 'markdown' as const,
        body: `# ${name}`,
      },
  loadBehavior: 'always',
  error: null,
});

const createNonRuleNode = (name: string, subsystem: string, nodeType: string): ConfigNode => ({
  id: `project:${name}`,
  name,
  scope: 'project',
  subsystem: subsystem as ConfigNode['subsystem'],
  nodeType: nodeType as ConfigNode['nodeType'],
  filePath: name,
  relativePath: name,
  content: `# ${name}`,
  parsedContent: { format: 'markdown' as const, body: `# ${name}` },
  loadBehavior: 'always',
  error: null,
});

// ---------------------------------------------------------------------------
// Glob pattern matching
// ---------------------------------------------------------------------------

describe('testPath - glob matching', () => {
  it('returns MATCH when rule glob pattern matches the input path', () => {
    const rules = [
      createRuleNode('api-rules.md', { paths: ['src/api/**/*.ts'] }),
    ];

    const result = testPath(rules, 'src/api/routes/users.ts');

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].status).toBe('match');
    expect(result.matches[0].pattern).toBe('src/api/**/*.ts');
    expect(result.matches[0].rule.name).toBe('api-rules.md');
  });

  it('returns NO MATCH with mismatch reason when glob does not match', () => {
    const rules = [
      createRuleNode('web-rules.md', { paths: ['src/web/**/*.tsx'] }),
    ];

    const result = testPath(rules, 'src/api/routes/users.ts');

    expect(result.nonMatches).toHaveLength(1);
    expect(result.nonMatches[0].status).toBe('no-match');
    expect(result.nonMatches[0].reason).toContain('src/web/**/*.tsx');
    expect(result.nonMatches[0].reason).toContain('src/api/routes/users.ts');
  });
});

// ---------------------------------------------------------------------------
// Unconditional rules (no paths frontmatter)
// ---------------------------------------------------------------------------

describe('testPath - unconditional rules', () => {
  it('returns unconditional MATCH for rules without paths frontmatter', () => {
    const rules = [
      createRuleNode('coding-standards.md'),
    ];

    const result = testPath(rules, 'src/api/routes/users.ts');

    expect(result.unconditional).toHaveLength(1);
    expect(result.unconditional[0].status).toBe('unconditional');
    expect(result.unconditional[0].reason).toContain('Always loaded');
  });
});

// ---------------------------------------------------------------------------
// Multiple patterns
// ---------------------------------------------------------------------------

describe('testPath - multiple patterns', () => {
  it('returns MATCH with the first matching pattern when one of many patterns matches', () => {
    const rules = [
      createRuleNode('frontend-rules.md', {
        paths: ['src/web/**/*.tsx', 'src/api/**/*.ts', 'src/shared/**/*.ts'],
      }),
    ];

    const result = testPath(rules, 'src/api/routes/users.ts');

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].status).toBe('match');
    expect(result.matches[0].pattern).toBe('src/api/**/*.ts');
  });

  it('returns NO MATCH listing all tested patterns when none match', () => {
    const rules = [
      createRuleNode('frontend-rules.md', {
        paths: ['src/web/**/*.tsx', 'src/components/**/*.svelte'],
      }),
    ];

    const result = testPath(rules, 'src/api/routes/users.ts');

    expect(result.nonMatches).toHaveLength(1);
    expect(result.nonMatches[0].status).toBe('no-match');
    expect(result.nonMatches[0].reason).toContain('src/web/**/*.tsx');
    expect(result.nonMatches[0].reason).toContain('src/components/**/*.svelte');
  });
});

// ---------------------------------------------------------------------------
// Empty rules
// ---------------------------------------------------------------------------

describe('testPath - empty rules list', () => {
  it('returns empty results when no rules are provided', () => {
    const result = testPath([], 'src/api/routes/users.ts');

    expect(result.matches).toHaveLength(0);
    expect(result.nonMatches).toHaveLength(0);
    expect(result.unconditional).toHaveLength(0);
    expect(result.testPath).toBe('src/api/routes/users.ts');
  });
});

// ---------------------------------------------------------------------------
// Complex glob patterns
// ---------------------------------------------------------------------------

describe('testPath - complex glob patterns', () => {
  it('matches brace expansion patterns like *.{ts,tsx}', () => {
    const rules = [
      createRuleNode('ts-rules.md', { paths: ['**/*.{ts,tsx}'] }),
    ];

    const result = testPath(rules, 'src/components/App.tsx');

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].pattern).toBe('**/*.{ts,tsx}');
  });

  it('matches test file patterns like **/*.test.*', () => {
    const rules = [
      createRuleNode('test-rules.md', { paths: ['**/*.test.*'] }),
    ];

    const result = testPath(rules, 'src/api/__tests__/users.test.ts');

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].pattern).toBe('**/*.test.*');
  });
});

// ---------------------------------------------------------------------------
// Filters only rule nodes
// ---------------------------------------------------------------------------

describe('testPath - filters non-rule nodes', () => {
  it('ignores non-rule nodes and only tests rule nodes', () => {
    const nodes: ConfigNode[] = [
      createRuleNode('api-rules.md', { paths: ['src/api/**/*.ts'] }),
      createNonRuleNode('CLAUDE.md', 'memory', 'memory'),
      createNonRuleNode('settings.json', 'settings', 'settings'),
    ];

    const result = testPath(nodes, 'src/api/routes/users.ts');

    // Only the rule node should appear in results
    const totalResults = result.matches.length + result.nonMatches.length + result.unconditional.length;
    expect(totalResults).toBe(1);
    expect(result.matches[0].rule.name).toBe('api-rules.md');
  });
});

// ---------------------------------------------------------------------------
// testPath output structure
// ---------------------------------------------------------------------------

describe('testPath - result structure', () => {
  it('includes the tested path in the result', () => {
    const result = testPath([], 'src/api/routes/users.ts');

    expect(result.testPath).toBe('src/api/routes/users.ts');
  });

  it('categorizes all rules into matches, nonMatches, or unconditional', () => {
    const rules = [
      createRuleNode('match-rule.md', { paths: ['src/api/**/*.ts'] }),
      createRuleNode('no-match-rule.md', { paths: ['src/web/**/*.tsx'] }),
      createRuleNode('unconditional-rule.md'),
    ];

    const result = testPath(rules, 'src/api/routes/users.ts');

    expect(result.matches).toHaveLength(1);
    expect(result.nonMatches).toHaveLength(1);
    expect(result.unconditional).toHaveLength(1);
  });
});

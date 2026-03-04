/**
 * Content parser router tests for @norbert/config-explorer.
 *
 * Verifies the pure parseContent function dispatches to the correct
 * parser based on the classification result. JSON files go to the JSON
 * parser, Markdown files go to the Markdown parser, and unknown
 * extensions produce raw/unparseable content.
 */

import { describe, it, expect } from 'vitest';
import { parseContent } from '../parsers/content-parser.js';
import type { ClassificationResult } from '../classifier.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeClassification = (
  overrides: Partial<ClassificationResult> = {},
): ClassificationResult => ({
  subsystem: 'memory',
  scope: 'project',
  nodeType: 'memory',
  loadBehavior: 'always',
  ...overrides,
});

// ---------------------------------------------------------------------------
// JSON routing
// ---------------------------------------------------------------------------

describe('parseContent - JSON routing', () => {
  it('routes settings.json content to JSON parser', () => {
    const raw = JSON.stringify({ model: 'sonnet', env: { NODE_ENV: 'dev' } });
    const classification = makeClassification({
      subsystem: 'settings',
      nodeType: 'settings',
    });

    const result = parseContent(raw, 'settings.json', classification);

    expect(result.format).toBe('json');
    if (result.format === 'json') {
      expect(result.keys).toContain('model');
      expect(result.keys).toContain('env');
    }
  });

  it('routes .mcp.json content to JSON parser', () => {
    const raw = JSON.stringify({ mcpServers: {} });
    const classification = makeClassification({
      subsystem: 'mcp',
      nodeType: 'mcp',
    });

    const result = parseContent(raw, '.mcp.json', classification);

    expect(result.format).toBe('json');
  });

  it('routes plugin.json to JSON parser', () => {
    const raw = JSON.stringify({ name: 'my-plugin', version: '1.0.0' });
    const classification = makeClassification({
      subsystem: 'plugins',
      nodeType: 'plugin',
    });

    const result = parseContent(raw, '.claude-plugin/plugin.json', classification);

    expect(result.format).toBe('json');
  });

  it('routes hooks.json to JSON parser', () => {
    const raw = JSON.stringify({ hooks: {} });
    const classification = makeClassification({
      subsystem: 'hooks',
      nodeType: 'hook',
    });

    const result = parseContent(raw, 'hooks/hooks.json', classification);

    expect(result.format).toBe('json');
  });
});

// ---------------------------------------------------------------------------
// Markdown routing
// ---------------------------------------------------------------------------

describe('parseContent - Markdown routing', () => {
  it('routes rules .md with frontmatter to markdown parser', () => {
    const raw = [
      '---',
      'paths:',
      '  - "src/**/*.ts"',
      '---',
      '# Rule content',
    ].join('\n');
    const classification = makeClassification({
      subsystem: 'rules',
      nodeType: 'rule',
    });

    const result = parseContent(raw, 'rules/coding.md', classification);

    expect(result.format).toBe('markdown-with-frontmatter');
  });

  it('routes CLAUDE.md without frontmatter to markdown parser', () => {
    const raw = '# Project\n\nInstructions here.';
    const classification = makeClassification({
      subsystem: 'memory',
      nodeType: 'memory',
    });

    const result = parseContent(raw, 'CLAUDE.md', classification);

    expect(result.format).toBe('markdown');
  });

  it('routes agent .md to markdown parser', () => {
    const raw = [
      '---',
      'name: reviewer',
      'tools: Read, Glob',
      '---',
      '',
      'You are a reviewer.',
    ].join('\n');
    const classification = makeClassification({
      subsystem: 'agents',
      nodeType: 'agent',
    });

    const result = parseContent(raw, 'agents/reviewer.md', classification);

    expect(result.format).toBe('markdown-with-frontmatter');
  });

  it('routes skill SKILL.md to markdown parser', () => {
    const raw = [
      '---',
      'name: my-skill',
      'description: A skill',
      '---',
      '',
      '# Skill Instructions',
    ].join('\n');
    const classification = makeClassification({
      subsystem: 'skills',
      nodeType: 'skill',
    });

    const result = parseContent(raw, 'skills/my-skill/SKILL.md', classification);

    expect(result.format).toBe('markdown-with-frontmatter');
  });
});

// ---------------------------------------------------------------------------
// Unknown extension routing
// ---------------------------------------------------------------------------

describe('parseContent - unknown extensions', () => {
  it('returns unparseable for unknown file extensions', () => {
    const raw = 'some random content';
    const classification = makeClassification();

    const result = parseContent(raw, 'unknown-file.txt', classification);

    expect(result.format).toBe('unparseable');
    if (result.format === 'unparseable') {
      expect(result.error).toContain('Unsupported');
    }
  });

  it('returns unparseable for shell scripts', () => {
    const raw = '#!/bin/bash\necho "hello"';
    const classification = makeClassification();

    const result = parseContent(raw, 'hooks/validate.sh', classification);

    expect(result.format).toBe('unparseable');
  });

  it('returns unparseable for files with no extension', () => {
    const raw = 'some content';
    const classification = makeClassification();

    const result = parseContent(raw, 'Makefile', classification);

    expect(result.format).toBe('unparseable');
  });
});

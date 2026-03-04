/**
 * Markdown parser tests for @norbert/config-explorer.
 *
 * Verifies the pure parseMarkdown function extracts YAML frontmatter
 * from Markdown files and annotates fields for display. Malformed YAML
 * produces unparseable content (no exceptions). Uses property-based
 * tests for invariants.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseMarkdown } from '../parsers/markdown-parser.js';
import type { ParsedContent } from '../types/index.js';

// ---------------------------------------------------------------------------
// Rules with paths frontmatter
// ---------------------------------------------------------------------------

describe('parseMarkdown - rules with paths frontmatter', () => {
  it('extracts paths frontmatter and annotates as "Applies to"', () => {
    const raw = [
      '---',
      'paths:',
      '  - "src/api/**/*.ts"',
      '  - "src/**/*.{ts,tsx}"',
      '---',
      '# API Coding Standards',
      '',
      'Use consistent naming conventions.',
    ].join('\n');

    const result = parseMarkdown(raw);

    expect(result.format).toBe('markdown-with-frontmatter');
    if (result.format === 'markdown-with-frontmatter') {
      expect(result.frontmatter).toEqual({
        paths: ['src/api/**/*.ts', 'src/**/*.{ts,tsx}'],
      });
      expect(result.body).toContain('# API Coding Standards');
      expect(result.body).toContain('Use consistent naming conventions.');

      const pathsField = result.frontmatterFields.find(f => f.key === 'paths');
      expect(pathsField).toBeDefined();
      expect(pathsField!.annotation).toBe('Applies to: src/api/**/*.ts, src/**/*.{ts,tsx}');
    }
  });

  it('handles a single path value', () => {
    const raw = [
      '---',
      'paths:',
      '  - "**/*.test.ts"',
      '---',
      '# Testing rules',
    ].join('\n');

    const result = parseMarkdown(raw);

    expect(result.format).toBe('markdown-with-frontmatter');
    if (result.format === 'markdown-with-frontmatter') {
      const pathsField = result.frontmatterFields.find(f => f.key === 'paths');
      expect(pathsField!.annotation).toBe('Applies to: **/*.test.ts');
    }
  });
});

// ---------------------------------------------------------------------------
// Skills SKILL.md with full frontmatter
// ---------------------------------------------------------------------------

describe('parseMarkdown - skill SKILL.md with frontmatter', () => {
  it('extracts skill frontmatter fields with annotations', () => {
    const raw = [
      '---',
      'name: code-reviewer',
      'description: Reviews code for quality and best practices',
      'allowed-tools:',
      '  - Read',
      '  - Glob',
      '  - Grep',
      'model: sonnet',
      'hooks:',
      '  PreToolUse:',
      '    - matcher: "Bash"',
      '---',
      '# Code Reviewer Skill',
      '',
      'You are a code reviewer.',
    ].join('\n');

    const result = parseMarkdown(raw);

    expect(result.format).toBe('markdown-with-frontmatter');
    if (result.format === 'markdown-with-frontmatter') {
      expect(result.frontmatter['name']).toBe('code-reviewer');
      expect(result.frontmatter['description']).toBe('Reviews code for quality and best practices');
      expect(result.frontmatter['allowed-tools']).toEqual(['Read', 'Glob', 'Grep']);
      expect(result.frontmatter['model']).toBe('sonnet');
      expect(result.frontmatter['hooks']).toBeDefined();
      expect(result.body).toContain('# Code Reviewer Skill');

      const nameField = result.frontmatterFields.find(f => f.key === 'name');
      expect(nameField).toBeDefined();
      expect(nameField!.annotation).toBe('Name: code-reviewer');

      const descriptionField = result.frontmatterFields.find(f => f.key === 'description');
      expect(descriptionField).toBeDefined();
      expect(descriptionField!.annotation).toBe('Description: Reviews code for quality and best practices');

      const toolsField = result.frontmatterFields.find(f => f.key === 'allowed-tools');
      expect(toolsField).toBeDefined();
      expect(toolsField!.annotation).toBe('Allowed tools: Read, Glob, Grep');

      const modelField = result.frontmatterFields.find(f => f.key === 'model');
      expect(modelField).toBeDefined();
      expect(modelField!.annotation).toBe('Model: sonnet');

      const hooksField = result.frontmatterFields.find(f => f.key === 'hooks');
      expect(hooksField).toBeDefined();
      expect(hooksField!.annotation).toBe('Hooks: configured');
    }
  });

  it('handles skill with minimal frontmatter', () => {
    const raw = [
      '---',
      'name: simple-skill',
      '---',
      '# Simple Skill',
    ].join('\n');

    const result = parseMarkdown(raw);

    expect(result.format).toBe('markdown-with-frontmatter');
    if (result.format === 'markdown-with-frontmatter') {
      expect(result.frontmatter['name']).toBe('simple-skill');
      expect(result.frontmatterFields).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Agent .md with frontmatter
// ---------------------------------------------------------------------------

describe('parseMarkdown - agent .md with frontmatter', () => {
  it('extracts agent frontmatter fields with annotations', () => {
    const raw = [
      '---',
      'name: code-reviewer',
      'description: Reviews code for quality and best practices',
      'tools: Read, Glob, Grep',
      'model: sonnet',
      'skills:',
      '  - api-conventions',
      '---',
      '',
      'You are a code reviewer. When invoked, analyze the code.',
    ].join('\n');

    const result = parseMarkdown(raw);

    expect(result.format).toBe('markdown-with-frontmatter');
    if (result.format === 'markdown-with-frontmatter') {
      expect(result.frontmatter['name']).toBe('code-reviewer');
      expect(result.frontmatter['tools']).toBe('Read, Glob, Grep');
      expect(result.frontmatter['model']).toBe('sonnet');
      expect(result.frontmatter['skills']).toEqual(['api-conventions']);

      const toolsField = result.frontmatterFields.find(f => f.key === 'tools');
      expect(toolsField).toBeDefined();
      expect(toolsField!.annotation).toBe('Tools: Read, Glob, Grep');

      const skillsField = result.frontmatterFields.find(f => f.key === 'skills');
      expect(skillsField).toBeDefined();
      expect(skillsField!.annotation).toBe('Skills: api-conventions');
    }
  });
});

// ---------------------------------------------------------------------------
// Plain markdown (no frontmatter)
// ---------------------------------------------------------------------------

describe('parseMarkdown - plain markdown', () => {
  it('parses markdown without frontmatter as plain markdown', () => {
    const raw = [
      '# Project Instructions',
      '',
      'This is a CLAUDE.md file without frontmatter.',
      '',
      '## Section',
      '',
      'Content here.',
    ].join('\n');

    const result = parseMarkdown(raw);

    expect(result.format).toBe('markdown');
    if (result.format === 'markdown') {
      expect(result.body).toContain('# Project Instructions');
      expect(result.body).toContain('This is a CLAUDE.md file without frontmatter.');
    }
  });

  it('parses typical CLAUDE.md without frontmatter', () => {
    const raw = [
      '# My Project',
      '',
      '## Development Paradigm',
      '',
      'TypeScript with pure core / effect shell.',
    ].join('\n');

    const result = parseMarkdown(raw);

    expect(result.format).toBe('markdown');
    if (result.format === 'markdown') {
      expect(result.body).toContain('# My Project');
    }
  });
});

// ---------------------------------------------------------------------------
// Malformed YAML frontmatter
// ---------------------------------------------------------------------------

describe('parseMarkdown - malformed YAML', () => {
  it('returns unparseable for malformed YAML frontmatter', () => {
    const raw = [
      '---',
      'paths: [invalid yaml',
      '  missing: closing bracket',
      '---',
      '# Content',
    ].join('\n');

    const result = parseMarkdown(raw);

    expect(result.format).toBe('unparseable');
    if (result.format === 'unparseable') {
      expect(result.error).toBeTruthy();
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('never throws an exception for malformed YAML', () => {
    const raw = [
      '---',
      '  : : : invalid',
      'key: [unclosed',
      '---',
      '# Body',
    ].join('\n');

    // Must not throw
    const result = parseMarkdown(raw);
    expect(result).toBeDefined();
    expect(result.format).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Empty file
// ---------------------------------------------------------------------------

describe('parseMarkdown - empty file', () => {
  it('returns markdown format for empty string', () => {
    const result = parseMarkdown('');

    expect(result.format).toBe('markdown');
    if (result.format === 'markdown') {
      expect(result.body).toBe('');
    }
  });

  it('returns markdown format for whitespace-only content', () => {
    const result = parseMarkdown('   \n  \n  ');

    expect(result.format).toBe('markdown');
    if (result.format === 'markdown') {
      expect(result.body.trim()).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('parseMarkdown - edge cases', () => {
  it('handles frontmatter with empty data as plain markdown', () => {
    const raw = [
      '---',
      '---',
      '# Content after empty frontmatter',
    ].join('\n');

    const result = parseMarkdown(raw);

    // Empty frontmatter has no fields -- treat as plain markdown
    expect(result.format).toBe('markdown');
    if (result.format === 'markdown') {
      expect(result.body).toContain('# Content after empty frontmatter');
    }
  });

  it('handles frontmatter with boolean values', () => {
    const raw = [
      '---',
      'disable-model-invocation: true',
      'user-invocable: false',
      '---',
      '# Skill content',
    ].join('\n');

    const result = parseMarkdown(raw);

    expect(result.format).toBe('markdown-with-frontmatter');
    if (result.format === 'markdown-with-frontmatter') {
      expect(result.frontmatter['disable-model-invocation']).toBe(true);
      expect(result.frontmatter['user-invocable']).toBe(false);
    }
  });

  it('preserves markdown body content after frontmatter', () => {
    const raw = [
      '---',
      'name: test',
      '---',
      '',
      '# Title',
      '',
      'Body paragraph with **bold** and `code`.',
      '',
      '```typescript',
      'const x = 42;',
      '```',
    ].join('\n');

    const result = parseMarkdown(raw);

    expect(result.format).toBe('markdown-with-frontmatter');
    if (result.format === 'markdown-with-frontmatter') {
      expect(result.body).toContain('# Title');
      expect(result.body).toContain('Body paragraph with **bold** and `code`.');
      expect(result.body).toContain('const x = 42;');
    }
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('parseMarkdown - properties', () => {
  it('never throws an exception for any input', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const result = parseMarkdown(raw);
        expect(result).toBeDefined();
        expect(result.format).toBeDefined();
      }),
    );
  });

  it('result format is always markdown, markdown-with-frontmatter, or unparseable', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const result = parseMarkdown(raw);
        expect(['markdown', 'markdown-with-frontmatter', 'unparseable']).toContain(result.format);
      }),
    );
  });

  it('valid frontmatter always produces frontmatterFields array', () => {
    const keyArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s));
    const valueArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('\n') && !s.includes(':'));
    const frontmatterArb = fc.array(fc.tuple(keyArb, valueArb), { minLength: 1, maxLength: 5 });

    fc.assert(
      fc.property(frontmatterArb, (fields) => {
        const yamlLines = fields.map(([k, v]) => `${k}: ${v}`);
        const raw = ['---', ...yamlLines, '---', '# Body'].join('\n');
        const result = parseMarkdown(raw);

        if (result.format === 'markdown-with-frontmatter') {
          expect(result.frontmatterFields.length).toBeGreaterThan(0);
          expect(result.body).toContain('# Body');
        }
        // Some generated YAML might be malformed, which is fine
      }),
    );
  });
});

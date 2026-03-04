/**
 * JSON parser tests for @norbert/config-explorer.
 *
 * Verifies the pure parseJson function converts raw JSON strings into
 * ParsedContent values. Malformed JSON produces unparseable content
 * (no exceptions). Uses property-based tests for roundtrip invariants.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseJson } from '../parsers/json-parser.js';
import type { ParsedContent } from '../types/index.js';

// ---------------------------------------------------------------------------
// Valid JSON parsing
// ---------------------------------------------------------------------------

describe('parseJson - valid JSON', () => {
  it('parses a simple settings.json into json ParsedContent', () => {
    const raw = JSON.stringify({
      permissions: { allow: ['Read', 'Write'] },
      model: 'sonnet',
    });

    const result = parseJson(raw);

    expect(result.format).toBe('json');
    if (result.format === 'json') {
      expect(result.parsedData).toEqual({
        permissions: { allow: ['Read', 'Write'] },
        model: 'sonnet',
      });
      expect(result.keys).toEqual(['permissions', 'model']);
    }
  });

  it('parses an empty JSON object', () => {
    const result = parseJson('{}');

    expect(result.format).toBe('json');
    if (result.format === 'json') {
      expect(result.parsedData).toEqual({});
      expect(result.keys).toEqual([]);
    }
  });

  it('parses plugin.json manifest', () => {
    const raw = JSON.stringify({
      name: 'my-plugin',
      description: 'Plugin description',
      version: '1.0.0',
      author: { name: 'Author' },
    });

    const result = parseJson(raw);

    expect(result.format).toBe('json');
    if (result.format === 'json') {
      expect(result.keys).toEqual(['name', 'description', 'version', 'author']);
      expect(result.parsedData['name']).toBe('my-plugin');
    }
  });

  it('parses .mcp.json with mcpServers', () => {
    const raw = JSON.stringify({
      mcpServers: {
        'file-search': {
          command: 'npx',
          args: ['file-search-mcp'],
        },
      },
    });

    const result = parseJson(raw);

    expect(result.format).toBe('json');
    if (result.format === 'json') {
      expect(result.keys).toEqual(['mcpServers']);
    }
  });

  it('parses settings with nested structures', () => {
    const raw = JSON.stringify({
      permissions: {
        allow: ['Bash(npm:*)'],
        deny: ['Bash(rm:*)'],
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: './validate.sh' }],
          },
        ],
      },
      env: { NODE_ENV: 'development' },
    });

    const result = parseJson(raw);

    expect(result.format).toBe('json');
    if (result.format === 'json') {
      expect(result.keys).toContain('permissions');
      expect(result.keys).toContain('hooks');
      expect(result.keys).toContain('env');
    }
  });
});

// ---------------------------------------------------------------------------
// Malformed JSON handling (no exceptions)
// ---------------------------------------------------------------------------

describe('parseJson - malformed JSON', () => {
  it('returns unparseable for invalid JSON', () => {
    const result = parseJson('{ invalid json }');

    expect(result.format).toBe('unparseable');
    if (result.format === 'unparseable') {
      expect(result.error).toBeTruthy();
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('returns unparseable for empty string', () => {
    const result = parseJson('');

    expect(result.format).toBe('unparseable');
  });

  it('returns unparseable for plain text', () => {
    const result = parseJson('not json at all');

    expect(result.format).toBe('unparseable');
  });

  it('returns unparseable for JSON array (not object)', () => {
    const result = parseJson('[1, 2, 3]');

    expect(result.format).toBe('unparseable');
    if (result.format === 'unparseable') {
      expect(result.error).toContain('object');
    }
  });

  it('returns unparseable for JSON primitives', () => {
    expect(parseJson('"hello"').format).toBe('unparseable');
    expect(parseJson('42').format).toBe('unparseable');
    expect(parseJson('true').format).toBe('unparseable');
    expect(parseJson('null').format).toBe('unparseable');
  });

  it('returns unparseable for trailing comma', () => {
    const result = parseJson('{ "key": "value", }');

    expect(result.format).toBe('unparseable');
  });

  it('never throws an exception for any input', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        // This must not throw -- it should always return a ParsedContent
        const result = parseJson(raw);
        expect(result).toBeDefined();
        expect(result.format).toBeDefined();
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('parseJson - properties', () => {
  it('roundtrip: valid JSON object always produces json format', () => {
    const jsonObjectArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
      ),
      { minKeys: 0, maxKeys: 10 },
    );

    fc.assert(
      fc.property(jsonObjectArb, (obj) => {
        const raw = JSON.stringify(obj);
        const result = parseJson(raw);
        expect(result.format).toBe('json');
      }),
    );
  });

  it('keys match top-level object keys for any valid JSON object', () => {
    const jsonObjectArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
      ),
      { minKeys: 0, maxKeys: 10 },
    );

    fc.assert(
      fc.property(jsonObjectArb, (obj) => {
        const raw = JSON.stringify(obj);
        const result = parseJson(raw);
        if (result.format === 'json') {
          expect(new Set(result.keys)).toEqual(new Set(Object.keys(obj)));
        }
      }),
    );
  });

  it('result format is always either json or unparseable', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const result = parseJson(raw);
        expect(['json', 'unparseable']).toContain(result.format);
      }),
    );
  });
});

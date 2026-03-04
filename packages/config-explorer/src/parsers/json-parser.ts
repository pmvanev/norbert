/**
 * JSON content parser -- pure function that parses raw JSON strings
 * into ParsedContent values.
 *
 * No I/O, no exceptions. Malformed JSON produces an 'unparseable'
 * ParsedContent with an error description.
 *
 * Handles: settings.json, plugin.json, installed_plugins.json,
 * known_marketplaces.json, .mcp.json, and any other JSON config file.
 */

import type { JsonParsedContent, UnparseableParsedContent, ParsedContent } from '../types/index.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const createJsonContent = (
  parsedData: Readonly<Record<string, unknown>>,
): JsonParsedContent => ({
  format: 'json',
  parsedData,
  keys: Object.keys(parsedData),
});

const createUnparseableContent = (error: string): UnparseableParsedContent => ({
  format: 'unparseable',
  error,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a raw JSON string into a ParsedContent value.
 *
 * Pure function: no I/O, no exceptions thrown.
 *
 * @param raw - Raw file content (expected to be JSON)
 * @returns ParsedContent with format 'json' on success, 'unparseable' on failure
 *
 * Only JSON objects are accepted. Arrays, primitives, and null
 * produce 'unparseable' with an explanatory error message.
 */
export const parseJson = (raw: string): ParsedContent => {
  if (raw.trim() === '') {
    return createUnparseableContent('Empty content: expected a JSON object');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    return createUnparseableContent(`Invalid JSON: ${message}`);
  }

  if (!isPlainObject(parsed)) {
    return createUnparseableContent(
      'Expected a JSON object at the top level, but found a different type',
    );
  }

  return createJsonContent(parsed as Readonly<Record<string, unknown>>);
};

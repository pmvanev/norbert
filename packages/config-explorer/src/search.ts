/**
 * Search -- pure function for full-text configuration search.
 *
 * Searches across all ConfigNode content (file path, name, and raw content)
 * using case-insensitive substring matching. Returns SearchResult[] with
 * the matching line, line number, and context.
 *
 * No I/O. Pure function operating on pre-assembled ConfigNode data.
 */

import type { ConfigNode, SearchResult } from './types/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESULTS = 50;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Finds the first line in content that contains the query (case-insensitive).
 * Returns the line text and its 1-based line number, or null if no line matches.
 */
const findMatchingLine = (
  content: string,
  queryLower: string,
): { line: string; lineNumber: number } | null => {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(queryLower)) {
      return { line: lines[i], lineNumber: i + 1 };
    }
  }
  return null;
};

/**
 * Checks whether a node matches the query in any searchable field:
 * file path, node name, or raw content.
 */
const nodeMatchesQuery = (node: ConfigNode, queryLower: string): boolean =>
  node.filePath.toLowerCase().includes(queryLower) ||
  node.name.toLowerCase().includes(queryLower) ||
  node.content.toLowerCase().includes(queryLower);

/**
 * Builds a SearchResult for a matching node, extracting the first matching line.
 */
const buildSearchResult = (
  node: ConfigNode,
  queryLower: string,
): SearchResult => {
  // Try to find a matching line in the raw content first
  const contentMatch = findMatchingLine(node.content, queryLower);

  if (contentMatch) {
    return {
      node,
      matchingLine: contentMatch.line,
      lineNumber: contentMatch.lineNumber,
      context: contentMatch.line.trim(),
    };
  }

  // Match was in file path or node name (not in content lines)
  const matchSource = node.filePath.toLowerCase().includes(queryLower)
    ? node.filePath
    : node.name;

  return {
    node,
    matchingLine: matchSource,
    lineNumber: 0,
    context: matchSource,
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Searches all config nodes for the given query string.
 *
 * Pure function: no I/O, no side effects. Performs case-insensitive
 * substring matching across file paths, node names, and raw content.
 *
 * @param nodes - All config nodes to search
 * @param query - Search query string
 * @returns Array of SearchResult, limited to MAX_RESULTS
 */
export const searchConfig = (
  nodes: readonly ConfigNode[],
  query: string,
): readonly SearchResult[] => {
  const trimmedQuery = query.trim();

  if (trimmedQuery === '') {
    return [];
  }

  const queryLower = trimmedQuery.toLowerCase();
  const results: SearchResult[] = [];

  for (const node of nodes) {
    if (results.length >= MAX_RESULTS) {
      break;
    }

    if (nodeMatchesQuery(node, queryLower)) {
      results.push(buildSearchResult(node, queryLower));
    }
  }

  return results;
};

/**
 * Path Tester -- pure function that tests a file path against rule node
 * glob patterns using picomatch-compatible semantics.
 *
 * No I/O. Accepts ConfigNode array and a file path string, returns
 * a PathTestResult categorizing each rule as match, no-match, or unconditional.
 *
 * Rules without `paths` frontmatter are unconditional (always loaded).
 * Rules with `paths` frontmatter are tested against the input path.
 */

import picomatch from 'picomatch';
import type {
  ConfigNode,
  MatchResult,
  MatchStatus,
  PathTestResult,
} from './types/index.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract glob patterns from a rule node's parsed frontmatter.
 * Returns null if the rule has no paths frontmatter (unconditional).
 */
const extractPathPatterns = (node: ConfigNode): readonly string[] | null => {
  if (node.parsedContent.format !== 'markdown-with-frontmatter') {
    return null;
  }

  const { frontmatter } = node.parsedContent;
  const paths = frontmatter.paths;

  if (!Array.isArray(paths)) {
    return null;
  }

  return paths.filter((p): p is string => typeof p === 'string');
};

/**
 * Test a single pattern against a file path.
 */
const matchesPattern = (pattern: string, filePath: string): boolean =>
  picomatch.isMatch(filePath, pattern, { dot: true });

/**
 * Find the first matching pattern from an array of glob patterns.
 */
const findMatchingPattern = (
  patterns: readonly string[],
  filePath: string,
): string | null => {
  for (const pattern of patterns) {
    if (matchesPattern(pattern, filePath)) {
      return pattern;
    }
  }
  return null;
};

/**
 * Build a mismatch reason explaining which patterns were tested.
 */
const buildMismatchReason = (
  patterns: readonly string[],
  filePath: string,
): string => {
  if (patterns.length === 1) {
    return `Pattern '${patterns[0]}' does not match path '${filePath}'`;
  }
  const patternList = patterns.map((p) => `'${p}'`).join(', ');
  return `None of the patterns [${patternList}] match path '${filePath}'`;
};

/**
 * Classify a single rule node against a file path.
 */
const classifyRule = (node: ConfigNode, filePath: string): MatchResult => {
  const patterns = extractPathPatterns(node);

  if (patterns === null) {
    return {
      rule: node,
      status: 'unconditional',
      pattern: null,
      reason: 'Always loaded (no paths frontmatter)',
    };
  }

  if (patterns.length === 0) {
    return {
      rule: node,
      status: 'unconditional',
      pattern: null,
      reason: 'Always loaded (empty paths list)',
    };
  }

  const matchingPattern = findMatchingPattern(patterns, filePath);

  if (matchingPattern !== null) {
    return {
      rule: node,
      status: 'match',
      pattern: matchingPattern,
      reason: `Matched pattern '${matchingPattern}'`,
    };
  }

  return {
    rule: node,
    status: 'no-match',
    pattern: null,
    reason: buildMismatchReason(patterns, filePath),
  };
};

/**
 * Filter nodes to only rule subsystem nodes.
 */
const filterRuleNodes = (nodes: readonly ConfigNode[]): readonly ConfigNode[] =>
  nodes.filter((node) => node.subsystem === 'rules');

/**
 * Partition match results into three categories.
 */
const partitionResults = (
  results: readonly MatchResult[],
): {
  matches: readonly MatchResult[];
  nonMatches: readonly MatchResult[];
  unconditional: readonly MatchResult[];
} => {
  const matches: MatchResult[] = [];
  const nonMatches: MatchResult[] = [];
  const unconditional: MatchResult[] = [];

  for (const result of results) {
    switch (result.status) {
      case 'match':
        matches.push(result);
        break;
      case 'no-match':
        nonMatches.push(result);
        break;
      case 'unconditional':
        unconditional.push(result);
        break;
    }
  }

  return { matches, nonMatches, unconditional };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Test a file path against all rule nodes' glob patterns.
 *
 * Pure function: no I/O, no side effects. Takes an array of ConfigNode
 * values (filters to rules only) and a file path string, returns a
 * PathTestResult categorizing each rule.
 *
 * @param nodes - All config nodes (will be filtered to rules subsystem)
 * @param filePath - File path relative to project root to test
 * @returns PathTestResult with matches, nonMatches, and unconditional arrays
 */
export const testPath = (
  nodes: readonly ConfigNode[],
  filePath: string,
): PathTestResult => {
  const ruleNodes = filterRuleNodes(nodes);
  const results = ruleNodes.map((node) => classifyRule(node, filePath));
  const { matches, nonMatches, unconditional } = partitionResults(results);

  return {
    testPath: filePath,
    matches,
    nonMatches,
    unconditional,
  };
};

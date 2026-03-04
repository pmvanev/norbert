/**
 * Discovery -- pure function that assembles a complete ConfigModel from
 * an array of discovered file entries (path + content + scope).
 *
 * No I/O. The filesystem adapter reads files and provides the entries.
 * This function classifies, parses, and assembles everything into a
 * ConfigModel value.
 */

import type {
  ScopeName,
  SubsystemName,
  ConfigNode,
  ConfigModel,
  ParseError,
} from './types/index.js';
import { classifyFile } from './classifier.js';
import { parseContent } from './parsers/content-parser.js';
import { extractEdges } from './cross-references.js';
import { detectConflicts } from './conflict-detector.js';

// ---------------------------------------------------------------------------
// Input type -- what the adapter provides
// ---------------------------------------------------------------------------

export interface DiscoveredFileEntry {
  /** Relative path from scope root (e.g., "settings.json", "rules/coding.md") */
  readonly path: string;
  /** Raw file content as string */
  readonly content: string;
  /** Which scope this file was discovered in */
  readonly scope: ScopeName;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const generateNodeId = (scope: ScopeName, filePath: string): string =>
  `${scope}:${filePath.replace(/\\/g, '/')}`;

const extractDisplayName = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').pop() ?? filePath;
};

const buildParseError = (parsedContent: { format: string; error?: string }): ParseError | null => {
  if (parsedContent.format === 'unparseable' && 'error' in parsedContent) {
    return { message: parsedContent.error as string };
  }
  return null;
};

const buildConfigNode = (entry: DiscoveredFileEntry): ConfigNode => {
  const classification = classifyFile(entry.path, entry.scope);
  const parsedContent = parseContent(entry.content, entry.path, classification);

  return {
    id: generateNodeId(classification.scope, entry.path),
    name: extractDisplayName(entry.path),
    scope: classification.scope,
    subsystem: classification.subsystem,
    nodeType: classification.nodeType,
    filePath: entry.path,
    relativePath: entry.path,
    content: entry.content,
    parsedContent,
    loadBehavior: classification.loadBehavior,
    error: buildParseError(parsedContent),
  };
};

const computeScopeSummary = (
  nodes: readonly ConfigNode[],
): Partial<Record<ScopeName, number>> => {
  const summary: Partial<Record<ScopeName, number>> = {};
  for (const node of nodes) {
    summary[node.scope] = (summary[node.scope] ?? 0) + 1;
  }
  return summary;
};

const computeSubsystemSummary = (
  nodes: readonly ConfigNode[],
): Partial<Record<SubsystemName, number>> => {
  const summary: Partial<Record<SubsystemName, number>> = {};
  for (const node of nodes) {
    summary[node.subsystem] = (summary[node.subsystem] ?? 0) + 1;
  }
  return summary;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assembles a complete ConfigModel from discovered file entries.
 *
 * Pure function: no I/O, no side effects. Takes pre-read file data
 * and produces the full model including nodes, summaries, and metadata.
 *
 * @param entries - Array of discovered file entries (path + content + scope)
 * @returns Complete ConfigModel value
 */
export const assembleConfigModel = (
  entries: readonly DiscoveredFileEntry[],
): ConfigModel => {
  const nodes = entries.map(buildConfigNode);
  const edges = extractEdges(nodes);
  const conflicts = detectConflicts(nodes);
  const scopeSummary = computeScopeSummary(nodes);
  const subsystemSummary = computeSubsystemSummary(nodes);

  return {
    nodes,
    edges,
    precedenceChains: {},
    scopeSummary,
    subsystemSummary,
    totalFiles: nodes.length,
    conflicts,
    scanTimestamp: new Date().toISOString(),
  };
};

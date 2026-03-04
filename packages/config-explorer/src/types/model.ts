/**
 * ConfigModel and supporting types -- the complete assembled configuration model.
 *
 * Also includes MatchResult, PathTestResult, SearchResult, NamingConflict,
 * and FileTree which are part of the config-explorer domain.
 */

import type { ScopeName } from './scope.js';
import type { SubsystemName } from './subsystem.js';
import type { ConfigNode, NodeType } from './node.js';
import type { ConfigEdge } from './edge.js';
import type { PrecedenceChain } from './precedence.js';

// ---------------------------------------------------------------------------
// NamingConflict
// ---------------------------------------------------------------------------

export interface NamingConflict {
  readonly name: string;
  readonly nodeType: NodeType;
  readonly higherScope: ConfigNode;
  readonly lowerScope: ConfigNode;
  readonly resolution: string;
}

// ---------------------------------------------------------------------------
// MatchResult
// ---------------------------------------------------------------------------

export type MatchStatus = 'match' | 'no-match' | 'unconditional';

export interface MatchResult {
  readonly rule: ConfigNode;
  readonly status: MatchStatus;
  readonly pattern: string | null;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// PathTestResult
// ---------------------------------------------------------------------------

export interface PathTestResult {
  readonly testPath: string;
  readonly matches: readonly MatchResult[];
  readonly nonMatches: readonly MatchResult[];
  readonly unconditional: readonly MatchResult[];
}

// ---------------------------------------------------------------------------
// SearchResult
// ---------------------------------------------------------------------------

export interface SearchResult {
  readonly node: ConfigNode;
  readonly matchingLine: string;
  readonly lineNumber: number;
  readonly context: string;
}

// ---------------------------------------------------------------------------
// FileTree
// ---------------------------------------------------------------------------

export type FileTreeEntryType = 'file' | 'directory' | 'missing';

export interface FileTree {
  readonly name: string;
  readonly path: string;
  readonly scope: ScopeName;
  readonly subsystem: SubsystemName | null;
  readonly type: FileTreeEntryType;
  readonly children: readonly FileTree[];
  readonly node: ConfigNode | null;
  readonly tooltip: string | null;
}

// ---------------------------------------------------------------------------
// ConfigModel
// ---------------------------------------------------------------------------

export interface ConfigModel {
  readonly nodes: readonly ConfigNode[];
  readonly edges: readonly ConfigEdge[];
  readonly precedenceChains: Readonly<Partial<Record<SubsystemName, PrecedenceChain>>>;
  readonly scopeSummary: Readonly<Partial<Record<ScopeName, number>>>;
  readonly subsystemSummary: Readonly<Partial<Record<SubsystemName, number>>>;
  readonly totalFiles: number;
  readonly conflicts: readonly NamingConflict[];
  readonly scanTimestamp: string;
}

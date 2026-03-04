/**
 * @norbert/config-explorer -- Pure domain types and functions for
 * the Claude Code configuration ecosystem.
 *
 * This package has zero @norbert/* dependencies.
 * All types are readonly (immutable domain).
 * No imports from @norbert/core or any other @norbert/* package.
 */

// All domain types and constructors
export type {
  // Scope
  ConfigScope,
  ScopeName,
  ManagedScope,
  UserScope,
  ProjectScope,
  LocalScope,
  PluginScope,
  // Subsystem
  ConfigSubsystem,
  SubsystemName,
  MemorySubsystem,
  SettingsSubsystem,
  RulesSubsystem,
  SkillsSubsystem,
  AgentsSubsystem,
  HooksSubsystem,
  PluginsSubsystem,
  McpSubsystem,
  // Node
  NodeType,
  LoadBehavior,
  FrontmatterField,
  ParsedContent,
  JsonParsedContent,
  MarkdownWithFrontmatterParsedContent,
  MarkdownParsedContent,
  UnparseableParsedContent,
  ParseError,
  ConfigNode,
  // Edge
  EdgeType,
  ConfigEdge,
  // Precedence
  ResolutionType,
  PrecedenceStatus,
  PrecedenceEntry,
  PrecedenceChain,
  // Model and supporting types
  NamingConflict,
  MatchStatus,
  MatchResult,
  PathTestResult,
  SearchResult,
  FileTreeEntryType,
  FileTree,
  ConfigModel,
} from './types/index.js';

export {
  // Scope constructors and utilities
  managedScope,
  userScope,
  projectScope,
  localScope,
  pluginScope,
  ALL_SCOPES,
  scopeFromName,
  isManaged,
  isUser,
  isProject,
  isLocal,
  isPlugin,
  // Subsystem constructors and utilities
  memorySubsystem,
  settingsSubsystem,
  rulesSubsystem,
  skillsSubsystem,
  agentsSubsystem,
  hooksSubsystem,
  pluginsSubsystem,
  mcpSubsystem,
  ALL_SUBSYSTEMS,
  subsystemFromName,
  isMemory,
  isSettings,
  isRules,
  isSkills,
  isAgents,
  isHooks,
  isPlugins,
  isMcp,
  // Node type constants and guards
  ALL_NODE_TYPES,
  isJsonContent,
  isMarkdownWithFrontmatter,
  isMarkdownContent,
  isUnparseable,
  // Edge type constants
  ALL_EDGE_TYPES,
  // Precedence constants
  ALL_RESOLUTION_TYPES,
  ALL_PRECEDENCE_STATUSES,
} from './types/index.js';

// Port type
export type { ConfigFileReaderPort, ScannedFileEntry } from './ports.js';

// Classifier (pure function)
export { classifyFile } from './classifier.js';
export type { ClassificationResult } from './classifier.js';

// Parsers (pure functions)
export { parseJson, parseMarkdown, parseContent } from './parsers/index.js';

// Scanner (pure function)
export { getScanPaths } from './scanner.js';
export type { ScanPathEntry } from './scanner.js';

// Discovery (pure function)
export { assembleConfigModel } from './discovery.js';
export type { DiscoveredFileEntry } from './discovery.js';

// File tree builder (pure function)
export { buildFileTrees } from './file-tree-builder.js';

// Precedence resolver (pure function)
export { resolvePrecedence } from './precedence.js';

// Path tester (pure function)
export { testPath } from './path-tester.js';

// Mind map builder (pure function)
export { buildMindMapData } from './mind-map-builder.js';
export type { MindMapNode } from './mind-map-builder.js';

// Search (pure function)
export { searchConfig } from './search.js';

// Cross-reference extraction (pure function)
export { extractEdges } from './cross-references.js';

// Conflict detection (pure function)
export { detectConflicts } from './conflict-detector.js';

// Graph builder (pure function)
export { buildGraphData } from './graph-builder.js';
export type { GraphNode, GraphLink, GraphData } from './graph-builder.js';

/**
 * Types barrel -- re-exports all config-explorer domain types.
 */

// Scope
export type {
  ConfigScope,
  ScopeName,
  ManagedScope,
  UserScope,
  ProjectScope,
  LocalScope,
  PluginScope,
} from './scope.js';

export {
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
} from './scope.js';

// Subsystem
export type {
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
} from './subsystem.js';

export {
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
} from './subsystem.js';

// Node
export type {
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
} from './node.js';

export {
  ALL_NODE_TYPES,
  isJsonContent,
  isMarkdownWithFrontmatter,
  isMarkdownContent,
  isUnparseable,
} from './node.js';

// Edge
export type {
  EdgeType,
  ConfigEdge,
} from './edge.js';

export {
  ALL_EDGE_TYPES,
} from './edge.js';

// Precedence
export type {
  ResolutionType,
  PrecedenceStatus,
  PrecedenceEntry,
  PrecedenceChain,
} from './precedence.js';

export {
  ALL_RESOLUTION_TYPES,
  ALL_PRECEDENCE_STATUSES,
} from './precedence.js';

// Model and supporting types
export type {
  NamingConflict,
  MatchStatus,
  MatchResult,
  PathTestResult,
  SearchResult,
  FileTreeEntryType,
  FileTree,
  ConfigModel,
} from './model.js';

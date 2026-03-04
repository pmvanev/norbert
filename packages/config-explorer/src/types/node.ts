/**
 * ConfigNode -- a single configuration element discovered on the filesystem.
 *
 * Combines scope, subsystem, file path, and parsed content into one
 * immutable value. The node type determines visual shape in the Galaxy view.
 */

import type { ScopeName } from './scope.js';
import type { SubsystemName } from './subsystem.js';

// ---------------------------------------------------------------------------
// NodeType (Discriminated Union -- visual shape for Galaxy view)
// ---------------------------------------------------------------------------

export type NodeType =
  | 'agent'
  | 'skill'
  | 'rule'
  | 'hook'
  | 'mcp'
  | 'memory'
  | 'settings'
  | 'plugin';

export const ALL_NODE_TYPES: readonly NodeType[] = [
  'agent',
  'skill',
  'rule',
  'hook',
  'mcp',
  'memory',
  'settings',
  'plugin',
] as const;

// ---------------------------------------------------------------------------
// LoadBehavior
// ---------------------------------------------------------------------------

export type LoadBehavior = 'always' | 'on-demand';

// ---------------------------------------------------------------------------
// FrontmatterField
// ---------------------------------------------------------------------------

export interface FrontmatterField {
  readonly key: string;
  readonly value: unknown;
  readonly annotation: string;
}

// ---------------------------------------------------------------------------
// ParsedContent (Discriminated Union by format)
// ---------------------------------------------------------------------------

export interface JsonParsedContent {
  readonly format: 'json';
  readonly parsedData: Readonly<Record<string, unknown>>;
  readonly keys: readonly string[];
}

export interface MarkdownWithFrontmatterParsedContent {
  readonly format: 'markdown-with-frontmatter';
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly body: string;
  readonly frontmatterFields: readonly FrontmatterField[];
}

export interface MarkdownParsedContent {
  readonly format: 'markdown';
  readonly body: string;
}

export interface UnparseableParsedContent {
  readonly format: 'unparseable';
  readonly error: string;
}

export type ParsedContent =
  | JsonParsedContent
  | MarkdownWithFrontmatterParsedContent
  | MarkdownParsedContent
  | UnparseableParsedContent;

// ---------------------------------------------------------------------------
// ParseError
// ---------------------------------------------------------------------------

export interface ParseError {
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
}

// ---------------------------------------------------------------------------
// ConfigNode
// ---------------------------------------------------------------------------

export interface ConfigNode {
  readonly id: string;
  readonly name: string;
  readonly scope: ScopeName;
  readonly subsystem: SubsystemName;
  readonly nodeType: NodeType;
  readonly filePath: string;
  readonly relativePath: string;
  readonly content: string;
  readonly parsedContent: ParsedContent;
  readonly loadBehavior: LoadBehavior;
  readonly error: ParseError | null;
}

// ---------------------------------------------------------------------------
// Type Guards for ParsedContent
// ---------------------------------------------------------------------------

export const isJsonContent = (content: ParsedContent): content is JsonParsedContent =>
  content.format === 'json';

export const isMarkdownWithFrontmatter = (content: ParsedContent): content is MarkdownWithFrontmatterParsedContent =>
  content.format === 'markdown-with-frontmatter';

export const isMarkdownContent = (content: ParsedContent): content is MarkdownParsedContent =>
  content.format === 'markdown';

export const isUnparseable = (content: ParsedContent): content is UnparseableParsedContent =>
  content.format === 'unparseable';

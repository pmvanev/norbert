/**
 * Markdown content parser -- pure function that parses raw Markdown strings,
 * extracts YAML frontmatter via gray-matter, and annotates frontmatter fields
 * for display.
 *
 * No I/O, no exceptions. Malformed YAML produces an 'unparseable'
 * ParsedContent with an error description.
 *
 * Handles: rules (.md with paths frontmatter), skills (SKILL.md),
 * agents (.md with name/tools/model frontmatter), and plain CLAUDE.md files.
 */

import matter from 'gray-matter';
import type {
  FrontmatterField,
  MarkdownWithFrontmatterParsedContent,
  MarkdownParsedContent,
  UnparseableParsedContent,
  ParsedContent,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Internal helpers -- frontmatter field annotation
// ---------------------------------------------------------------------------

/**
 * Known frontmatter keys and their display label mapping.
 * Keys not in this map use a capitalized version of the key.
 */
const KNOWN_LABELS: Readonly<Record<string, string>> = {
  paths: 'Applies to',
  name: 'Name',
  description: 'Description',
  tools: 'Tools',
  model: 'Model',
  skills: 'Skills',
  hooks: 'Hooks',
  'allowed-tools': 'Allowed tools',
  'argument-hint': 'Argument hint',
  'disable-model-invocation': 'Disable model invocation',
  'user-invocable': 'User invocable',
  context: 'Context',
  agent: 'Agent',
  permissionMode: 'Permission mode',
  maxTurns: 'Max turns',
  memory: 'Memory',
  background: 'Background',
  isolation: 'Isolation',
  'disallowedTools': 'Disallowed tools',
};

const labelForKey = (key: string): string =>
  KNOWN_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);

const formatFieldValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(String).join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return 'configured';
  }
  return String(value);
};

const annotateField = (key: string, value: unknown): FrontmatterField => ({
  key,
  value,
  annotation: `${labelForKey(key)}: ${formatFieldValue(value)}`,
});

// ---------------------------------------------------------------------------
// Internal helpers -- content creation
// ---------------------------------------------------------------------------

const createMarkdownContent = (body: string): MarkdownParsedContent => ({
  format: 'markdown',
  body,
});

const createMarkdownWithFrontmatterContent = (
  frontmatter: Readonly<Record<string, unknown>>,
  body: string,
  frontmatterFields: readonly FrontmatterField[],
): MarkdownWithFrontmatterParsedContent => ({
  format: 'markdown-with-frontmatter',
  frontmatter,
  body,
  frontmatterFields,
});

const createUnparseableContent = (error: string): UnparseableParsedContent => ({
  format: 'unparseable',
  error,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasContent = (data: unknown): data is Record<string, unknown> =>
  isPlainObject(data) && Object.keys(data).length > 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a raw Markdown string, extracting YAML frontmatter if present.
 *
 * Pure function: no I/O, no exceptions thrown.
 *
 * - If YAML frontmatter exists and has fields: returns 'markdown-with-frontmatter'
 *   with parsed data, annotated fields, and the Markdown body.
 * - If no frontmatter or empty frontmatter: returns 'markdown' with body only.
 * - If malformed YAML in frontmatter: returns 'unparseable' with error message.
 *
 * @param raw - Raw file content (expected to be Markdown, possibly with YAML frontmatter)
 * @returns ParsedContent with the appropriate format discriminant
 */
export const parseMarkdown = (raw: string): ParsedContent => {
  // gray-matter can throw on malformed YAML -- catch and return unparseable
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown YAML parse error';
    return createUnparseableContent(`Malformed YAML frontmatter: ${message}`);
  }

  const rawData: unknown = parsed.data;

  // No frontmatter, empty frontmatter, or non-object data -- plain markdown
  if (!hasContent(rawData)) {
    return createMarkdownContent(parsed.content);
  }

  // Build annotated fields from frontmatter keys
  const frontmatterFields = Object.entries(rawData).map(
    ([key, value]) => annotateField(key, value),
  );

  return createMarkdownWithFrontmatterContent(
    rawData,
    parsed.content,
    frontmatterFields,
  );
};

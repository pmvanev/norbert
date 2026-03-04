/**
 * Content parser router -- pure function that dispatches raw file content
 * to the correct parser based on file extension.
 *
 * No I/O, no exceptions. Routes:
 * - .json files to parseJson
 * - .md files to parseMarkdown
 * - Other extensions to unparseable
 *
 * Classification result is accepted for future use (e.g., subsystem-specific
 * parsing hints) but currently the file extension drives routing.
 */

import type { ParsedContent, UnparseableParsedContent } from '../types/index.js';
import type { ClassificationResult } from '../classifier.js';
import { parseJson } from './json-parser.js';
import { parseMarkdown } from './markdown-parser.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const extractExtension = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() ?? '';
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : '';
};

const createUnsupportedContent = (filePath: string): UnparseableParsedContent => ({
  format: 'unparseable',
  error: `Unsupported file type: ${filePath}`,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Routes raw file content to the correct parser based on file extension.
 *
 * Pure function: no I/O, no exceptions thrown.
 *
 * @param raw - Raw file content as string
 * @param filePath - File path (used to determine extension for routing)
 * @param classification - Classification result from classifyFile (for future subsystem hints)
 * @returns ParsedContent from the appropriate parser
 */
export const parseContent = (
  raw: string,
  filePath: string,
  classification: ClassificationResult,
): ParsedContent => {
  const extension = extractExtension(filePath);

  switch (extension) {
    case '.json':
      return parseJson(raw);
    case '.md':
      return parseMarkdown(raw);
    default:
      return createUnsupportedContent(filePath);
  }
};

/**
 * File classifier -- pure function that maps a file path to its
 * subsystem, scope, node type, and load behavior.
 *
 * No I/O. Takes a relative path and a scope context, returns
 * a classification result. The classifier uses pattern matching
 * on path segments to determine which subsystem owns a file.
 */

import type { ScopeName, SubsystemName, NodeType, LoadBehavior } from './types/index.js';

// ---------------------------------------------------------------------------
// Classification Result
// ---------------------------------------------------------------------------

export interface ClassificationResult {
  readonly subsystem: SubsystemName;
  readonly scope: ScopeName;
  readonly nodeType: NodeType;
  readonly loadBehavior: LoadBehavior;
}

// ---------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------

const normalizePath = (filePath: string): string =>
  filePath.replace(/\\/g, '/');

const stripDotClaudePrefix = (normalized: string): string =>
  normalized.startsWith('.claude/')
    ? normalized.slice('.claude/'.length)
    : normalized;

// ---------------------------------------------------------------------------
// Local scope detection
// ---------------------------------------------------------------------------

const isLocalFile = (normalized: string): boolean =>
  /\.local\./i.test(normalized);

// ---------------------------------------------------------------------------
// Subsystem classifiers -- each returns a result or null
// ---------------------------------------------------------------------------

const classifyMemory = (
  stripped: string,
  normalized: string,
  scopeContext: ScopeName,
): ClassificationResult | null => {
  const filename = stripped.split('/').pop() ?? '';

  if (filename === 'CLAUDE.md' || filename === 'CLAUDE.local.md') {
    const isLocal = filename === 'CLAUDE.local.md';
    const isSubdirectory = stripped.includes('/') && stripped !== 'CLAUDE.md' && !normalized.startsWith('.claude/');
    const isMemoryDir = stripped.startsWith('memory/') || normalized.includes('/memory/');

    return {
      subsystem: 'memory',
      scope: isLocal ? 'local' : scopeContext,
      nodeType: 'memory',
      loadBehavior: isSubdirectory && !isMemoryDir ? 'on-demand' : 'always',
    };
  }

  if (filename === 'MEMORY.md') {
    return {
      subsystem: 'memory',
      scope: scopeContext,
      nodeType: 'memory',
      loadBehavior: 'always',
    };
  }

  return null;
};

const classifySettings = (
  stripped: string,
  _normalized: string,
  scopeContext: ScopeName,
): ClassificationResult | null => {
  const filename = stripped.split('/').pop() ?? '';

  if (filename === 'settings.json' || filename === 'settings.local.json') {
    const isLocal = filename === 'settings.local.json';
    return {
      subsystem: 'settings',
      scope: isLocal ? 'local' : scopeContext,
      nodeType: 'settings',
      loadBehavior: 'always',
    };
  }

  return null;
};

const classifyRules = (
  stripped: string,
  _normalized: string,
  scopeContext: ScopeName,
): ClassificationResult | null => {
  if (stripped.startsWith('rules/') && stripped.endsWith('.md')) {
    return {
      subsystem: 'rules',
      scope: scopeContext,
      nodeType: 'rule',
      loadBehavior: 'always',
    };
  }

  return null;
};

const classifySkills = (
  stripped: string,
  _normalized: string,
  scopeContext: ScopeName,
): ClassificationResult | null => {
  if (/^skills\/[^/]+\/SKILL\.md$/.test(stripped)) {
    return {
      subsystem: 'skills',
      scope: scopeContext,
      nodeType: 'skill',
      loadBehavior: 'on-demand',
    };
  }

  return null;
};

const classifyAgents = (
  stripped: string,
  _normalized: string,
  scopeContext: ScopeName,
): ClassificationResult | null => {
  if (/^agents\/[^/]+\.md$/.test(stripped)) {
    return {
      subsystem: 'agents',
      scope: scopeContext,
      nodeType: 'agent',
      loadBehavior: 'always',
    };
  }

  return null;
};

const classifyHooks = (
  stripped: string,
  _normalized: string,
  scopeContext: ScopeName,
): ClassificationResult | null => {
  const filename = stripped.split('/').pop() ?? '';

  if (filename === 'hooks.json') {
    return {
      subsystem: 'hooks',
      scope: scopeContext,
      nodeType: 'hook',
      loadBehavior: 'always',
    };
  }

  return null;
};

const classifyPlugins = (
  stripped: string,
  normalized: string,
  scopeContext: ScopeName,
): ClassificationResult | null => {
  if (
    normalized.includes('.claude-plugin/plugin.json') ||
    stripped === '.claude-plugin/plugin.json'
  ) {
    return {
      subsystem: 'plugins',
      scope: scopeContext,
      nodeType: 'plugin',
      loadBehavior: 'always',
    };
  }

  return null;
};

const classifyMcp = (
  stripped: string,
  normalized: string,
  scopeContext: ScopeName,
): ClassificationResult | null => {
  const filename = stripped.split('/').pop() ?? '';

  if (filename === '.mcp.json' || normalized.endsWith('.mcp.json')) {
    return {
      subsystem: 'mcp',
      scope: scopeContext,
      nodeType: 'mcp',
      loadBehavior: 'always',
    };
  }

  if (filename === '.claude.json') {
    return {
      subsystem: 'mcp',
      scope: scopeContext,
      nodeType: 'mcp',
      loadBehavior: 'always',
    };
  }

  return null;
};

// ---------------------------------------------------------------------------
// Classification pipeline
// ---------------------------------------------------------------------------

const classifiers = [
  classifyMemory,
  classifySettings,
  classifyRules,
  classifySkills,
  classifyAgents,
  classifyHooks,
  classifyPlugins,
  classifyMcp,
] as const;

const defaultClassification = (scopeContext: ScopeName): ClassificationResult => ({
  subsystem: 'memory',
  scope: scopeContext,
  nodeType: 'memory',
  loadBehavior: 'always',
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classifies a file path into its subsystem, scope, node type, and load behavior.
 *
 * Pure function: no I/O, no side effects.
 *
 * @param filePath - Path relative to scope root (e.g., "CLAUDE.md", "rules/naming.md",
 *                   ".claude/settings.json"). Forward slashes expected.
 * @param scopeContext - The scope where this file was discovered (user, project, plugin, etc.).
 *                       May be overridden to 'local' if the filename contains '.local.'.
 */
export const classifyFile = (
  filePath: string,
  scopeContext: ScopeName,
): ClassificationResult => {
  const normalized = normalizePath(filePath);
  const stripped = stripDotClaudePrefix(normalized);

  for (const classify of classifiers) {
    const result = classify(stripped, normalized, scopeContext);
    if (result !== null) {
      return result;
    }
  }

  return defaultClassification(scopeContext);
};

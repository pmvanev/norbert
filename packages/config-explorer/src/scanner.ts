/**
 * Scanner -- pure function defining what paths to check for each config scope.
 *
 * No I/O, no Node.js imports. Given a scope name, base path, and platform,
 * returns an array of path entries describing files and directories the
 * adapter should scan. The adapter (in the server package) handles the
 * actual filesystem reads and path resolution.
 *
 * Platform is always explicitly provided (no process.platform default)
 * to keep this module pure and free of Node.js globals.
 */

import type { ScopeName } from './types/index.js';

// ---------------------------------------------------------------------------
// Scan path entry
// ---------------------------------------------------------------------------

export interface ScanPathEntry {
  /** Path relative to the scope base (e.g., "settings.json", "rules/") */
  readonly relativePath: string;
  /** Absolute path resolved from base (e.g., "/home/user/.claude/settings.json") */
  readonly absolutePath: string;
  /** Whether this entry is a directory that should be recursively scanned */
  readonly isDirectory: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers -- path joining without Node.js path module
// ---------------------------------------------------------------------------

/**
 * Joins base path and relative path with forward slash separator.
 * Handles trailing slashes on basePath and leading ../ on relativePath.
 */
const joinPaths = (basePath: string, relativePath: string): string => {
  if (relativePath === '') {
    return basePath;
  }
  const normalizedBase = basePath.endsWith('/')
    ? basePath.slice(0, -1)
    : basePath;
  return `${normalizedBase}/${relativePath}`;
};

const createEntry = (
  basePath: string,
  relativePath: string,
  isDirectory: boolean,
): ScanPathEntry => ({
  relativePath,
  absolutePath: joinPaths(basePath, relativePath),
  isDirectory,
});

// ---------------------------------------------------------------------------
// Per-scope path definitions
// ---------------------------------------------------------------------------

const getUserScanPaths = (basePath: string): readonly ScanPathEntry[] => [
  createEntry(basePath, 'settings.json', false),
  createEntry(basePath, 'settings.local.json', false),
  createEntry(basePath, 'CLAUDE.md', false),
  createEntry(basePath, 'rules/', true),
  createEntry(basePath, 'skills/', true),
  createEntry(basePath, 'agents/', true),
  createEntry(basePath, 'plugins/', true),
  // MCP config is at ~/.claude.json (outside the .claude dir)
  createEntry(basePath, '../.claude.json', false),
];

const getProjectScanPaths = (basePath: string): readonly ScanPathEntry[] => [
  createEntry(basePath, 'settings.json', false),
  createEntry(basePath, 'rules/', true),
  createEntry(basePath, 'skills/', true),
  createEntry(basePath, 'agents/', true),
  createEntry(basePath, 'commands/', true),
  createEntry(basePath, 'hooks/', true),
  // Root-level files (at project root, one directory up from .claude/)
  createEntry(basePath, '../CLAUDE.md', false),
  createEntry(basePath, '../.mcp.json', false),
];

const getLocalScanPaths = (basePath: string): readonly ScanPathEntry[] => [
  createEntry(basePath, 'settings.local.json', false),
  createEntry(basePath, '../CLAUDE.local.md', false),
];

const getPluginScanPaths = (basePath: string): readonly ScanPathEntry[] => [
  // Plugin cache root: scan for installed plugin directories
  createEntry(basePath, '', true),
];

const getManagedScanPaths = (platform: string): readonly ScanPathEntry[] => {
  switch (platform) {
    case 'darwin':
      return [
        {
          relativePath: 'managed-settings.json',
          absolutePath: '/Library/Application Support/ClaudeCode/managed-settings.json',
          isDirectory: false,
        },
        {
          relativePath: 'CLAUDE.md',
          absolutePath: '/Library/Application Support/ClaudeCode/CLAUDE.md',
          isDirectory: false,
        },
        {
          relativePath: 'managed-mcp.json',
          absolutePath: '/Library/Application Support/ClaudeCode/managed-mcp.json',
          isDirectory: false,
        },
      ];
    case 'linux':
      return [
        {
          relativePath: 'managed-settings.json',
          absolutePath: '/etc/claude-code/managed-settings.json',
          isDirectory: false,
        },
        {
          relativePath: 'CLAUDE.md',
          absolutePath: '/etc/claude-code/CLAUDE.md',
          isDirectory: false,
        },
        {
          relativePath: 'managed-mcp.json',
          absolutePath: '/etc/claude-code/managed-mcp.json',
          isDirectory: false,
        },
      ];
    case 'win32':
    default:
      return [
        {
          relativePath: 'managed-settings.json',
          absolutePath: 'C:\\Program Files\\ClaudeCode\\managed-settings.json',
          isDirectory: false,
        },
        {
          relativePath: 'CLAUDE.md',
          absolutePath: 'C:\\Program Files\\ClaudeCode\\CLAUDE.md',
          isDirectory: false,
        },
        {
          relativePath: 'managed-mcp.json',
          absolutePath: 'C:\\Program Files\\ClaudeCode\\managed-mcp.json',
          isDirectory: false,
        },
      ];
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the array of paths to check for a given scope.
 *
 * Pure function: no I/O, no Node.js imports, no side effects.
 * Platform must be explicitly provided for managed scope path resolution.
 *
 * @param scope - Which config scope to generate paths for
 * @param basePath - The base directory for this scope (e.g., ~/.claude for user)
 * @param platform - The OS platform (defaults to 'linux' when not specified)
 * @returns Array of ScanPathEntry values describing what to scan
 */
export const getScanPaths = (
  scope: ScopeName,
  basePath: string,
  platform: string = 'linux',
): readonly ScanPathEntry[] => {
  switch (scope) {
    case 'user':
      return getUserScanPaths(basePath);
    case 'project':
      return getProjectScanPaths(basePath);
    case 'local':
      return getLocalScanPaths(basePath);
    case 'plugin':
      return getPluginScanPaths(basePath);
    case 'managed':
      return getManagedScanPaths(platform);
  }
};

/**
 * Filesystem adapter for ConfigFileReaderPort.
 *
 * Reads configuration files from the local filesystem using Node.js fs/promises.
 * Resolves paths cross-platform: ~/.claude/ for user scope, .claude/ for project scope.
 *
 * This is the ONLY component that touches the filesystem for config reading.
 * Returns null for missing files and empty arrays for missing directories --
 * no exceptions escape.
 */

import * as fs from 'fs/promises';
import * as pathModule from 'path';
import * as os from 'os';
import type { ConfigFileReaderPort, ScannedFileEntry, ScopeName } from '@norbert/config-explorer';
import { getScanPaths } from '@norbert/config-explorer';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const resolveConfigPath = (scopedPath: string, projectRoot: string): string => {
  // Scope-keyed paths: "user:settings.json" or "project:settings.json"
  if (scopedPath.startsWith('user:')) {
    const relativePath = scopedPath.slice('user:'.length);
    return pathModule.join(os.homedir(), '.claude', relativePath);
  }

  if (scopedPath.startsWith('project:')) {
    const relativePath = scopedPath.slice('project:'.length);
    return pathModule.join(projectRoot, '.claude', relativePath);
  }

  // Unscoped paths returned as-is
  return scopedPath;
};

// ---------------------------------------------------------------------------
// Internal helpers -- recursive directory scanning
// ---------------------------------------------------------------------------

/**
 * Recursively reads all files in a directory, returning their relative paths
 * and contents. Handles permission errors gracefully (skips unreadable entries).
 */
const readDirectoryRecursively = async (
  dirPath: string,
  basePath: string,
): Promise<readonly ScannedFileEntry[]> => {
  const results: ScannedFileEntry[] = [];

  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    // Directory doesn't exist or is inaccessible -- return empty
    return [];
  }

  for (const entry of entries) {
    const entryPath = pathModule.join(dirPath, entry.name);
    const relativePath = pathModule.relative(basePath, entryPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      const subEntries = await readDirectoryRecursively(entryPath, basePath);
      results.push(...subEntries);
    } else if (entry.isFile()) {
      try {
        const content = await fs.readFile(entryPath, 'utf-8');
        results.push({
          relativePath,
          absolutePath: entryPath,
          content,
        });
      } catch {
        // File unreadable (permission denied) -- skip silently
      }
    }
  }

  return results;
};

/**
 * Reads a single file if it exists, returning it as a ScannedFileEntry.
 */
const readSingleFile = async (
  absolutePath: string,
  relativePath: string,
): Promise<ScannedFileEntry | null> => {
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return { relativePath, absolutePath, content };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

/**
 * Creates a ConfigFileReaderPort backed by real filesystem I/O.
 *
 * @param projectRoot - The project root directory (typically process.cwd())
 * @returns ConfigFileReaderPort implementation
 */
export const createConfigFileReader = (
  projectRoot: string = process.cwd(),
): ConfigFileReaderPort => ({
  readFile: async (scopedPath: string): Promise<string | null> => {
    const resolvedPath = resolveConfigPath(scopedPath, projectRoot);
    try {
      return await fs.readFile(resolvedPath, 'utf-8');
    } catch {
      return null;
    }
  },

  listDirectory: async (scopedPath: string): Promise<readonly string[]> => {
    const resolvedPath = resolveConfigPath(scopedPath, projectRoot);
    try {
      const entries = await fs.readdir(resolvedPath);
      return entries;
    } catch {
      return [];
    }
  },

  fileExists: async (scopedPath: string): Promise<boolean> => {
    const resolvedPath = resolveConfigPath(scopedPath, projectRoot);
    try {
      await fs.access(resolvedPath);
      return true;
    } catch {
      return false;
    }
  },

  scanScope: async (basePath: string, scope: ScopeName): Promise<readonly ScannedFileEntry[]> => {
    const scanPaths = getScanPaths(scope, basePath, process.platform);
    const results: ScannedFileEntry[] = [];

    for (const scanEntry of scanPaths) {
      if (scanEntry.isDirectory) {
        const dirPath = scanEntry.absolutePath;
        const subEntries = await readDirectoryRecursively(dirPath, basePath);
        results.push(...subEntries);
      } else {
        const entry = await readSingleFile(
          scanEntry.absolutePath,
          scanEntry.relativePath,
        );
        if (entry !== null) {
          results.push(entry);
        }
      }
    }

    return results;
  },
});

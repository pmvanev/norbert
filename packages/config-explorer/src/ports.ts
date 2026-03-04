/**
 * ConfigFileReaderPort -- function-signature port for filesystem access.
 *
 * This is a TYPE definition only. The implementation (adapter) lives
 * in the server package. The config-explorer package uses this port
 * to declare what filesystem capabilities it needs, without importing
 * any I/O modules.
 *
 * Consumers accept ConfigFileReaderPort as a parameter (dependency
 * injection via function arguments). Tests provide pure stubs.
 */

import type { ScopeName } from './types/scope.js';

// ---------------------------------------------------------------------------
// Port type
// ---------------------------------------------------------------------------

/**
 * Port for reading configuration files from the filesystem.
 *
 * All operations are async because the adapter may perform I/O.
 * The port uses null to signal "not found" (no exceptions for
 * missing files).
 */
export interface ConfigFileReaderPort {
  /** Read file content as string. Returns null if file does not exist. */
  readonly readFile: (path: string) => Promise<string | null>;

  /** List entries in a directory. Returns empty array if directory does not exist. */
  readonly listDirectory: (path: string) => Promise<readonly string[]>;

  /** Check whether a file or directory exists. */
  readonly fileExists: (path: string) => Promise<boolean>;

  /**
   * Scan a scope base directory and discover all configuration files.
   *
   * Returns an array of discovered file entries with their relative path,
   * absolute path, and content. Handles missing directories and permission
   * errors gracefully (returns empty array or skips inaccessible files).
   *
   * @param basePath - The base directory for the scope (e.g., ~/.claude)
   * @param scope - Which scope is being scanned
   * @returns Array of discovered file entries
   */
  readonly scanScope: (basePath: string, scope: ScopeName) => Promise<readonly ScannedFileEntry[]>;
}

// ---------------------------------------------------------------------------
// Scanned file entry (returned by adapter)
// ---------------------------------------------------------------------------

export interface ScannedFileEntry {
  /** Path relative to the scope root */
  readonly relativePath: string;
  /** Absolute path on disk */
  readonly absolutePath: string;
  /** Raw file content */
  readonly content: string;
}

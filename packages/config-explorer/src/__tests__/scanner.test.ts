/**
 * Scanner tests for @norbert/config-explorer.
 *
 * Verifies the pure getScanPaths function generates correct filesystem paths
 * for each scope and platform combination. Uses example-based tests for
 * known path expectations and property-based tests for invariants.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getScanPaths } from '../scanner.js';
import type { ScopeName } from '../types/index.js';
import type { ScanPathEntry } from '../scanner.js';

// ---------------------------------------------------------------------------
// User scope paths -- exact entries
// ---------------------------------------------------------------------------

describe('getScanPaths - user scope', () => {
  const userBase = '/home/testuser/.claude';

  it('returns all expected user scope entries with exact paths and isDirectory flags', () => {
    const paths = getScanPaths('user', userBase);

    // Verify exact count
    expect(paths).toHaveLength(8);

    // Verify each entry exactly
    expect(paths).toEqual([
      { relativePath: 'settings.json', absolutePath: '/home/testuser/.claude/settings.json', isDirectory: false },
      { relativePath: 'settings.local.json', absolutePath: '/home/testuser/.claude/settings.local.json', isDirectory: false },
      { relativePath: 'CLAUDE.md', absolutePath: '/home/testuser/.claude/CLAUDE.md', isDirectory: false },
      { relativePath: 'rules/', absolutePath: '/home/testuser/.claude/rules/', isDirectory: true },
      { relativePath: 'skills/', absolutePath: '/home/testuser/.claude/skills/', isDirectory: true },
      { relativePath: 'agents/', absolutePath: '/home/testuser/.claude/agents/', isDirectory: true },
      { relativePath: 'plugins/', absolutePath: '/home/testuser/.claude/plugins/', isDirectory: true },
      { relativePath: '../.claude.json', absolutePath: '/home/testuser/.claude/../.claude.json', isDirectory: false },
    ]);
  });

  it('files have isDirectory false and directories have isDirectory true', () => {
    const paths = getScanPaths('user', userBase);
    const fileEntries = paths.filter(p => !p.relativePath.endsWith('/') && !p.relativePath.endsWith('.json') === false);
    const dirEntries = paths.filter(p => p.relativePath.endsWith('/'));

    for (const dir of dirEntries) {
      expect(dir.isDirectory).toBe(true);
    }
    // settings.json, settings.local.json, CLAUDE.md, ../.claude.json are files
    expect(paths.find(p => p.relativePath === 'settings.json')!.isDirectory).toBe(false);
    expect(paths.find(p => p.relativePath === 'settings.local.json')!.isDirectory).toBe(false);
    expect(paths.find(p => p.relativePath === 'CLAUDE.md')!.isDirectory).toBe(false);
    expect(paths.find(p => p.relativePath === '../.claude.json')!.isDirectory).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Project scope paths -- exact entries
// ---------------------------------------------------------------------------

describe('getScanPaths - project scope', () => {
  const projectBase = '/project/.claude';

  it('returns all expected project scope entries with exact paths and isDirectory flags', () => {
    const paths = getScanPaths('project', projectBase);

    expect(paths).toHaveLength(8);
    expect(paths).toEqual([
      { relativePath: 'settings.json', absolutePath: '/project/.claude/settings.json', isDirectory: false },
      { relativePath: 'rules/', absolutePath: '/project/.claude/rules/', isDirectory: true },
      { relativePath: 'skills/', absolutePath: '/project/.claude/skills/', isDirectory: true },
      { relativePath: 'agents/', absolutePath: '/project/.claude/agents/', isDirectory: true },
      { relativePath: 'commands/', absolutePath: '/project/.claude/commands/', isDirectory: true },
      { relativePath: 'hooks/', absolutePath: '/project/.claude/hooks/', isDirectory: true },
      { relativePath: '../CLAUDE.md', absolutePath: '/project/.claude/../CLAUDE.md', isDirectory: false },
      { relativePath: '../.mcp.json', absolutePath: '/project/.claude/../.mcp.json', isDirectory: false },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Local scope paths -- exact entries
// ---------------------------------------------------------------------------

describe('getScanPaths - local scope', () => {
  const localBase = '/project/.claude';

  it('returns exact local scope entries', () => {
    const paths = getScanPaths('local', localBase);

    expect(paths).toHaveLength(2);
    expect(paths).toEqual([
      { relativePath: 'settings.local.json', absolutePath: '/project/.claude/settings.local.json', isDirectory: false },
      { relativePath: '../CLAUDE.local.md', absolutePath: '/project/.claude/../CLAUDE.local.md', isDirectory: false },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Plugin scope paths -- exact entries
// ---------------------------------------------------------------------------

describe('getScanPaths - plugin scope', () => {
  const pluginBase = '/home/testuser/.claude/plugins/cache';

  it('returns plugin cache directory as a single directory entry', () => {
    const paths = getScanPaths('plugin', pluginBase);

    expect(paths).toHaveLength(1);
    expect(paths[0]).toEqual({
      relativePath: '',
      absolutePath: '/home/testuser/.claude/plugins/cache',
      isDirectory: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Managed scope paths -- platform-specific exact entries
// ---------------------------------------------------------------------------

describe('getScanPaths - managed scope', () => {
  it('returns exact darwin managed entries with correct absolutePaths and isDirectory=false', () => {
    const paths = getScanPaths('managed', '', 'darwin');

    expect(paths).toHaveLength(3);
    expect(paths).toEqual([
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
    ]);
  });

  it('returns exact linux managed entries with correct absolutePaths and isDirectory=false', () => {
    const paths = getScanPaths('managed', '', 'linux');

    expect(paths).toHaveLength(3);
    expect(paths).toEqual([
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
    ]);
  });

  it('returns exact win32 managed entries with correct absolutePaths and isDirectory=false', () => {
    const paths = getScanPaths('managed', '', 'win32');

    expect(paths).toHaveLength(3);
    expect(paths).toEqual([
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
    ]);
  });

  it('defaults to win32 paths for unknown platform', () => {
    const paths = getScanPaths('managed', '', 'freebsd');

    // Unknown platform hits the default case which is win32
    expect(paths).toEqual(getScanPaths('managed', '', 'win32'));
  });

  it('managed entries include managed-mcp.json for each platform', () => {
    for (const platform of ['darwin', 'linux', 'win32']) {
      const paths = getScanPaths('managed', '', platform);
      const mcpEntry = paths.find(p => p.relativePath === 'managed-mcp.json');
      expect(mcpEntry).toBeDefined();
      expect(mcpEntry!.isDirectory).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// joinPaths behavior tested through getScanPaths
// ---------------------------------------------------------------------------

describe('getScanPaths - path joining behavior', () => {
  it('strips trailing slash from base path before joining', () => {
    const pathsWithSlash = getScanPaths('user', '/home/user/.claude/');
    const pathsWithoutSlash = getScanPaths('user', '/home/user/.claude');

    // Both should produce the same absolute paths
    expect(pathsWithSlash.map(p => p.absolutePath)).toEqual(
      pathsWithoutSlash.map(p => p.absolutePath),
    );
  });

  it('produces correct absolute path when base path has trailing slash', () => {
    const paths = getScanPaths('user', '/base/');
    const settingsEntry = paths.find(p => p.relativePath === 'settings.json');
    expect(settingsEntry!.absolutePath).toBe('/base/settings.json');
  });

  it('produces correct absolute path when base path has no trailing slash', () => {
    const paths = getScanPaths('user', '/base');
    const settingsEntry = paths.find(p => p.relativePath === 'settings.json');
    expect(settingsEntry!.absolutePath).toBe('/base/settings.json');
  });

  it('plugin scope with empty relativePath returns the basePath as absolutePath', () => {
    const paths = getScanPaths('plugin', '/some/path');
    expect(paths[0].absolutePath).toBe('/some/path');
    expect(paths[0].relativePath).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Default platform parameter
// ---------------------------------------------------------------------------

describe('getScanPaths - default platform', () => {
  it('defaults to linux when platform is not provided for managed scope', () => {
    const pathsDefault = getScanPaths('managed', '');
    const pathsLinux = getScanPaths('managed', '', 'linux');

    expect(pathsDefault).toEqual(pathsLinux);
  });

  it('platform parameter does not affect non-managed scopes', () => {
    const base = '/home/user/.claude';
    const pathsDarwin = getScanPaths('user', base, 'darwin');
    const pathsLinux = getScanPaths('user', base, 'linux');

    expect(pathsDarwin).toEqual(pathsLinux);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('getScanPaths - properties', () => {
  const validScopes: ScopeName[] = ['managed', 'user', 'project', 'local', 'plugin'];
  const scopeArb = fc.constantFrom(...validScopes);
  const basePathArb = fc.string({ minLength: 1, maxLength: 100 });

  it('always returns a non-empty array for any scope', () => {
    fc.assert(
      fc.property(scopeArb, basePathArb, (scope, basePath) => {
        const paths = getScanPaths(scope, basePath);
        expect(paths.length).toBeGreaterThan(0);
      }),
    );
  });

  it('every entry has a relativePath string', () => {
    fc.assert(
      fc.property(scopeArb, basePathArb, (scope, basePath) => {
        const paths = getScanPaths(scope, basePath);
        for (const entry of paths) {
          expect(typeof entry.relativePath).toBe('string');
        }
      }),
    );
  });

  it('every entry has an absolutePath string', () => {
    fc.assert(
      fc.property(scopeArb, basePathArb, (scope, basePath) => {
        const paths = getScanPaths(scope, basePath);
        for (const entry of paths) {
          expect(typeof entry.absolutePath).toBe('string');
        }
      }),
    );
  });

  it('every entry has an isDirectory boolean', () => {
    fc.assert(
      fc.property(scopeArb, basePathArb, (scope, basePath) => {
        const paths = getScanPaths(scope, basePath);
        for (const entry of paths) {
          expect(typeof entry.isDirectory).toBe('boolean');
        }
      }),
    );
  });

  it('non-managed scope absolutePaths contain the basePath', () => {
    const nonManagedScopes: ScopeName[] = ['user', 'project', 'local', 'plugin'];
    const nonManagedScopeArb = fc.constantFrom(...nonManagedScopes);

    fc.assert(
      fc.property(nonManagedScopeArb, (scope) => {
        const base = '/test/base/path';
        const paths = getScanPaths(scope, base);
        for (const entry of paths) {
          expect(entry.absolutePath).toContain('/test/base');
        }
      }),
    );
  });

  it('directory entries always have relativePath ending in slash or empty string', () => {
    fc.assert(
      fc.property(scopeArb, (scope) => {
        const paths = getScanPaths(scope, '/base');
        for (const entry of paths) {
          if (entry.isDirectory) {
            expect(entry.relativePath === '' || entry.relativePath.endsWith('/')).toBe(true);
          }
        }
      }),
    );
  });
});

/**
 * Tests for buildFileTree -- pure function that transforms flat ConfigNode[]
 * into nested FileTree structures grouped by scope.
 *
 * Uses example-based tests for known tree shapes and property-based tests
 * for structural invariants.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildFileTrees } from '../file-tree-builder.js';
import type { ConfigNode, ScopeName, FileTree } from '../types/index.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const createNode = (
  overrides: Partial<ConfigNode> & { filePath: string; scope: ScopeName },
): ConfigNode => ({
  id: `${overrides.scope}:${overrides.filePath}`,
  name: overrides.filePath.split('/').pop() ?? overrides.filePath,
  scope: overrides.scope,
  subsystem: overrides.subsystem ?? 'settings',
  nodeType: overrides.nodeType ?? 'settings',
  filePath: overrides.filePath,
  relativePath: overrides.filePath,
  content: overrides.content ?? '{}',
  parsedContent: overrides.parsedContent ?? { format: 'json', parsedData: {}, keys: [] },
  loadBehavior: overrides.loadBehavior ?? 'always',
  error: overrides.error ?? null,
});

// ---------------------------------------------------------------------------
// Flat list to tree structure
// ---------------------------------------------------------------------------

describe('buildFileTrees - tree structure', () => {
  it('groups nodes by scope into separate root trees', () => {
    const nodes = [
      createNode({ filePath: 'settings.json', scope: 'user' }),
      createNode({ filePath: 'settings.json', scope: 'project' }),
    ];

    const trees = buildFileTrees(nodes);

    expect(trees.user).toBeDefined();
    expect(trees.project).toBeDefined();
    expect(trees.user!.scope).toBe('user');
    expect(trees.project!.scope).toBe('project');
  });

  it('builds nested directory structure from file paths', () => {
    const nodes = [
      createNode({ filePath: 'rules/coding.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
      createNode({ filePath: 'rules/naming.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
    ];

    const trees = buildFileTrees(nodes);
    const projectTree = trees.project!;

    // Root should have one child directory "rules"
    const rulesDir = projectTree.children.find(c => c.name === 'rules');
    expect(rulesDir).toBeDefined();
    expect(rulesDir!.type).toBe('directory');

    // "rules" directory should contain two files
    expect(rulesDir!.children).toHaveLength(2);
    expect(rulesDir!.children.every(c => c.type === 'file')).toBe(true);
  });

  it('attaches ConfigNode to file entries', () => {
    const node = createNode({ filePath: 'settings.json', scope: 'user' });
    const trees = buildFileTrees([node]);

    const fileEntry = trees.user!.children.find(c => c.name === 'settings.json');
    expect(fileEntry).toBeDefined();
    expect(fileEntry!.node).toBe(node);
    expect(fileEntry!.type).toBe('file');
  });

  it('directories have null node', () => {
    const nodes = [
      createNode({ filePath: 'rules/coding.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
    ];

    const trees = buildFileTrees(nodes);
    const rulesDir = trees.project!.children.find(c => c.name === 'rules');
    expect(rulesDir!.node).toBeNull();
  });

  it('handles deeply nested paths', () => {
    const nodes = [
      createNode({ filePath: 'skills/deploy/SKILL.md', scope: 'user', subsystem: 'skills', nodeType: 'skill' }),
    ];

    const trees = buildFileTrees(nodes);
    const userTree = trees.user!;

    const skillsDir = userTree.children.find(c => c.name === 'skills');
    expect(skillsDir).toBeDefined();
    expect(skillsDir!.type).toBe('directory');

    const deployDir = skillsDir!.children.find(c => c.name === 'deploy');
    expect(deployDir).toBeDefined();
    expect(deployDir!.type).toBe('directory');

    const skillFile = deployDir!.children.find(c => c.name === 'SKILL.md');
    expect(skillFile).toBeDefined();
    expect(skillFile!.type).toBe('file');
  });
});

// ---------------------------------------------------------------------------
// Sort order verification
// ---------------------------------------------------------------------------

describe('buildFileTrees - sort order', () => {
  it('sorts children: directories first, then files, then missing -- alphabetical within group', () => {
    const nodes = [
      createNode({ filePath: 'z-file.json', scope: 'project' }),
      createNode({ filePath: 'a-file.json', scope: 'project' }),
      createNode({ filePath: 'rules/coding.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
      createNode({ filePath: 'skills/deploy/SKILL.md', scope: 'project', subsystem: 'skills', nodeType: 'skill' }),
    ];

    const trees = buildFileTrees(nodes);
    const projectTree = trees.project!;
    const childNames = projectTree.children.map(c => c.name);
    const childTypes = projectTree.children.map(c => c.type);

    // directories come first (rules, skills), then files (a-file.json, z-file.json), then missing (agents)
    const dirCount = childTypes.filter(t => t === 'directory').length;
    const fileCount = childTypes.filter(t => t === 'file').length;
    const missingCount = childTypes.filter(t => t === 'missing').length;

    expect(dirCount).toBe(2); // rules, skills
    expect(fileCount).toBe(2); // a-file.json, z-file.json
    expect(missingCount).toBe(1); // agents (rules and skills exist, so only agents is missing)

    // Verify ordering: all directories before all files before all missing
    const lastDirIndex = childTypes.lastIndexOf('directory');
    const firstFileIndex = childTypes.indexOf('file');
    const lastFileIndex = childTypes.lastIndexOf('file');
    const firstMissingIndex = childTypes.indexOf('missing');

    expect(lastDirIndex).toBeLessThan(firstFileIndex);
    expect(lastFileIndex).toBeLessThan(firstMissingIndex);

    // Alphabetical within groups
    const dirs = projectTree.children.filter(c => c.type === 'directory').map(c => c.name);
    expect(dirs).toEqual([...dirs].sort());

    const files = projectTree.children.filter(c => c.type === 'file').map(c => c.name);
    expect(files).toEqual([...files].sort());
  });

  it('freezeTree recursively sorts children at every level', () => {
    const nodes = [
      createNode({ filePath: 'rules/z-rule.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
      createNode({ filePath: 'rules/a-rule.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
      createNode({ filePath: 'rules/subdir/nested.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
    ];

    const trees = buildFileTrees(nodes);
    const rulesDir = trees.project!.children.find(c => c.name === 'rules')!;

    // Inside rules, subdir (directory) should come before a-rule.md and z-rule.md (files)
    expect(rulesDir.children[0].type).toBe('directory');
    expect(rulesDir.children[0].name).toBe('subdir');
    expect(rulesDir.children[1].type).toBe('file');
    expect(rulesDir.children[1].name).toBe('a-rule.md');
    expect(rulesDir.children[2].type).toBe('file');
    expect(rulesDir.children[2].name).toBe('z-rule.md');
  });
});

// ---------------------------------------------------------------------------
// Missing directory indicators
// ---------------------------------------------------------------------------

describe('buildFileTrees - missing directories', () => {
  it('includes exactly 3 missing directory placeholders for rules, agents, skills when none exist', () => {
    const nodes = [
      createNode({ filePath: 'settings.json', scope: 'user' }),
    ];

    const trees = buildFileTrees(nodes);
    const userTree = trees.user!;

    const missingDirs = userTree.children.filter(c => c.type === 'missing');
    expect(missingDirs).toHaveLength(3);

    const missingNames = missingDirs.map(d => d.name).sort();
    expect(missingNames).toEqual(['agents', 'rules', 'skills']);
  });

  it('missing directories have exact tooltip values', () => {
    const nodes = [
      createNode({ filePath: 'settings.json', scope: 'user' }),
    ];

    const trees = buildFileTrees(nodes);
    const userTree = trees.user!;

    const missingDirs = userTree.children.filter(c => c.type === 'missing');
    const tooltipsByName: Record<string, string | null> = {};
    for (const dir of missingDirs) {
      tooltipsByName[dir.name] = dir.tooltip;
    }

    expect(tooltipsByName['rules']).toBe('No rules configured');
    expect(tooltipsByName['agents']).toBe('No agents configured');
    expect(tooltipsByName['skills']).toBe('No skills configured');
  });

  it('missing directories have correct subsystem values', () => {
    const nodes = [
      createNode({ filePath: 'settings.json', scope: 'user' }),
    ];

    const trees = buildFileTrees(nodes);
    const userTree = trees.user!;

    const missingDirs = userTree.children.filter(c => c.type === 'missing');
    const subsystemsByName: Record<string, string | null> = {};
    for (const dir of missingDirs) {
      subsystemsByName[dir.name] = dir.subsystem;
    }

    expect(subsystemsByName['rules']).toBe('rules');
    expect(subsystemsByName['agents']).toBe('agents');
    expect(subsystemsByName['skills']).toBe('skills');
  });

  it('missing directories have type "missing", null node, and empty children', () => {
    const nodes = [
      createNode({ filePath: 'settings.json', scope: 'user' }),
    ];

    const trees = buildFileTrees(nodes);
    const missingDirs = trees.user!.children.filter(c => c.type === 'missing');

    for (const dir of missingDirs) {
      expect(dir.type).toBe('missing');
      expect(dir.node).toBeNull();
      expect(dir.children).toEqual([]);
    }
  });

  it('does not mark directory as missing when files exist in it', () => {
    const nodes = [
      createNode({ filePath: 'rules/coding.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
    ];

    const trees = buildFileTrees(nodes);
    const projectTree = trees.project!;

    // "rules" should exist as a real directory, not missing
    const rulesDir = projectTree.children.find(c => c.name === 'rules');
    expect(rulesDir).toBeDefined();
    expect(rulesDir!.type).toBe('directory');

    // Should not also have a missing "rules"
    const missingRules = projectTree.children.filter(c => c.name === 'rules' && c.type === 'missing');
    expect(missingRules).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scope root names
// ---------------------------------------------------------------------------

describe('buildFileTrees - scope root names', () => {
  it('user scope root is named "~/.claude"', () => {
    const trees = buildFileTrees([createNode({ filePath: 'f.json', scope: 'user' })]);
    expect(trees.user!.name).toBe('~/.claude');
    expect(trees.user!.path).toBe('~/.claude');
  });

  it('project scope root is named ".claude"', () => {
    const trees = buildFileTrees([createNode({ filePath: 'f.json', scope: 'project' })]);
    expect(trees.project!.name).toBe('.claude');
    expect(trees.project!.path).toBe('.claude');
  });

  it('local scope root is named ".claude (local)"', () => {
    const trees = buildFileTrees([createNode({ filePath: 'f.json', scope: 'local' })]);
    expect(trees.local!.name).toBe('.claude (local)');
  });

  it('managed scope root is named "managed"', () => {
    const trees = buildFileTrees([createNode({ filePath: 'f.json', scope: 'managed' })]);
    expect(trees.managed!.name).toBe('managed');
  });

  it('plugin scope root is named "plugins"', () => {
    const trees = buildFileTrees([createNode({ filePath: 'f.json', scope: 'plugin', subsystem: 'plugins', nodeType: 'plugin' })]);
    expect(trees.plugin!.name).toBe('plugins');
  });
});

// ---------------------------------------------------------------------------
// Scope coloring
// ---------------------------------------------------------------------------

describe('buildFileTrees - scope assignment', () => {
  it('propagates scope from nodes to all tree entries', () => {
    const nodes = [
      createNode({ filePath: 'settings.json', scope: 'user' }),
      createNode({ filePath: 'rules/a.md', scope: 'user', subsystem: 'rules', nodeType: 'rule' }),
    ];

    const trees = buildFileTrees(nodes);
    const userTree = trees.user!;

    const checkScope = (entry: FileTree): void => {
      expect(entry.scope).toBe('user');
      for (const child of entry.children) {
        checkScope(child);
      }
    };

    checkScope(userTree);
  });
});

// ---------------------------------------------------------------------------
// Subsystem assignment for directories
// ---------------------------------------------------------------------------

describe('buildFileTrees - subsystem on directories', () => {
  it('assigns subsystem to directory when all children share same subsystem', () => {
    const nodes = [
      createNode({ filePath: 'rules/a.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
      createNode({ filePath: 'rules/b.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
    ];

    const trees = buildFileTrees(nodes);
    const rulesDir = trees.project!.children.find(c => c.name === 'rules');
    expect(rulesDir!.subsystem).toBe('rules');
  });

  it('does not assign subsystem when children have different subsystems', () => {
    const nodes = [
      createNode({ filePath: 'mixed/a.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
      createNode({ filePath: 'mixed/b.json', scope: 'project', subsystem: 'settings', nodeType: 'settings' }),
    ];

    const trees = buildFileTrees(nodes);
    const mixedDir = trees.project!.children.find(c => c.name === 'mixed');
    expect(mixedDir!.subsystem).toBeNull();
  });

  it('infers subsystem recursively through nested directories', () => {
    const nodes = [
      createNode({ filePath: 'rules/sub/deep.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
    ];

    const trees = buildFileTrees(nodes);
    const rulesDir = trees.project!.children.find(c => c.name === 'rules')!;
    const subDir = rulesDir.children.find(c => c.name === 'sub')!;

    // sub directory has only rules children, so it should inherit rules subsystem
    expect(subDir.subsystem).toBe('rules');
    // rules directory also has only rules descendants, so it should too
    expect(rulesDir.subsystem).toBe('rules');
  });

  it('sets null subsystem on root directory even when all children share subsystem', () => {
    const nodes = [
      createNode({ filePath: 'settings.json', scope: 'user' }),
    ];

    const trees = buildFileTrees(nodes);
    expect(trees.user!.subsystem).toBeNull();
  });

  it('root directory type is always "directory"', () => {
    const nodes = [
      createNode({ filePath: 'settings.json', scope: 'user' }),
    ];

    const trees = buildFileTrees(nodes);
    expect(trees.user!.type).toBe('directory');
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe('buildFileTrees - empty input', () => {
  it('returns empty record for empty node array', () => {
    const trees = buildFileTrees([]);
    expect(Object.keys(trees)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// All 5 scopes
// ---------------------------------------------------------------------------

describe('buildFileTrees - all scopes', () => {
  it('creates separate trees for all 5 scopes when data present', () => {
    const nodes = [
      createNode({ filePath: 'settings.json', scope: 'managed' }),
      createNode({ filePath: 'settings.json', scope: 'user' }),
      createNode({ filePath: 'settings.json', scope: 'project' }),
      createNode({ filePath: 'settings.local.json', scope: 'local' }),
      createNode({ filePath: '.claude-plugin/plugin.json', scope: 'plugin', subsystem: 'plugins', nodeType: 'plugin' }),
    ];

    const trees = buildFileTrees(nodes);

    expect(trees.managed).toBeDefined();
    expect(trees.user).toBeDefined();
    expect(trees.project).toBeDefined();
    expect(trees.local).toBeDefined();
    expect(trees.plugin).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// File path with backslashes (Windows paths)
// ---------------------------------------------------------------------------

describe('buildFileTrees - Windows-style paths', () => {
  it('normalizes backslashes in file paths to forward slashes for tree structure', () => {
    const nodes = [
      createNode({ filePath: 'rules\\coding.md', scope: 'project', subsystem: 'rules', nodeType: 'rule' }),
    ];

    const trees = buildFileTrees(nodes);
    const projectTree = trees.project!;

    const rulesDir = projectTree.children.find(c => c.name === 'rules');
    expect(rulesDir).toBeDefined();
    expect(rulesDir!.type).toBe('directory');

    const file = rulesDir!.children.find(c => c.name === 'coding.md');
    expect(file).toBeDefined();
    expect(file!.type).toBe('file');
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('buildFileTrees - properties', () => {
  const scopeArb: fc.Arbitrary<ScopeName> = fc.constantFrom(
    'managed' as const,
    'user' as const,
    'project' as const,
    'local' as const,
    'plugin' as const,
  );

  const nodeArb: fc.Arbitrary<ConfigNode> = fc.oneof(
    fc.record({
      filePath: fc.constant('settings.json'),
      scope: scopeArb,
    }).map(({ filePath, scope }) => createNode({ filePath, scope })),
    fc.record({
      filePath: fc.constant('CLAUDE.md'),
      scope: scopeArb,
    }).map(({ filePath, scope }) => createNode({ filePath, scope, subsystem: 'memory', nodeType: 'memory' })),
    fc.record({
      filePath: fc.constant('rules/test.md'),
      scope: scopeArb,
    }).map(({ filePath, scope }) => createNode({ filePath, scope, subsystem: 'rules', nodeType: 'rule' })),
    fc.record({
      filePath: fc.constant('agents/test.md'),
      scope: scopeArb,
    }).map(({ filePath, scope }) => createNode({ filePath, scope, subsystem: 'agents', nodeType: 'agent' })),
  );

  const countFiles = (tree: FileTree): number => {
    if (tree.type === 'file') return 1;
    if (tree.type === 'missing') return 0;
    return tree.children.reduce((sum, child) => sum + countFiles(child), 0);
  };

  it('total file entries across all scope trees equals unique (scope, path) pairs', () => {
    fc.assert(
      fc.property(fc.array(nodeArb, { maxLength: 15 }), (nodes) => {
        const trees = buildFileTrees(nodes);
        const totalFiles = Object.values(trees).reduce(
          (sum, tree) => sum + (tree ? countFiles(tree) : 0),
          0,
        );
        // Duplicate paths within the same scope are deduplicated by the tree
        const uniquePaths = new Set(nodes.map(n => `${n.scope}:${n.filePath}`));
        expect(totalFiles).toBe(uniquePaths.size);
      }),
    );
  });

  it('every file entry has a non-null ConfigNode', () => {
    fc.assert(
      fc.property(fc.array(nodeArb, { minLength: 1, maxLength: 15 }), (nodes) => {
        const trees = buildFileTrees(nodes);

        const checkNodes = (tree: FileTree): void => {
          if (tree.type === 'file') {
            expect(tree.node).not.toBeNull();
          }
          for (const child of tree.children) {
            checkNodes(child);
          }
        };

        for (const tree of Object.values(trees)) {
          if (tree) checkNodes(tree);
        }
      }),
    );
  });

  it('no scope tree contains nodes from a different scope', () => {
    fc.assert(
      fc.property(fc.array(nodeArb, { minLength: 1, maxLength: 15 }), (nodes) => {
        const trees = buildFileTrees(nodes);

        const checkScope = (tree: FileTree, expectedScope: ScopeName): void => {
          expect(tree.scope).toBe(expectedScope);
          for (const child of tree.children) {
            checkScope(child, expectedScope);
          }
        };

        for (const [scope, tree] of Object.entries(trees)) {
          if (tree) checkScope(tree, scope as ScopeName);
        }
      }),
    );
  });

  it('directories always sort before files which sort before missing', () => {
    fc.assert(
      fc.property(fc.array(nodeArb, { minLength: 1, maxLength: 10 }), (nodes) => {
        const trees = buildFileTrees(nodes);

        const checkOrder = (tree: FileTree): void => {
          const types = tree.children.map(c => c.type);
          let lastDir = -1;
          let firstFile = types.length;
          let lastFile = -1;
          let firstMissing = types.length;

          for (let i = 0; i < types.length; i++) {
            if (types[i] === 'directory') lastDir = i;
            if (types[i] === 'file' && firstFile === types.length) firstFile = i;
            if (types[i] === 'file') lastFile = i;
            if (types[i] === 'missing' && firstMissing === types.length) firstMissing = i;
          }

          if (lastDir >= 0 && firstFile < types.length) {
            expect(lastDir).toBeLessThan(firstFile);
          }
          if (lastFile >= 0 && firstMissing < types.length) {
            expect(lastFile).toBeLessThan(firstMissing);
          }

          for (const child of tree.children) {
            checkOrder(child);
          }
        };

        for (const tree of Object.values(trees)) {
          if (tree) checkOrder(tree);
        }
      }),
    );
  });
});

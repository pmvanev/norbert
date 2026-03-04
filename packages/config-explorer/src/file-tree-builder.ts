/**
 * File tree builder -- pure function that transforms a flat array of ConfigNodes
 * into nested FileTree structures grouped by scope.
 *
 * No I/O. Takes pre-assembled ConfigNode[] and produces a record of scope-keyed
 * FileTree values. Missing directories for expected subsystem paths are included
 * as placeholders with descriptive tooltips.
 */

import type {
  ScopeName,
  SubsystemName,
  ConfigNode,
  FileTree,
  FileTreeEntryType,
} from './types/index.js';

// ---------------------------------------------------------------------------
// Expected directories per scope (for missing-directory indicators)
// ---------------------------------------------------------------------------

interface ExpectedDirectory {
  readonly name: string;
  readonly subsystem: SubsystemName;
  readonly tooltip: string;
}

const EXPECTED_DIRECTORIES: readonly ExpectedDirectory[] = [
  { name: 'rules', subsystem: 'rules', tooltip: 'No rules configured' },
  { name: 'agents', subsystem: 'agents', tooltip: 'No agents configured' },
  { name: 'skills', subsystem: 'skills', tooltip: 'No skills configured' },
];

// ---------------------------------------------------------------------------
// Internal mutable tree node for building phase
// ---------------------------------------------------------------------------

interface MutableTreeNode {
  name: string;
  path: string;
  scope: ScopeName;
  subsystem: SubsystemName | null;
  type: FileTreeEntryType;
  children: Map<string, MutableTreeNode>;
  node: ConfigNode | null;
  tooltip: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const createDirectoryNode = (
  name: string,
  path: string,
  scope: ScopeName,
): MutableTreeNode => ({
  name,
  path,
  scope,
  subsystem: null,
  type: 'directory',
  children: new Map(),
  node: null,
  tooltip: null,
});

const createFileNode = (
  name: string,
  path: string,
  scope: ScopeName,
  configNode: ConfigNode,
): MutableTreeNode => ({
  name,
  path,
  scope,
  subsystem: configNode.subsystem,
  type: 'file',
  children: new Map(),
  node: configNode,
  tooltip: null,
});

const createMissingNode = (
  name: string,
  path: string,
  scope: ScopeName,
  subsystem: SubsystemName,
  tooltip: string,
): MutableTreeNode => ({
  name,
  path,
  scope,
  subsystem,
  type: 'missing',
  children: new Map(),
  node: null,
  tooltip,
});

/**
 * Inserts a ConfigNode into the mutable tree, creating intermediate
 * directory nodes as needed.
 */
const insertNode = (
  root: MutableTreeNode,
  configNode: ConfigNode,
): void => {
  const segments = configNode.filePath.replace(/\\/g, '/').split('/');
  let current = root;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (!current.children.has(segment)) {
      const dirPath = segments.slice(0, i + 1).join('/');
      current.children.set(
        segment,
        createDirectoryNode(segment, dirPath, configNode.scope),
      );
    }
    current = current.children.get(segment)!;
  }

  const fileName = segments[segments.length - 1];
  current.children.set(
    fileName,
    createFileNode(fileName, configNode.filePath, configNode.scope, configNode),
  );
};

/**
 * Infers subsystem for directories. When all children share the same subsystem,
 * the directory inherits it.
 */
const inferDirectorySubsystem = (node: MutableTreeNode): void => {
  for (const child of node.children.values()) {
    if (child.type === 'directory') {
      inferDirectorySubsystem(child);
    }
  }

  if (node.type === 'directory' && node.children.size > 0) {
    const childSubsystems = new Set<SubsystemName | null>();
    for (const child of node.children.values()) {
      childSubsystems.add(child.subsystem);
    }
    childSubsystems.delete(null);

    if (childSubsystems.size === 1) {
      node.subsystem = [...childSubsystems][0]!;
    }
  }
};

/**
 * Adds missing directory placeholders for expected subsystem directories
 * that do not already exist in the tree.
 */
const addMissingDirectories = (
  root: MutableTreeNode,
  scope: ScopeName,
): void => {
  for (const expected of EXPECTED_DIRECTORIES) {
    if (!root.children.has(expected.name)) {
      root.children.set(
        expected.name,
        createMissingNode(
          expected.name,
          expected.name,
          scope,
          expected.subsystem,
          expected.tooltip,
        ),
      );
    }
  }
};

/**
 * Converts the mutable tree to an immutable FileTree value.
 * Children are sorted: directories first, then files, then missing -- alphabetical within each group.
 */
const freezeTree = (mutable: MutableTreeNode): FileTree => {
  const childArray = [...mutable.children.values()];

  const sortedChildren = childArray.sort((a, b) => {
    const typeOrder = { directory: 0, file: 1, missing: 2 };
    const aOrder = typeOrder[a.type] ?? 1;
    const bOrder = typeOrder[b.type] ?? 1;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });

  return {
    name: mutable.name,
    path: mutable.path,
    scope: mutable.scope,
    subsystem: mutable.subsystem,
    type: mutable.type,
    children: sortedChildren.map(freezeTree),
    node: mutable.node,
    tooltip: mutable.tooltip,
  };
};

// ---------------------------------------------------------------------------
// Scope root labels
// ---------------------------------------------------------------------------

const SCOPE_ROOT_NAMES: Readonly<Record<ScopeName, string>> = {
  managed: 'managed',
  user: '~/.claude',
  project: '.claude',
  local: '.claude (local)',
  plugin: 'plugins',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds FileTree structures from flat ConfigNode[], grouped by scope.
 *
 * Pure function: no I/O, no side effects.
 *
 * @param nodes - Flat array of ConfigNode values
 * @returns Record mapping each scope (that has at least one node) to its FileTree
 */
export const buildFileTrees = (
  nodes: readonly ConfigNode[],
): Partial<Record<ScopeName, FileTree>> => {
  // Group nodes by scope
  const nodesByScope = new Map<ScopeName, ConfigNode[]>();
  for (const node of nodes) {
    const existing = nodesByScope.get(node.scope) ?? [];
    existing.push(node);
    nodesByScope.set(node.scope, existing);
  }

  // Build a tree per scope
  const result: Partial<Record<ScopeName, FileTree>> = {};

  for (const [scope, scopeNodes] of nodesByScope) {
    const rootName = SCOPE_ROOT_NAMES[scope];
    const root = createDirectoryNode(rootName, rootName, scope);

    for (const node of scopeNodes) {
      insertNode(root, node);
    }

    inferDirectorySubsystem(root);
    addMissingDirectories(root, scope);

    // Root is always a directory, subsystem is null
    root.subsystem = null;

    result[scope] = freezeTree(root);
  }

  return result;
};

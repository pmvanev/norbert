/**
 * Mind Map Builder -- pure function that transforms a ConfigModel
 * into a hierarchical tree structure for D3.js mind map rendering.
 *
 * No I/O. Takes the assembled ConfigModel and produces a tree of
 * MindMapNode values with root -> subsystem branches -> leaf nodes.
 */

import type { ConfigModel, ConfigNode } from './types/index.js';
import type { ScopeName, SubsystemName } from './types/index.js';
import { ALL_SUBSYSTEMS } from './types/index.js';

// ---------------------------------------------------------------------------
// MindMapNode -- the hierarchical data structure for D3.js
// ---------------------------------------------------------------------------

export interface MindMapNode {
  /** Display name: root label, subsystem label, or file name */
  readonly name: string;
  /** Subsystem this node belongs to (null for root) */
  readonly subsystem: SubsystemName | null;
  /** Scope for coloring (null for root and branch nodes) */
  readonly scope: ScopeName | null;
  /** Number of config files in this branch (0 for leaf nodes) */
  readonly count: number;
  /** True when this branch has zero config files */
  readonly isEmpty: boolean;
  /** Child nodes: subsystem branches for root, leaf files for branches */
  readonly children: readonly MindMapNode[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const groupNodesBySubsystem = (
  nodes: readonly ConfigNode[],
): ReadonlyMap<SubsystemName, readonly ConfigNode[]> => {
  const groups = new Map<SubsystemName, ConfigNode[]>();
  for (const node of nodes) {
    const existing = groups.get(node.subsystem);
    if (existing) {
      existing.push(node);
    } else {
      groups.set(node.subsystem, [node]);
    }
  }
  return groups;
};

const buildLeafNode = (configNode: ConfigNode): MindMapNode => ({
  name: configNode.name,
  subsystem: configNode.subsystem,
  scope: configNode.scope,
  count: 0,
  isEmpty: false,
  children: [],
});

const buildBranchNode = (
  subsystemName: SubsystemName,
  label: string,
  configNodes: readonly ConfigNode[],
): MindMapNode => ({
  name: label,
  subsystem: subsystemName,
  scope: null,
  count: configNodes.length,
  isEmpty: configNodes.length === 0,
  children: configNodes.map(buildLeafNode),
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transforms a ConfigModel into a hierarchical MindMapNode tree.
 *
 * The tree has three levels:
 *   1. Root: "Configuration" (single node)
 *   2. Branches: One per subsystem (always 8), with count and isEmpty
 *   3. Leaves: Individual config files with scope for coloring
 *
 * Pure function: no I/O, no side effects.
 *
 * @param model - The assembled ConfigModel
 * @returns Root MindMapNode with 8 subsystem branches
 */
export const buildMindMapData = (model: ConfigModel): MindMapNode => {
  const nodesBySubsystem = groupNodesBySubsystem(model.nodes);

  const branches = ALL_SUBSYSTEMS.map((subsystem) => {
    const nodesForSubsystem = nodesBySubsystem.get(subsystem.subsystem) ?? [];
    return buildBranchNode(subsystem.subsystem, subsystem.label, nodesForSubsystem);
  });

  return {
    name: 'Configuration',
    subsystem: null,
    scope: null,
    count: model.totalFiles,
    isEmpty: model.totalFiles === 0,
    children: branches,
  };
};

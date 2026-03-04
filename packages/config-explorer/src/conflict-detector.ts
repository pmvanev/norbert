/**
 * Conflict detection -- pure function that finds naming conflicts
 * between ConfigNode values at different scopes.
 *
 * No I/O. Operates on an assembled node list and produces NamingConflict
 * values for nodes that share the same logical name and node type but
 * exist at different scopes (where one overrides the other).
 *
 * Plugin-namespaced elements (e.g., "plugin-name:skill-name") do not
 * conflict with non-namespaced elements of the same bare name.
 */

import type { ConfigNode, NamingConflict, NodeType } from './types/index.js';
import type { ScopeName } from './types/scope.js';

// ---------------------------------------------------------------------------
// Scope priority -- higher index = higher priority (wins in conflicts)
// ---------------------------------------------------------------------------

/**
 * Scope priority order from lowest (user) to highest (managed).
 * Matches the Claude Code precedence hierarchy.
 */
const SCOPE_PRIORITY: readonly ScopeName[] = [
  'user',
  'plugin',
  'project',
  'local',
  'managed',
] as const;

const scopePriority = (scope: ScopeName): number =>
  SCOPE_PRIORITY.indexOf(scope);

// ---------------------------------------------------------------------------
// Internal helpers -- name resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the logical name for a node from frontmatter or file name.
 */
const resolveLogicalName = (node: ConfigNode): string => {
  if (node.parsedContent.format === 'markdown-with-frontmatter') {
    const name = node.parsedContent.frontmatter.name;
    if (typeof name === 'string') {
      return name;
    }
  }
  return node.name;
};

/**
 * Determines whether a name is plugin-namespaced (contains a colon).
 * Plugin-namespaced skills use the format "plugin-name:skill-name".
 */
const isPluginNamespaced = (name: string): boolean => name.includes(':');

/**
 * Node types that participate in conflict detection.
 * Only agents and skills can conflict across scopes.
 */
const CONFLICTABLE_NODE_TYPES: readonly NodeType[] = [
  'agent',
  'skill',
] as const;

const isConflictable = (nodeType: NodeType): boolean =>
  CONFLICTABLE_NODE_TYPES.includes(nodeType);

// ---------------------------------------------------------------------------
// Internal helpers -- grouping
// ---------------------------------------------------------------------------

/**
 * Groups nodes by their composite key (nodeType + logicalName).
 * Only includes nodes with conflictable node types and non-namespaced names.
 */
const groupByTypeAndName = (
  nodes: readonly ConfigNode[],
): Map<string, ConfigNode[]> => {
  const groups = new Map<string, ConfigNode[]>();

  for (const node of nodes) {
    if (!isConflictable(node.nodeType)) continue;

    const logicalName = resolveLogicalName(node);
    if (isPluginNamespaced(logicalName)) continue;

    const key = `${node.nodeType}:${logicalName}`;
    const group = groups.get(key);
    if (group !== undefined) {
      group.push(node);
    } else {
      groups.set(key, [node]);
    }
  }

  return groups;
};

// ---------------------------------------------------------------------------
// Internal helpers -- conflict creation
// ---------------------------------------------------------------------------

/**
 * Creates a NamingConflict from two nodes at different scopes.
 * The higher-priority scope node is the winner.
 */
const createConflict = (
  nodeA: ConfigNode,
  nodeB: ConfigNode,
  logicalName: string,
): NamingConflict => {
  const priorityA = scopePriority(nodeA.scope);
  const priorityB = scopePriority(nodeB.scope);
  const higherScope = priorityA >= priorityB ? nodeA : nodeB;
  const lowerScope = priorityA >= priorityB ? nodeB : nodeA;

  return {
    name: logicalName,
    nodeType: nodeA.nodeType,
    higherScope,
    lowerScope,
    resolution: `${higherScope.scope} scope overrides ${lowerScope.scope} scope`,
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detects naming conflicts between ConfigNode values at different scopes.
 *
 * Pure function: no I/O, no side effects.
 *
 * A conflict occurs when two nodes share the same logical name and node type
 * but exist at different scopes. Plugin-namespaced names (containing ':')
 * are excluded from conflict detection since they occupy a separate namespace.
 *
 * The winning node is determined by scope priority:
 * managed > local > project > plugin > user
 *
 * @param nodes - Array of ConfigNode values from the assembled model
 * @returns Array of NamingConflict values for detected conflicts
 */
export const detectConflicts = (
  nodes: readonly ConfigNode[],
): readonly NamingConflict[] => {
  const groups = groupByTypeAndName(nodes);
  const conflicts: NamingConflict[] = [];

  for (const [key, group] of groups) {
    if (group.length < 2) continue;

    // Find nodes at distinct scopes
    const uniqueScopes = new Set(group.map((n) => n.scope));
    if (uniqueScopes.size < 2) continue;

    // Sort by priority (highest first) and create conflict between top two
    const sorted = [...group].sort(
      (a, b) => scopePriority(b.scope) - scopePriority(a.scope),
    );

    const logicalName = key.split(':').slice(1).join(':');
    // Report pairwise conflicts between highest scope and each lower scope
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].scope !== sorted[0].scope) {
        conflicts.push(createConflict(sorted[0], sorted[i], logicalName));
      }
    }
  }

  return conflicts;
};

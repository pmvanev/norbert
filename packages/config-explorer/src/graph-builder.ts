/**
 * Graph Builder -- pure function that transforms a ConfigModel
 * into a flat graph structure for D3.js force simulation rendering.
 *
 * No I/O. Takes the assembled ConfigModel and produces GraphData
 * containing typed nodes (with shape/color metadata), relationship
 * links, and naming conflict information.
 *
 * Virtual edge targets (pattern:, tool:, event:) are filtered out
 * since they have no corresponding ConfigNode in the model.
 */

import type { ConfigModel, ConfigNode, ConfigEdge, NamingConflict } from './types/index.js';
import type { ScopeName } from './types/scope.js';
import type { SubsystemName } from './types/subsystem.js';
import type { NodeType } from './types/node.js';

// ---------------------------------------------------------------------------
// GraphNode -- a node optimized for D3.js force simulation
// ---------------------------------------------------------------------------

export interface GraphNode {
  /** Unique identifier matching ConfigNode.id */
  readonly id: string;
  /** Display label (file name or logical name) */
  readonly label: string;
  /** Node type determines visual shape (hexagon, circle, etc.) */
  readonly nodeType: NodeType;
  /** Configuration scope */
  readonly scope: ScopeName;
  /** Hex color for scope-based coloring */
  readonly scopeColor: string;
  /** Configuration subsystem */
  readonly subsystem: SubsystemName;
  /** True when nodeType is 'plugin' (clickable for explosion) */
  readonly isPlugin: boolean;
  /** True when this node is involved in a naming conflict */
  readonly isConflicted: boolean;
}

// ---------------------------------------------------------------------------
// GraphLink -- a relationship between two nodes
// ---------------------------------------------------------------------------

export interface GraphLink {
  /** Source node id */
  readonly source: string;
  /** Target node id */
  readonly target: string;
  /** Edge type from ConfigEdge */
  readonly edgeType: ConfigEdge['edgeType'];
  /** True when this link represents a naming conflict */
  readonly isConflict: boolean;
}

// ---------------------------------------------------------------------------
// GraphData -- the complete force-simulation-ready structure
// ---------------------------------------------------------------------------

export interface GraphData {
  /** Flat list of graph nodes */
  readonly nodes: readonly GraphNode[];
  /** Flat list of relationship links */
  readonly links: readonly GraphLink[];
  /** Naming conflicts for tooltip/indicator display */
  readonly conflicts: readonly NamingConflict[];
}

// ---------------------------------------------------------------------------
// Scope color lookup
// ---------------------------------------------------------------------------

const SCOPE_COLORS: Readonly<Record<ScopeName, string>> = {
  user: '#3B82F6',
  project: '#22C55E',
  local: '#EAB308',
  plugin: '#A855F7',
  managed: '#EF4444',
};

const scopeColorFor = (scope: ScopeName): string => SCOPE_COLORS[scope];

// ---------------------------------------------------------------------------
// Virtual target detection
// ---------------------------------------------------------------------------

const VIRTUAL_PREFIXES: readonly string[] = ['pattern:', 'tool:', 'event:'];

const isVirtualTarget = (id: string): boolean =>
  VIRTUAL_PREFIXES.some((prefix) => id.startsWith(prefix));

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Collects the set of node ids involved in any naming conflict.
 */
const collectConflictedNodeIds = (
  conflicts: readonly NamingConflict[],
): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const conflict of conflicts) {
    ids.add(conflict.higherScope.id);
    ids.add(conflict.lowerScope.id);
  }
  return ids;
};

/**
 * Transforms a ConfigNode into a GraphNode.
 */
const toGraphNode = (
  configNode: ConfigNode,
  conflictedIds: ReadonlySet<string>,
): GraphNode => ({
  id: configNode.id,
  label: configNode.name,
  nodeType: configNode.nodeType,
  scope: configNode.scope,
  scopeColor: scopeColorFor(configNode.scope),
  subsystem: configNode.subsystem,
  isPlugin: configNode.nodeType === 'plugin',
  isConflicted: conflictedIds.has(configNode.id),
});

/**
 * Transforms a ConfigEdge into a GraphLink, filtering out virtual targets.
 * Returns null for edges pointing to or from virtual targets.
 */
const toGraphLink = (
  edge: ConfigEdge,
  nodeIds: ReadonlySet<string>,
): GraphLink | null => {
  if (isVirtualTarget(edge.sourceId) || isVirtualTarget(edge.targetId)) {
    return null;
  }
  if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) {
    return null;
  }
  return {
    source: edge.sourceId,
    target: edge.targetId,
    edgeType: edge.edgeType,
    isConflict: false,
  };
};

/**
 * Creates GraphLink values for naming conflicts.
 */
const conflictToGraphLink = (conflict: NamingConflict): GraphLink => ({
  source: conflict.higherScope.id,
  target: conflict.lowerScope.id,
  edgeType: 'naming-conflict',
  isConflict: true,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transforms a ConfigModel into a GraphData structure optimized for
 * D3.js force simulation rendering.
 *
 * Pure function: no I/O, no side effects.
 *
 * - Nodes carry shape metadata (nodeType), scope color, plugin flag,
 *   and conflict marker
 * - Links represent real cross-references between existing nodes
 * - Virtual targets (pattern:, tool:, event:) are filtered out
 * - Naming conflicts produce additional red conflict links
 *
 * @param model - The assembled ConfigModel with nodes, edges, and conflicts
 * @returns GraphData with nodes, links, and conflicts
 */
export const buildGraphData = (model: ConfigModel): GraphData => {
  const conflictedIds = collectConflictedNodeIds(model.conflicts);
  const nodeIds = new Set(model.nodes.map((n) => n.id));

  const nodes = model.nodes.map((node) => toGraphNode(node, conflictedIds));

  const edgeLinks = model.edges
    .map((edge) => toGraphLink(edge, nodeIds))
    .filter((link): link is GraphLink => link !== null);

  const conflictLinks = model.conflicts.map(conflictToGraphLink);

  return {
    nodes,
    links: [...edgeLinks, ...conflictLinks],
    conflicts: model.conflicts,
  };
};

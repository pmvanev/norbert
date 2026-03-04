/**
 * Precedence resolver -- pure function resolving precedence per subsystem.
 *
 * Takes all discovered ConfigNodes for a given subsystem and produces a
 * PrecedenceChain showing which scopes are active, overridden, or empty.
 *
 * Resolution types:
 * - override: highest-priority scope wins (settings, rules, skills, agents)
 * - additive: all scopes contribute (CLAUDE.md memory files)
 * - merge: all scopes merge their values (hooks, MCP, array settings)
 *
 * No I/O. Pure function: ConfigNode[] x SubsystemName -> PrecedenceChain.
 */

import type { ScopeName } from './types/scope.js';
import type { SubsystemName } from './types/subsystem.js';
import type { ConfigNode } from './types/node.js';
import type {
  ResolutionType,
  PrecedenceEntry,
  PrecedenceChain,
  PrecedenceStatus,
} from './types/precedence.js';

// ---------------------------------------------------------------------------
// Scope priority orders per subsystem
// ---------------------------------------------------------------------------

/**
 * Settings precedence: managed > local > project > user
 * (CLI scope maps to 'local' in our model since we don't have a separate CLI scope)
 */
const SETTINGS_SCOPE_ORDER: readonly ScopeName[] = [
  'managed',
  'local',
  'project',
  'user',
  'plugin',
] as const;

/**
 * Memory (CLAUDE.md) loading order: managed > local > project > user
 * All are additive -- order determines display, not override.
 */
const MEMORY_SCOPE_ORDER: readonly ScopeName[] = [
  'managed',
  'local',
  'project',
  'user',
  'plugin',
] as const;

/**
 * Rules precedence: project > user (rules subsystem only uses these scopes).
 * Managed and local included for completeness.
 */
const RULES_SCOPE_ORDER: readonly ScopeName[] = [
  'managed',
  'local',
  'project',
  'user',
  'plugin',
] as const;

/**
 * Skills priority: enterprise (managed) > personal (user) > project > plugin.
 */
const SKILLS_SCOPE_ORDER: readonly ScopeName[] = [
  'managed',
  'user',
  'project',
  'plugin',
  'local',
] as const;

/**
 * Agents priority: CLI (local) > project > user > plugin.
 */
const AGENTS_SCOPE_ORDER: readonly ScopeName[] = [
  'managed',
  'local',
  'project',
  'user',
  'plugin',
] as const;

/**
 * Hooks: all scopes merge. Order is for display.
 */
const HOOKS_SCOPE_ORDER: readonly ScopeName[] = [
  'managed',
  'local',
  'project',
  'user',
  'plugin',
] as const;

/**
 * Plugins: simple listing. Only plugin scope matters.
 */
const PLUGINS_SCOPE_ORDER: readonly ScopeName[] = [
  'managed',
  'local',
  'project',
  'user',
  'plugin',
] as const;

/**
 * MCP: all scopes merge.
 */
const MCP_SCOPE_ORDER: readonly ScopeName[] = [
  'managed',
  'local',
  'project',
  'user',
  'plugin',
] as const;

// ---------------------------------------------------------------------------
// Resolution type per subsystem
// ---------------------------------------------------------------------------

const resolveResolutionType = (subsystem: SubsystemName): ResolutionType => {
  switch (subsystem) {
    case 'memory':
      return 'additive';
    case 'hooks':
    case 'mcp':
      return 'merge';
    case 'settings':
    case 'rules':
    case 'skills':
    case 'agents':
    case 'plugins':
      return 'override';
  }
};

// ---------------------------------------------------------------------------
// Scope order per subsystem
// ---------------------------------------------------------------------------

const resolveScopeOrder = (subsystem: SubsystemName): readonly ScopeName[] => {
  switch (subsystem) {
    case 'settings':
      return SETTINGS_SCOPE_ORDER;
    case 'memory':
      return MEMORY_SCOPE_ORDER;
    case 'rules':
      return RULES_SCOPE_ORDER;
    case 'skills':
      return SKILLS_SCOPE_ORDER;
    case 'agents':
      return AGENTS_SCOPE_ORDER;
    case 'hooks':
      return HOOKS_SCOPE_ORDER;
    case 'plugins':
      return PLUGINS_SCOPE_ORDER;
    case 'mcp':
      return MCP_SCOPE_ORDER;
  }
};

// ---------------------------------------------------------------------------
// Group nodes by scope
// ---------------------------------------------------------------------------

const groupNodesByScope = (
  nodes: readonly ConfigNode[],
  subsystem: SubsystemName,
): ReadonlyMap<ScopeName, readonly ConfigNode[]> => {
  const filtered = nodes.filter((n) => n.subsystem === subsystem);
  const grouped = new Map<ScopeName, ConfigNode[]>();

  for (const node of filtered) {
    const existing = grouped.get(node.scope) ?? [];
    existing.push(node);
    grouped.set(node.scope, existing);
  }

  return grouped;
};

// ---------------------------------------------------------------------------
// Detect if settings have array (permissions) keys that should merge
// ---------------------------------------------------------------------------

const isArraySettingsKey = (key: string): boolean =>
  key === 'permissions' ||
  key.startsWith('permissions.');

const extractSettingsKeys = (node: ConfigNode): readonly string[] => {
  if (node.parsedContent.format === 'json') {
    return node.parsedContent.keys;
  }
  return [];
};

const hasArraySettingsKeys = (nodes: readonly ConfigNode[]): boolean =>
  nodes.some((n) =>
    extractSettingsKeys(n).some(isArraySettingsKey),
  );

// ---------------------------------------------------------------------------
// Build merge contribution labels
// ---------------------------------------------------------------------------

const buildMergeContribution = (
  scopeNodes: readonly ConfigNode[],
): readonly string[] =>
  scopeNodes.map((n) => n.name);

// ---------------------------------------------------------------------------
// Override resolution: per-name conflict detection
// ---------------------------------------------------------------------------

/**
 * For subsystems with per-name override (rules, skills, agents),
 * determine which scope is "overridden" by checking if a higher-priority
 * scope has a node with the same name.
 */
const findOverridingScope = (
  nodeName: string,
  currentScope: ScopeName,
  scopeOrder: readonly ScopeName[],
  groupedNodes: ReadonlyMap<ScopeName, readonly ConfigNode[]>,
): ScopeName | null => {
  const currentIndex = scopeOrder.indexOf(currentScope);

  for (let i = 0; i < currentIndex; i++) {
    const higherScope = scopeOrder[i];
    const higherNodes = groupedNodes.get(higherScope) ?? [];
    if (higherNodes.some((n) => n.name === nodeName)) {
      return higherScope;
    }
  }

  return null;
};

/**
 * Determine if ALL nodes in a scope are overridden by higher-priority scopes.
 * For per-name subsystems (rules, skills, agents), a scope is overridden
 * only if every one of its named items is overridden.
 */
const isEntirelyOverridden = (
  scopeNodes: readonly ConfigNode[],
  currentScope: ScopeName,
  scopeOrder: readonly ScopeName[],
  groupedNodes: ReadonlyMap<ScopeName, readonly ConfigNode[]>,
): boolean => {
  if (scopeNodes.length === 0) return false;

  return scopeNodes.every((node) =>
    findOverridingScope(node.name, currentScope, scopeOrder, groupedNodes) !== null,
  );
};

/**
 * Find the highest-priority scope that overrides any node in the current scope.
 */
const findHighestOverridingScope = (
  scopeNodes: readonly ConfigNode[],
  currentScope: ScopeName,
  scopeOrder: readonly ScopeName[],
  groupedNodes: ReadonlyMap<ScopeName, readonly ConfigNode[]>,
): ScopeName | null => {
  let highestIndex = scopeOrder.length;
  let highestScope: ScopeName | null = null;

  for (const node of scopeNodes) {
    const overrider = findOverridingScope(node.name, currentScope, scopeOrder, groupedNodes);
    if (overrider !== null) {
      const index = scopeOrder.indexOf(overrider);
      if (index < highestIndex) {
        highestIndex = index;
        highestScope = overrider;
      }
    }
  }

  return highestScope;
};

// ---------------------------------------------------------------------------
// Build override entry for settings subsystem
// ---------------------------------------------------------------------------

const buildSettingsEntry = (
  scope: ScopeName,
  scopeNodes: readonly ConfigNode[],
  scopeOrder: readonly ScopeName[],
  groupedNodes: ReadonlyMap<ScopeName, readonly ConfigNode[]>,
  hasArrayKeys: boolean,
): PrecedenceEntry => {
  if (scopeNodes.length === 0) {
    return {
      scope,
      status: 'empty',
      nodes: [],
      overrideReason: null,
      mergeContribution: null,
    };
  }

  // If this scope has array settings keys, it contributes to merge
  const scopeHasArrayKeys = scopeNodes.some((n) =>
    extractSettingsKeys(n).some(isArraySettingsKey),
  );

  if (hasArrayKeys && scopeHasArrayKeys) {
    return {
      scope,
      status: 'active',
      nodes: scopeNodes,
      overrideReason: null,
      mergeContribution: buildMergeContribution(scopeNodes),
    };
  }

  // Check if a higher-priority scope exists with any nodes
  const currentIndex = scopeOrder.indexOf(scope);
  let overridingScope: ScopeName | null = null;

  for (let i = 0; i < currentIndex; i++) {
    const higherScope = scopeOrder[i];
    const higherNodes = groupedNodes.get(higherScope) ?? [];
    if (higherNodes.length > 0) {
      overridingScope = higherScope;
      break;
    }
  }

  if (overridingScope !== null) {
    return {
      scope,
      status: 'overridden',
      nodes: scopeNodes,
      overrideReason: `Overridden by ${overridingScope} scope`,
      mergeContribution: null,
    };
  }

  return {
    scope,
    status: 'active',
    nodes: scopeNodes,
    overrideReason: null,
    mergeContribution: scopeHasArrayKeys ? buildMergeContribution(scopeNodes) : null,
  };
};

// ---------------------------------------------------------------------------
// Build override entry for per-name subsystems (rules, skills, agents)
// ---------------------------------------------------------------------------

const buildPerNameOverrideEntry = (
  scope: ScopeName,
  scopeNodes: readonly ConfigNode[],
  scopeOrder: readonly ScopeName[],
  groupedNodes: ReadonlyMap<ScopeName, readonly ConfigNode[]>,
): PrecedenceEntry => {
  if (scopeNodes.length === 0) {
    return {
      scope,
      status: 'empty',
      nodes: [],
      overrideReason: null,
      mergeContribution: null,
    };
  }

  const entirelyOverridden = isEntirelyOverridden(
    scopeNodes,
    scope,
    scopeOrder,
    groupedNodes,
  );

  if (entirelyOverridden) {
    const overrider = findHighestOverridingScope(
      scopeNodes,
      scope,
      scopeOrder,
      groupedNodes,
    );

    return {
      scope,
      status: 'overridden',
      nodes: scopeNodes,
      overrideReason: overrider ? `Overridden by ${overrider} scope` : null,
      mergeContribution: null,
    };
  }

  return {
    scope,
    status: 'active',
    nodes: scopeNodes,
    overrideReason: null,
    mergeContribution: null,
  };
};

// ---------------------------------------------------------------------------
// Build additive entry (CLAUDE.md)
// ---------------------------------------------------------------------------

const buildAdditiveEntry = (
  scope: ScopeName,
  scopeNodes: readonly ConfigNode[],
): PrecedenceEntry => {
  if (scopeNodes.length === 0) {
    return {
      scope,
      status: 'empty',
      nodes: [],
      overrideReason: null,
      mergeContribution: null,
    };
  }

  return {
    scope,
    status: 'active',
    nodes: scopeNodes,
    overrideReason: null,
    mergeContribution: null,
  };
};

// ---------------------------------------------------------------------------
// Build merge entry (hooks, MCP)
// ---------------------------------------------------------------------------

const buildMergeEntry = (
  scope: ScopeName,
  scopeNodes: readonly ConfigNode[],
): PrecedenceEntry => {
  if (scopeNodes.length === 0) {
    return {
      scope,
      status: 'empty',
      nodes: [],
      overrideReason: null,
      mergeContribution: null,
    };
  }

  return {
    scope,
    status: 'active',
    nodes: scopeNodes,
    overrideReason: null,
    mergeContribution: buildMergeContribution(scopeNodes),
  };
};

// ---------------------------------------------------------------------------
// Build entry based on resolution type and subsystem
// ---------------------------------------------------------------------------

const buildEntry = (
  scope: ScopeName,
  scopeNodes: readonly ConfigNode[],
  subsystem: SubsystemName,
  resolutionType: ResolutionType,
  scopeOrder: readonly ScopeName[],
  groupedNodes: ReadonlyMap<ScopeName, readonly ConfigNode[]>,
  hasArrayKeys: boolean,
): PrecedenceEntry => {
  switch (resolutionType) {
    case 'additive':
      return buildAdditiveEntry(scope, scopeNodes);

    case 'merge':
      return buildMergeEntry(scope, scopeNodes);

    case 'override':
      if (subsystem === 'settings') {
        return buildSettingsEntry(
          scope,
          scopeNodes,
          scopeOrder,
          groupedNodes,
          hasArrayKeys,
        );
      }

      if (subsystem === 'plugins') {
        // Plugins are simple listing -- all active
        return buildAdditiveEntry(scope, scopeNodes);
      }

      // Per-name override for rules, skills, agents
      return buildPerNameOverrideEntry(
        scope,
        scopeNodes,
        scopeOrder,
        groupedNodes,
      );
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves precedence for a given subsystem from an array of ConfigNodes.
 *
 * Pure function: no I/O, no side effects.
 *
 * @param nodes - All discovered ConfigNodes (may include nodes from other subsystems)
 * @param subsystem - Which subsystem to resolve precedence for
 * @returns PrecedenceChain with entries ordered from highest to lowest priority
 */
export const resolvePrecedence = (
  nodes: readonly ConfigNode[],
  subsystem: SubsystemName,
): PrecedenceChain => {
  const resolutionType = resolveResolutionType(subsystem);
  const scopeOrder = resolveScopeOrder(subsystem);
  const groupedNodes = groupNodesByScope(nodes, subsystem);

  // Detect array settings keys for settings subsystem
  const allSubsystemNodes = nodes.filter((n) => n.subsystem === subsystem);
  const hasArrayKeys = subsystem === 'settings' && hasArraySettingsKeys(allSubsystemNodes);

  const entries: PrecedenceEntry[] = scopeOrder.map((scope) => {
    const scopeNodes = groupedNodes.get(scope) ?? [];
    return buildEntry(
      scope,
      scopeNodes,
      subsystem,
      resolutionType,
      scopeOrder,
      groupedNodes,
      hasArrayKeys,
    );
  });

  return {
    subsystem,
    entries,
    resolutionType,
  };
};

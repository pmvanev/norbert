/// Dependency Resolver — topological sort with semver range validation.
///
/// Pipeline: validate versions -> collect disabled warnings -> build adjacency graph -> Kahn's algorithm
/// Pure functions operating on PluginManifest arrays.
/// Returns Result<DependencyResolution, string> — ordered plugin IDs with warnings or error.

import type { PluginManifest, DependencyResolution, DegradationWarning } from "./types";
import type { Result } from "./types";
import { ok, err } from "./types";
import semver from "semver";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Adjacency representation for the dependency graph.
interface DependencyGraph {
  readonly adjacency: ReadonlyMap<string, readonly string[]>;
  readonly inDegree: ReadonlyMap<string, number>;
}

// ---------------------------------------------------------------------------
// Validation — missing and version-mismatched dependencies
// ---------------------------------------------------------------------------

/// Checks a single dependency entry: is it installed and version-compatible?
/// Disabled dependencies are skipped (they are not missing, just inactive).
const validateDependency = (
  pluginId: string,
  dependencyId: string,
  requiredRange: string,
  manifestMap: ReadonlyMap<string, PluginManifest>,
  disabledPluginIds: ReadonlySet<string>
): string | null => {
  // Disabled dependencies are valid — they just trigger degradation warnings
  if (disabledPluginIds.has(dependencyId)) {
    return null;
  }

  const dependency = manifestMap.get(dependencyId);

  if (dependency === undefined) {
    return `${pluginId}: Requires ${dependencyId} (not installed)`;
  }

  if (!semver.satisfies(dependency.version, requiredRange)) {
    return `${pluginId}: Requires ${dependencyId}@${requiredRange} but v${dependency.version} is installed. Update ${dependencyId} to continue.`;
  }

  return null;
};

/// Validates all dependency declarations across all manifests.
/// Returns collected error messages for all missing or version-mismatched deps.
const validateAllDependencies = (
  manifests: readonly PluginManifest[],
  manifestMap: ReadonlyMap<string, PluginManifest>,
  disabledPluginIds: ReadonlySet<string>
): readonly string[] =>
  manifests.flatMap((manifest) =>
    Object.entries(manifest.dependencies)
      .map(([dependencyId, requiredRange]) =>
        validateDependency(manifest.id, dependencyId, requiredRange, manifestMap, disabledPluginIds)
      )
      .filter((error): error is string => error !== null)
  );

// ---------------------------------------------------------------------------
// Degradation warning collection
// ---------------------------------------------------------------------------

/// Creates a degradation warning for a plugin that depends on a disabled plugin.
export const createDegradationWarning = (
  pluginId: string,
  disabledDependency: string
): DegradationWarning => ({
  pluginId,
  disabledDependency,
  message: `${disabledDependency} is disabled. Features depending on it will not be available. Re-enable ${disabledDependency} to restore full functionality.`,
  reEnableAction: disabledDependency,
});

/// Collects degradation warnings for all plugins whose dependencies are disabled.
const collectDegradationWarnings = (
  manifests: readonly PluginManifest[],
  disabledPluginIds: ReadonlySet<string>
): readonly DegradationWarning[] =>
  manifests.flatMap((manifest) =>
    Object.keys(manifest.dependencies)
      .filter((dependencyId) => disabledPluginIds.has(dependencyId))
      .map((dependencyId) => createDegradationWarning(manifest.id, dependencyId))
  );

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

/// Builds a directed adjacency graph: edges from dependency -> dependent.
/// In-degree counts how many dependencies a plugin has among the manifest set.
/// Disabled plugins are excluded from edges (their dependents don't wait for them).
const buildDependencyGraph = (
  manifests: readonly PluginManifest[],
  manifestMap: ReadonlyMap<string, PluginManifest>,
  disabledPluginIds: ReadonlySet<string>
): DependencyGraph => {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize all nodes
  for (const manifest of manifests) {
    adjacency.set(manifest.id, []);
    inDegree.set(manifest.id, 0);
  }

  // Add edges: dependency -> dependent (dependency must load first)
  for (const manifest of manifests) {
    for (const dependencyId of Object.keys(manifest.dependencies)) {
      // Only add edges for dependencies within the manifest set
      // and that are not disabled
      if (manifestMap.has(dependencyId) && !disabledPluginIds.has(dependencyId)) {
        const neighbors = adjacency.get(dependencyId);
        if (neighbors !== undefined) {
          neighbors.push(manifest.id);
        }
        inDegree.set(manifest.id, (inDegree.get(manifest.id) ?? 0) + 1);
      }
    }
  }

  return {
    adjacency: adjacency as ReadonlyMap<string, readonly string[]>,
    inDegree: inDegree as ReadonlyMap<string, number>,
  };
};

// ---------------------------------------------------------------------------
// Kahn's algorithm — topological sort
// ---------------------------------------------------------------------------

/// Performs topological sort using Kahn's algorithm.
/// Returns ordered plugin IDs or an error for circular dependencies.
const topologicalSort = (
  graph: DependencyGraph
): Result<readonly string[]> => {
  const inDegree = new Map(graph.inDegree);
  const sorted: string[] = [];

  // Start with all nodes that have no incoming edges (no dependencies)
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const neighbors = graph.adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If not all nodes are in the sorted output, there is a cycle
  if (sorted.length !== inDegree.size) {
    const cycleNodes = [...inDegree.entries()]
      .filter(([, degree]) => degree > 0)
      .map(([nodeId]) => nodeId);

    return err(
      `Circular dependency detected among: ${cycleNodes.join(", ")}`
    );
  }

  return ok(sorted);
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Resolves plugin dependency order via topological sort with semver validation.
///
/// Pipeline:
/// 1. Build manifest lookup map
/// 2. Validate all dependencies (missing + version mismatch, skipping disabled)
/// 3. Collect degradation warnings for disabled dependencies
/// 4. Build dependency graph (excluding disabled edges)
/// 5. Topological sort via Kahn's algorithm
///
/// Returns: Result containing DependencyResolution (load order + warnings) or error message.
export const resolveDependencies = (
  manifests: readonly PluginManifest[],
  disabledPluginIds: ReadonlySet<string> = new Set()
): Result<DependencyResolution> => {
  if (manifests.length === 0) {
    return ok({ loadOrder: [], degradationWarnings: [] });
  }

  // Build lookup map
  const manifestMap = new Map(manifests.map((m) => [m.id, m]));

  // Validate all dependencies first (missing + version mismatch)
  const validationErrors = validateAllDependencies(manifests, manifestMap, disabledPluginIds);
  if (validationErrors.length > 0) {
    return err(validationErrors.join("\n"));
  }

  // Collect degradation warnings for disabled dependencies
  const degradationWarnings = collectDegradationWarnings(manifests, disabledPluginIds);

  // Build graph and sort
  const graph = buildDependencyGraph(manifests, manifestMap, disabledPluginIds);
  const sortResult = topologicalSort(graph);

  if (!sortResult.ok) {
    return sortResult;
  }

  return ok({
    loadOrder: sortResult.value,
    degradationWarnings,
  });
};

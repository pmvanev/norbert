/// Dependency Resolver — topological sort with semver range validation.
///
/// Pipeline: validate versions -> build adjacency graph -> Kahn's algorithm
/// Pure functions operating on PluginManifest arrays.
/// Returns Result<readonly string[], string> — ordered plugin IDs or error.

import type { PluginManifest } from "./types";
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
const validateDependency = (
  pluginId: string,
  dependencyId: string,
  requiredRange: string,
  manifestMap: ReadonlyMap<string, PluginManifest>
): string | null => {
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
  manifestMap: ReadonlyMap<string, PluginManifest>
): readonly string[] =>
  manifests.flatMap((manifest) =>
    Object.entries(manifest.dependencies)
      .map(([dependencyId, requiredRange]) =>
        validateDependency(manifest.id, dependencyId, requiredRange, manifestMap)
      )
      .filter((error): error is string => error !== null)
  );

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

/// Builds a directed acency graph: edges from dependency -> dependent.
/// In-degree counts how many dependencies a plugin has among the manifest set.
const buildDependencyGraph = (
  manifests: readonly PluginManifest[],
  manifestMap: ReadonlyMap<string, PluginManifest>
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
      if (manifestMap.has(dependencyId)) {
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
/// 2. Validate all dependencies (missing + version mismatch)
/// 3. Build dependency graph
/// 4. Topological sort via Kahn's algorithm
///
/// Returns: Result containing ordered plugin IDs (load order) or error message.
export const resolveDependencies = (
  manifests: readonly PluginManifest[]
): Result<readonly string[]> => {
  if (manifests.length === 0) {
    return ok([]);
  }

  // Build lookup map
  const manifestMap = new Map(manifests.map((m) => [m.id, m]));

  // Validate all dependencies first (missing + version mismatch)
  const validationErrors = validateAllDependencies(manifests, manifestMap);
  if (validationErrors.length > 0) {
    return err(validationErrors.join("\n"));
  }

  // Build graph and sort
  const graph = buildDependencyGraph(manifests, manifestMap);
  return topologicalSort(graph);
};

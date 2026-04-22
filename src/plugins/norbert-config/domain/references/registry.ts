/**
 * Reference Registry
 *
 * Pure domain module that indexes an AggregatedConfig by item name and
 * absolute file path so cross-reference resolution (US-101) can answer
 * "is this name a real config item?" and "which entry lives at this path?"
 * in O(1).
 *
 * Driving port (architecture sec 6.1):
 *   buildRegistry(config, prevVersion) -> ReferenceRegistry   -- pure derivation
 *   lookupByName(reg, name)            -> readonly RegistryEntry[]
 *   lookupByPath(reg, path)            -> RegistryEntry | null
 *
 * Constraints:
 *   - Pure functions only (no classes, no mutation of inputs)
 *   - Readonly types throughout
 *   - No React, no Tauri, no IO
 *
 * Iteration over config collections (skills/commands/agents/hooks/mcp/...)
 * lands in step 01-02. This module currently produces an empty registry
 * regardless of input; lookups still work correctly against empty maps.
 */
import type { AggregatedConfig, ConfigScope } from "../types";

// ---------------------------------------------------------------------------
// RefType -- the kinds of config items the registry can index
// ---------------------------------------------------------------------------

export type RefType =
  | "agent"
  | "command"
  | "skill"
  | "hook"
  | "mcp"
  | "rule"
  | "plugin";

// ---------------------------------------------------------------------------
// RegistryEntry -- one indexed config item
// ---------------------------------------------------------------------------

export interface RegistryEntry {
  readonly type: RefType;
  readonly scope: ConfigScope;
  readonly source: string;
  readonly name: string;
  readonly filePath: string;
  readonly itemKey: string;
}

// ---------------------------------------------------------------------------
// ReferenceRegistry -- the indexed structure consumed by resolution/detection
// ---------------------------------------------------------------------------

export interface ReferenceRegistry {
  readonly byName: ReadonlyMap<string, readonly RegistryEntry[]>;
  readonly byFilePath: ReadonlyMap<string, RegistryEntry>;
  readonly version: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a ReferenceRegistry from an AggregatedConfig.
 *
 * `prevVersion` is the version of the previous registry build; the returned
 * registry's `version` is strictly greater so downstream memoisation can
 * distinguish a fresh build from an uninitialised state.
 *
 * Step 01-01 stub: produces an empty registry regardless of input. Iteration
 * over `config` collections lands in step 01-02.
 */
export function buildRegistry(
  _config: AggregatedConfig,
  prevVersion: number,
): ReferenceRegistry {
  return {
    byName: new Map<string, readonly RegistryEntry[]>(),
    byFilePath: new Map<string, RegistryEntry>(),
    version: prevVersion + 1,
  };
}

/**
 * Look up registry entries by item name. Returns an empty array when the name
 * is unknown. Multiple entries indicate cross-scope name collisions.
 */
export function lookupByName(
  reg: ReferenceRegistry,
  name: string,
): readonly RegistryEntry[] {
  return reg.byName.get(name) ?? [];
}

/**
 * Look up the unique registry entry for an absolute file path. Returns null
 * when no entry is indexed at that path.
 */
export function lookupByPath(
  reg: ReferenceRegistry,
  path: string,
): RegistryEntry | null {
  return reg.byFilePath.get(path) ?? null;
}

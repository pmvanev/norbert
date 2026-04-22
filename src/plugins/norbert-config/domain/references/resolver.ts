/**
 * Reference Resolver
 *
 * Pure domain module that resolves a Reference (a name- or path-shaped lookup
 * target) against a ReferenceRegistry to one of four outcomes:
 *
 *   - live        -- exactly one registry entry matches
 *   - ambiguous   -- two or more registry entries match (candidates returned in
 *                    registry insertion order; sorting and scope precedence are
 *                    a ScopePrecedence concern per architecture sec 6.4 /
 *                    ADR-004, not this module's)
 *   - dead        -- no registry entry matches; the full set of ConfigScopes
 *                    the registry covers is reported, informing the dead-token
 *                    tooltip per US-101 AC
 *   - unsupported -- a path-shaped reference points under `.claude/<category>/`
 *                    where the category is not one of the surfaces the plugin
 *                    exposes (the location is recognised but the item type
 *                    cannot be surfaced); closes US-101 AC bullet 4
 *
 * Driving port (this module's public surface):
 *   resolve(ref, registry) -> ResolvedRef   -- pure derivation
 *
 * The Reference shape carries a `value` (the lookup target) and a `kind`
 * discriminator selecting which registry surface to query. This deliberately
 * differs from architecture sec 6.3's source-syntax-flavoured discriminant
 * (markdown-link | inline-code) -- see roadmap-review-phase-02.yaml. The
 * deviation will be back-propagated to DESIGN during finalize; do not silently
 * conform to the architecture shape here.
 *
 * Constraints:
 *   - Pure functions only (no classes, no mutation of inputs)
 *   - Synchronous (no Promise return)
 *   - Readonly types throughout
 *   - No React, no Tauri, no node:* imports
 */

import type { ConfigScope } from "../types";
import {
  lookupByName,
  lookupByPath,
  REGISTRY_CATEGORIES,
  REGISTRY_SCOPES,
  type ReferenceRegistry,
  type RegistryEntry,
} from "./registry";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Reference =
  | { readonly kind: "name"; readonly value: string }
  | { readonly kind: "path"; readonly value: string };

export type ResolvedRef =
  | { readonly tag: "live"; readonly entry: RegistryEntry }
  | { readonly tag: "ambiguous"; readonly candidates: readonly RegistryEntry[] }
  | { readonly tag: "dead"; readonly searchedScopes: readonly ConfigScope[] }
  | {
      readonly tag: "unsupported";
      readonly path: string;
      readonly category: string;
      readonly reason: string;
    };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the path segment immediately after `.claude` from a forward- or
 * backward-slashed path. Returns `null` when `.claude` is not present as a
 * standalone segment, or when no segment follows it.
 *
 * Pure JS string transform -- no node:path -- so the domain stays
 * platform-agnostic and the dependency-cruiser boundary rule against node:*
 * under domain/** holds.
 */
function extractDotClaudeCategory(path: string): string | null {
  const segments = path.split(/[/\\]/);
  const claudeIndex = segments.indexOf(".claude");
  if (claudeIndex === -1) {
    return null;
  }
  const next = segments[claudeIndex + 1];
  if (next === undefined || next === "") {
    return null;
  }
  return next;
}

function resolveNameReference(value: string, registry: ReferenceRegistry): ResolvedRef {
  const matches = lookupByName(registry, value);
  if (matches.length === 1) {
    return { tag: "live", entry: matches[0]! };
  }
  if (matches.length >= 2) {
    return { tag: "ambiguous", candidates: matches };
  }
  return { tag: "dead", searchedScopes: REGISTRY_SCOPES };
}

function resolvePathReference(value: string, registry: ReferenceRegistry): ResolvedRef {
  const hit = lookupByPath(registry, value);
  if (hit !== null) {
    return { tag: "live", entry: hit };
  }

  const category = extractDotClaudeCategory(value);
  if (category !== null && !REGISTRY_CATEGORIES.includes(category)) {
    return {
      tag: "unsupported",
      path: value,
      category,
      reason: `under .claude/ but not a recognised category (${REGISTRY_CATEGORIES.join(", ")}); got "${category}"`,
    };
  }

  return { tag: "dead", searchedScopes: REGISTRY_SCOPES };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a Reference against a ReferenceRegistry.
 *
 * Dispatches on `ref.kind`:
 *   - `name` -> exact-name match; one hit live, multiple hits ambiguous,
 *               no hits dead
 *   - `path` -> exact-path match; on miss, `.claude/<unknown-category>/`
 *               yields unsupported, all other misses yield dead
 */
export function resolve(ref: Reference, registry: ReferenceRegistry): ResolvedRef {
  switch (ref.kind) {
    case "name":
      return resolveNameReference(ref.value, registry);
    case "path":
      return resolvePathReference(ref.value, registry);
    default: {
      // Exhaustiveness check -- a new `Reference` kind must add a case here.
      const _exhaustive: never = ref;
      return _exhaustive;
    }
  }
}

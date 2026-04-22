/**
 * Reference Resolver
 *
 * Pure domain module that resolves a Reference (a name- or path-shaped lookup
 * target) against a ReferenceRegistry to one of four outcomes:
 *
 *   - live        -- exactly one registry entry matches
 *   - ambiguous   -- two or more registry entries match
 *   - dead        -- no registry entry matches; the searched scopes are reported
 *   - unsupported -- a path-shaped reference points at an item type the plugin
 *                    does not expose
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
 *
 * Step 02-01 implements only the `kind: 'name'` -> single-match -> live path.
 * The other ResolvedRef variants land in 02-02..02-04 as their scenarios are
 * un-skipped one at a time. The placeholder fallback returns a `dead` outcome
 * with an empty searchedScopes list so it is distinguishable from a real
 * dead-reference result once 02-03 fills in the searched scopes.
 */

import type { ConfigScope } from "../types";
import { lookupByName, type ReferenceRegistry, type RegistryEntry } from "./registry";

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
  | { readonly tag: "unsupported"; readonly path: string; readonly reason: string };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a Reference against a ReferenceRegistry.
 *
 * Step 02-01: only `kind: 'name'` with exactly one matching entry returns the
 * live outcome. All other input shapes (and unmatched / ambiguous names) fall
 * through to a placeholder dead outcome with no searched scopes; subsequent
 * steps refine each branch.
 */
export function resolve(ref: Reference, registry: ReferenceRegistry): ResolvedRef {
  if (ref.kind === "name") {
    const matches = lookupByName(registry, ref.value);
    if (matches.length === 1) {
      return { tag: "live", entry: matches[0]! };
    }
  }

  // Placeholder fallback for all not-yet-implemented branches. Refined in
  // 02-02 (ambiguous), 02-03 (dead w/ searched scopes), 02-04 (unsupported).
  return { tag: "dead", searchedScopes: [] };
}

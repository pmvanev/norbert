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
 * Step 02-02 adds the `kind: 'name'` -> multi-match -> ambiguous branch.
 * Step 02-03 refines the `kind: 'name'` -> no-match path to return a `dead`
 * outcome reporting the full set of ConfigScopes that were searched. The
 * scope list is a module-level constant so the resolver does not reach into
 * the registry's internal scope set -- the registry is built from all three
 * scopes' worth of input by contract, so returning the full set is correct
 * and observable for the dead-token tooltip per US-101 AC.
 * Candidate ordering is preserved as registry insertion order; sorting and
 * scope precedence are deliberately NOT this module's concern -- per
 * architecture sec 6.4 / ADR-004 they belong to ScopePrecedence so the
 * resolver stays a pure derivation independent of policy.
 *
 * The path branch (`kind: 'path'`) still falls through to the placeholder
 * dead outcome for now; 02-04 adds the unsupported branch.
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
// Module constants
// ---------------------------------------------------------------------------

/**
 * The full set of ConfigScopes a registry indexes across. The registry is
 * built from user-, project-, and plugin-scope input by contract, so a name
 * miss has searched all three. Held as a module-level constant so the
 * resolver does not reach into the registry's internal scope set.
 */
const SEARCHED_SCOPES: readonly ConfigScope[] = ["user", "project", "plugin"];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a Reference against a ReferenceRegistry.
 *
 * Implemented branches:
 *   - `kind: 'name'` with exactly one matching entry -> live
 *   - `kind: 'name'` with two or more matching entries -> ambiguous
 *     (candidates passed through in registry insertion order; sorting is a
 *     ScopePrecedence concern per architecture sec 6.4 / ADR-004)
 *   - `kind: 'name'` with no matching entry -> dead (searchedScopes lists
 *     every ConfigScope the registry covers, informing the dead-token tooltip)
 *
 * The path branch (`kind: 'path'`) still falls through to the dead outcome
 * for now; 02-04 adds the unsupported branch.
 */
export function resolve(ref: Reference, registry: ReferenceRegistry): ResolvedRef {
  if (ref.kind === "name") {
    const matches = lookupByName(registry, ref.value);
    if (matches.length === 1) {
      return { tag: "live", entry: matches[0]! };
    }
    if (matches.length >= 2) {
      return { tag: "ambiguous", candidates: matches };
    }
    return { tag: "dead", searchedScopes: SEARCHED_SCOPES };
  }

  // Placeholder fallback for the path branch; 02-04 adds the unsupported branch.
  return { tag: "dead", searchedScopes: SEARCHED_SCOPES };
}

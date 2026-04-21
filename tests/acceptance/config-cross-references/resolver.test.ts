/**
 * Acceptance tests: ReferenceResolver (config-cross-references)
 *
 * Validates the pure resolve(ref, registry) port per architecture.md section 6.3.
 * The resolver returns one of four discriminated outcomes -- live | ambiguous |
 * dead | unsupported -- and is pure (no React, no I/O).
 *
 * Driving port: resolve(ref, registry) -> ResolvedRef. Pure function.
 *
 * Traces to:
 *   user-stories.md US-101 (four reference variants)
 *   architecture.md section 6.3 (ResolvedRef discriminated union)
 *   walking-skeleton.feature
 *     -- Reference to an unsupported item type renders as an unsupported token
 *   detection.test.ts -- the resolver feeds the detection annotation
 *
 * NOTE: All scenarios are it.skip per the implement-one-at-a-time strategy.
 *       The first live anchor remains in registry.test.ts.
 */

import { describe, it } from "vitest";

// @walking_skeleton @driving_port
describe("Resolving a reference whose name matches a single registry entry returns the live outcome", () => {
  it.skip("resolve({ kind: 'name', value: 'nw-bdd-requirements' }, registry) returns { tag: 'live', entry: <user-scope skill> }", () => {
    // Driving port:
    //   const result = resolve({ kind: 'name', value: 'nw-bdd-requirements' }, registry);
    // Then:
    //   result.tag === 'live'
    //   result.entry.type === 'skill'
    //   result.entry.scope === 'user'
    //   result.entry.name === 'nw-bdd-requirements'
  });
});

// @walking_skeleton @driving_port
describe("Resolving a reference whose name matches two or more registry entries returns the ambiguous outcome", () => {
  it.skip("resolve({ kind: 'name', value: 'release' }, registry) returns { tag: 'ambiguous', candidates: [project, user] }", () => {
    // Driving port:
    //   const result = resolve({ kind: 'name', value: 'release' }, ambiguousReleaseRegistry);
    // Then:
    //   result.tag === 'ambiguous'
    //   result.candidates.length >= 2
    //   result.candidates.map(c => c.scope).sort() includes 'project' and 'user'
  });
});

// @walking_skeleton @driving_port
describe("Resolving a reference that matches no registry entry returns the dead outcome with the searched scopes", () => {
  it.skip("resolve({ kind: 'name', value: 'nw-retired-skill' }, registry) returns { tag: 'dead', searchedScopes: [...] }", () => {
    // Driving port:
    //   const result = resolve({ kind: 'name', value: 'nw-retired-skill' }, walkingSkeletonRegistry);
    // Then:
    //   result.tag === 'dead'
    //   result.searchedScopes is a non-empty list of ConfigScope values
    //   (architecture sec 6.3 -- 'dead' when both lookupByName and lookupByPath miss)
  });
});

// @walking_skeleton @driving_port
describe("Resolving a file-path reference to an item type the plugin does not expose returns the unsupported outcome", () => {
  it.skip("resolve({ kind: 'path', value: '~/.claude/unknown-kind/foo.bin' }, registry) returns { tag: 'unsupported', path, reason }", () => {
    // Driving port:
    //   const result = resolve({ kind: 'path', value: '~/.claude/unknown-kind/foo.bin' }, registry);
    // Then:
    //   result.tag === 'unsupported'
    //   result.path === '~/.claude/unknown-kind/foo.bin'
    //   typeof result.reason === 'string' && result.reason.length > 0
    //   (architecture sec 6.3 -- 'unsupported' when the path resolves to an item
    //    type the plugin does not expose; closes PO MEDIUM #1 / US-101 AC bullet 4.)
  });
});

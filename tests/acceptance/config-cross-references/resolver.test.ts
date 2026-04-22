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

import { describe, it, expect } from "vitest";
import { ambiguousReleaseConfig, walkingSkeletonConfig } from "./_helpers/fixtures";
import { buildRegistry } from "../../../src/plugins/norbert-config/domain/references/registry";
import { resolve } from "../../../src/plugins/norbert-config/domain/references/resolver";

// @walking_skeleton @driving_port
describe("Resolving a reference whose name matches a single registry entry returns the live outcome", () => {
  it("resolve({ kind: 'name', value: 'nw-bdd-requirements' }, registry) returns { tag: 'live', entry: <user-scope skill> }", () => {
    const registry = buildRegistry(walkingSkeletonConfig, 0);

    const result = resolve({ kind: "name", value: "nw-bdd-requirements" }, registry);

    expect(result.tag).toBe("live");
    if (result.tag !== "live") {
      throw new Error("Expected live outcome");
    }
    expect(result.entry.type).toBe("skill");
    expect(result.entry.scope).toBe("user");
    expect(result.entry.name).toBe("nw-bdd-requirements");
  });
});

// @walking_skeleton @driving_port
describe("Resolving a reference whose name matches two or more registry entries returns the ambiguous outcome", () => {
  it("resolve({ kind: 'name', value: 'release' }, registry) returns { tag: 'ambiguous', candidates: [project, user] }", () => {
    const registry = buildRegistry(ambiguousReleaseConfig, 0);

    const result = resolve({ kind: "name", value: "release" }, registry);

    expect(result.tag).toBe("ambiguous");
    if (result.tag !== "ambiguous") {
      throw new Error("Expected ambiguous outcome");
    }
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    const scopes = result.candidates.map((c) => c.scope);
    expect(scopes).toContain("project");
    expect(scopes).toContain("user");

    // Determinism: ordering preserved across calls for the same registry
    // (architecture sec 6.4 / ADR-004 -- sorting is a ScopePrecedence concern).
    const second = resolve({ kind: "name", value: "release" }, registry);
    if (second.tag !== "ambiguous") {
      throw new Error("Expected ambiguous outcome on second call");
    }
    expect(second.candidates.map((c) => c.itemKey)).toEqual(
      result.candidates.map((c) => c.itemKey),
    );
  });
});

// @walking_skeleton @driving_port
describe("Resolving a reference that matches no registry entry returns the dead outcome with the searched scopes", () => {
  it("resolve({ kind: 'name', value: 'nw-retired-skill' }, registry) returns { tag: 'dead', searchedScopes: [...] }", () => {
    const registry = buildRegistry(walkingSkeletonConfig, 0);

    const result = resolve({ kind: "name", value: "nw-retired-skill" }, registry);

    expect(result.tag).toBe("dead");
    if (result.tag !== "dead") {
      throw new Error("Expected dead outcome");
    }
    // searchedScopes informs the dead-token tooltip per US-101 AC
    // (architecture sec 6.3 -- 'dead' when both lookupByName and lookupByPath miss).
    expect(result.searchedScopes.length).toBeGreaterThan(0);
    // Every entry must be a valid ConfigScope literal.
    for (const scope of result.searchedScopes) {
      expect(["user", "project", "plugin"]).toContain(scope);
    }
    // Resolver does not throw on a dead outcome (executing this far proves it).
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

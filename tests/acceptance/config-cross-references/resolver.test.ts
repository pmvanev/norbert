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
 * NOTE: All four ResolvedRef-variant scenarios are live as of Phase 02
 *       completion. Additional mutation-coverage scenarios are also live.
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
    // Pin the full three-scope set without over-constraining ordering: a
    // regression returning a single-element list would pass the per-element
    // membership loop above but fail this arrayContaining assertion.
    expect(result.searchedScopes).toEqual(
      expect.arrayContaining(["user", "project", "plugin"]),
    );
    // Resolver does not throw on a dead outcome (executing this far proves it).
  });
});

// @walking_skeleton @driving_port
describe("Resolving a file-path reference to an item type the plugin does not expose returns the unsupported outcome", () => {
  it("resolve({ kind: 'path', value: '~/.claude/unknown-kind/foo.bin' }, registry) returns { tag: 'unsupported', path, reason }", () => {
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const unsupportedPath = "~/.claude/unknown-kind/foo.bin";

    const result = resolve({ kind: "path", value: unsupportedPath }, registry);

    expect(result.tag).toBe("unsupported");
    if (result.tag !== "unsupported") {
      throw new Error("Expected unsupported outcome");
    }
    expect(result.path).toBe(unsupportedPath);
    // Typed `category` field is the structured datum future UI consumers
    // (DisambiguationPopover, dead-token tooltip) read directly without
    // parsing the human-readable reason string.
    expect(result.category).toBe("unknown-kind");
    // The reason must be a non-empty string identifying the unsupported
    // category (architecture sec 6.3 -- 'unsupported' when the path resolves
    // to an item type the plugin does not expose; closes PO MEDIUM #1 /
    // US-101 AC bullet 4).
    expect(typeof result.reason).toBe("string");
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.reason).toContain("unknown-kind");

    // Regression guard: a path that DOES point at a supported, registered
    // item type still resolves as live via lookupByPath.
    const liveResult = resolve(
      { kind: "path", value: "~/.claude/skills/nw-bdd-requirements/SKILL.md" },
      registry,
    );
    expect(liveResult.tag).toBe("live");
    if (liveResult.tag !== "live") {
      throw new Error("Expected live outcome for supported path");
    }
    expect(liveResult.entry.type).toBe("skill");
    expect(liveResult.entry.name).toBe("nw-bdd-requirements");
  });
});

// ---------------------------------------------------------------------------
// Mutation-coverage tests
//
// These tests target boundary-, string-literal-, and dispatch-mutants that
// the four "happy outcome" scenarios above leave alive (verified via Stryker
// against stryker.config-cross-references-resolver.conf.json). Each block
// below names the mutant family it kills so future readers can map a fail
// back to a behavioural rule rather than a "magic" assertion.
// ---------------------------------------------------------------------------

// @mutation_coverage
describe("Resolving a path that does not lie under .claude returns the dead outcome (extractDotClaudeCategory miss branch)", () => {
  it.each([
    ["/tmp/random/file.txt", "leading-slash path with no .claude segment"],
    // No-leading-slash path whose first segment ('agents') happens to be a
    // SUPPORTED_CATEGORIES literal. Locks the dead outcome when the first
    // segment of a non-.claude path coincides with a supported category.
    ["agents/foo.md", "no-.claude path whose first segment matches a supported category"],
    // No-leading-slash path whose first segment is NOT a supported category.
    // If the L100 early-return guard
    // (`if (claudeIndex === -1) return null`) is mutated to `if (false)` or
    // to an empty body, `extractDotClaudeCategory` would skip the guard,
    // compute `next = segments[indexOf(.claude) + 1] = segments[0] = 'tmp'`,
    // return `'tmp'` to `resolvePathReference`, and -- because 'tmp' is NOT
    // in SUPPORTED_CATEGORIES -- the resolver would return `unsupported`
    // instead of `dead`. The dead expectation pins the early return.
    ["tmp/random/file.txt", "no-.claude path whose first segment is not a supported category"],
  ])("resolve({ kind: 'path', value: %s }) returns dead (%s)", (pathValue) => {
    const registry = buildRegistry(walkingSkeletonConfig, 0);

    const result = resolve({ kind: "path", value: pathValue }, registry);

    expect(result.tag).toBe("dead");
    if (result.tag !== "dead") {
      throw new Error(`Expected dead outcome for non-.claude path ${pathValue}`);
    }
    expect(result.searchedScopes.length).toBeGreaterThan(0);
    for (const scope of result.searchedScopes) {
      expect(["user", "project", "plugin"]).toContain(scope);
    }
  });
});

// @mutation_coverage
describe("Resolving a path that ends exactly at .claude with no segment after returns the dead outcome (no category to inspect)", () => {
  it.each([
    ["~/.claude", "trailing .claude with no slash -> next === undefined"],
    ["~/.claude/", "trailing slash -> next === ''"],
  ])("resolve({ kind: 'path', value: %s }) returns dead (%s)", (pathValue) => {
    // Kills the L104 ConditionalExpression / LogicalOperator / StringLiteral
    // mutants in `extractDotClaudeCategory`'s second guard
    // (`next === undefined || next === ""`). Without these inputs, the guard
    // is exercised only when `next` is a real category name.
    const registry = buildRegistry(walkingSkeletonConfig, 0);

    const result = resolve({ kind: "path", value: pathValue }, registry);

    expect(result.tag).toBe("dead");
    if (result.tag !== "dead") {
      throw new Error(`Expected dead outcome for path ${pathValue}`);
    }
  });
});

// @mutation_coverage
describe("Resolving a path under a SUPPORTED .claude category that misses the registry returns the dead outcome (not unsupported)", () => {
  it("resolve({ kind: 'path', value: '~/.claude/skills/never-registered/SKILL.md' }) returns dead", () => {
    // Kills the L128 LogicalOperator and ConditionalExpression mutants
    // (`category !== null && !SUPPORTED_CATEGORIES.includes(category)`).
    // Mutating `&&` -> `||` or the predicate -> `true` would push this
    // input -- which uses a SUPPORTED category but is not in the registry --
    // into the `unsupported` branch. The dead expectation pins the AND.
    const registry = buildRegistry(walkingSkeletonConfig, 0);

    const result = resolve(
      { kind: "path", value: "~/.claude/skills/never-registered/SKILL.md" },
      registry,
    );

    expect(result.tag).toBe("dead");
    if (result.tag !== "dead") {
      throw new Error("Expected dead outcome for unregistered path under supported category");
    }
  });
});

// @mutation_coverage
describe("The unsupported reason names every supported category and the offending category, joined by ', '", () => {
  it("reason contains each SUPPORTED_CATEGORIES entry, the joiner, and the offending category", () => {
    // Kills the L132 StringLiteral mutant (`", "` -> `""`) and the L75-81
    // StringLiteral / L74 ArrayDeclaration mutants on SUPPORTED_CATEGORIES
    // by asserting each canonical category name appears verbatim in the
    // reason and that the join uses ", " as the separator.
    const registry = buildRegistry(walkingSkeletonConfig, 0);

    const result = resolve(
      { kind: "path", value: "~/.claude/unknown-kind/foo.bin" },
      registry,
    );

    expect(result.tag).toBe("unsupported");
    if (result.tag !== "unsupported") {
      throw new Error("Expected unsupported outcome");
    }

    // Each SUPPORTED_CATEGORIES literal must appear in the reason.
    for (const category of [
      "agents",
      "commands",
      "skills",
      "hooks",
      "mcpServers",
      "rules",
      "plugins",
    ]) {
      expect(result.reason).toContain(category);
    }

    // The join separator must be ", " (kills the join("") mutant).
    expect(result.reason).toContain("agents, commands");
    expect(result.reason).toContain("rules, plugins");

    // The offending category must be quoted in the reason.
    expect(result.reason).toContain('"unknown-kind"');
  });
});


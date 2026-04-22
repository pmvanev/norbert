/**
 * Acceptance tests: Reference Registry (config-cross-references)
 *
 * Validates the pure ReferenceRegistry domain module that indexes the
 * AggregatedConfig by item name and absolute file path. These tests cover
 * the integration-seam prop contract (architecture.md section 6.1) and the
 * registry behaviour required by US-101 and the ambiguous-resolution flow.
 *
 * Driving port: buildRegistry(aggregatedConfig, prevVersion), lookupByName,
 * lookupByPath -- all pure, no React, no Tauri.
 *
 * Traces to:
 *   walking-skeleton.feature
 *     -- Markdown link to a known skill renders as a live cross-reference token
 *     -- Reference resolving to multiple items renders as an ambiguous token
 *     -- Loading state with no aggregated configuration renders no tokens and no crash
 *   user-stories.md US-101 acceptance criteria
 *
 * NOTE: First scenario is live to anchor the outer-loop failure.
 *       All other scenarios use it.skip pending one-at-a-time DELIVER work.
 */

import { describe, it, expect } from "vitest";
import {
  emptyAggregatedConfig,
  walkingSkeletonConfig,
  ambiguousReleaseConfig,
  makeAggregatedConfig,
  makeSkill,
  makeCommand,
} from "./_helpers/fixtures";

// ---------------------------------------------------------------------------
// Driving-port import. Will not exist until DELIVER wave creates the module.
// The first live scenario asserts a behaviour, not just module presence.
// ---------------------------------------------------------------------------

import { buildRegistry, lookupByName, lookupByPath } from "../../../src/plugins/norbert-config/domain/references/registry";

// =====================================================================
// US-101 / Walking Skeleton -- integration-seam prop contract
// =====================================================================

// @walking_skeleton @driving_port
describe("Loading state with no aggregated configuration renders no tokens and no crash", () => {
  it("buildRegistry returns an empty registry when given an empty aggregated config", () => {
    const registry = buildRegistry(emptyAggregatedConfig, 0);

    expect(registry.byName.size).toBe(0);
    expect(registry.byFilePath.size).toBe(0);
    expect(registry.version).toBeGreaterThan(0);
  });
});

// @walking_skeleton @driving_port
describe("Markdown link to a known skill resolves through the registry", () => {
  it("lookupByName returns the user-scope skill nw-bdd-requirements as a single live entry", () => {
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const matches = lookupByName(registry, "nw-bdd-requirements");

    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("skill");
    expect(matches[0].scope).toBe("user");
    expect(matches[0].name).toBe("nw-bdd-requirements");
  });

  it("lookupByPath resolves the absolute markdown link href to the same registry entry", () => {
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const entry = lookupByPath(
      registry,
      "~/.claude/skills/nw-bdd-requirements/SKILL.md",
    );

    expect(entry).not.toBeNull();
    expect(entry?.type).toBe("skill");
    expect(entry?.name).toBe("nw-bdd-requirements");
  });
});

// @walking_skeleton @driving_port
describe("Reference resolving to multiple items renders as an ambiguous token", () => {
  it("lookupByName for an ambiguous name returns all matching candidates", () => {
    const registry = buildRegistry(ambiguousReleaseConfig, 0);
    const candidates = lookupByName(registry, "release");

    expect(candidates.length).toBeGreaterThanOrEqual(2);
    const scopes = candidates.map((c) => c.scope).sort();
    expect(scopes).toContain("project");
    expect(scopes).toContain("user");
  });
});

// @walking_skeleton @driving_port
describe("Reference to a missing item is reported as not present in the registry", () => {
  it.skip("lookupByName returns an empty list for an unknown name", () => {
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const matches = lookupByName(registry, "nw-retired-skill");

    expect(matches).toHaveLength(0);
  });
});

// @walking_skeleton @driving_port
describe("Registry version increments on rebuild for memoisation invalidation", () => {
  it.skip("a rebuild from a different aggregated config produces a strictly greater version", () => {
    const r1 = buildRegistry(emptyAggregatedConfig, 0);
    const r2 = buildRegistry(walkingSkeletonConfig, r1.version);

    expect(r2.version).toBeGreaterThan(r1.version);
  });
});

// @walking_skeleton @driving_port
describe("Cross-scope name collisions appear as separate registry entries", () => {
  it.skip("a skill with the same name in user and project scopes appears twice in lookupByName", () => {
    const config = makeAggregatedConfig({
      skills: [makeSkill("shared", "user"), makeSkill("shared", "project")],
    });
    const registry = buildRegistry(config, 0);

    const matches = lookupByName(registry, "shared");
    expect(matches).toHaveLength(2);
    const scopes = matches.map((m) => m.scope).sort();
    expect(scopes).toEqual(["project", "user"]);
  });
});

// =====================================================================
// NFR-2 -- registry build performance (architecture sec 7)
// 500 items synchronous, sub-millisecond per architecture estimate.
// jsdom + CI variance means we use a generous wall-clock budget here;
// p95 measurement is a DEVOPS-wave concern.
// =====================================================================

// @property @performance @driving_port
describe("buildRegistry with 500 items completes synchronously and produces the correct entry count", () => {
  it.skip("a 500-item AggregatedConfig builds to a registry whose byName.size equals 500 within a generous synchronous budget", () => {
    // Driving port:
    //   const config = make500ItemConfig();   // 100 each of skills, commands,
    //                                          // agents, hooks, mcpServers
    //                                          // (or another spread totalling 500)
    //   const start = performance.now();
    //   const registry = buildRegistry(config, 0);
    //   const elapsed = performance.now() - start;
    //
    // Then:
    //   expect(registry.byName.size).toBe(500);
    //   expect(elapsed).toBeLessThan(100);   // generous: arch estimates sub-ms
    //                                        // for 500 items; jsdom + CI need slack;
    //                                        // p95 budget is DEVOPS scope (KPI #6).
    //
    // (Closes PA HIGH NFR-2 gap. Helper -- to be added by DELIVER crafter to
    //  _helpers/fixtures.ts:
    //    export function make500ItemConfig(): AggregatedConfig {
    //      const skills    = range(100).map((i) => makeSkill(`skill-${i}`,    "user"));
    //      const commands  = range(100).map((i) => makeCommand(`command-${i}`, "project"));
    //      const agents    = range(100).map((i) => makeAgent(`agent-${i}`,    "user"));
    //      const hooks     = range(100).map((i) => makeHook(`hook-${i}.sh`,   "project"));
    //      const mcpServers = range(100).map((i) => makeMcpServer(`mcp-${i}`,  "user"));
    //      return makeAggregatedConfig({ skills, commands, agents, hooks, mcpServers });
    //    }
    // )
  });
});

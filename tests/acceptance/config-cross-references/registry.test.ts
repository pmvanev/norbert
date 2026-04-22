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
  make500ItemConfig,
  makeAggregatedConfig,
  makeSkill,
  makeCommand,
  makeAgent,
  makeHook,
  makeMcpServer,
  makePlugin,
  makeRule,
} from "./_helpers/fixtures";
import type { AgentParseResult } from "../../../src/plugins/norbert-config/domain/types";

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
  it("a 500-item AggregatedConfig builds to a registry whose byName.size equals 500 within a generous synchronous budget", () => {
    const config = make500ItemConfig();

    const start = performance.now();
    const registry = buildRegistry(config, 0);
    const elapsed = performance.now() - start;

    // buildRegistry is synchronous: returns a registry value, not a Promise.
    expect(registry).not.toBeInstanceOf(Promise);
    expect(registry.byName.size).toBe(500);
    // Generous budget: architecture estimates sub-millisecond for 500 items;
    // 100 ms accommodates jsdom + CI variance. Tighter p95 budgets are
    // DEVOPS-wave scope (KPI #6).
    expect(elapsed).toBeLessThan(100);
  });
});

// =====================================================================
// RegistryEntry projection contract -- per-RefType field shape.
//
// The projector functions (entryFromCommand, entryFromAgent, entryFromHook,
// entryFromMcpServer, entryFromRule, entryFromPlugin) each populate the
// RegistryEntry shape with the type-specific fields. These tests exist so
// any future projector that accidentally drops `name`, `type`, `scope`, or
// `source` (or returns a stringly-empty value) is caught at the registry
// boundary rather than leaking into the cross-reference resolver.
// =====================================================================

// @driving_port @projection_contract
describe("RegistryEntry projection preserves identifying fields per RefType", () => {
  it("a command projects to a registry entry with type='command' and the command's name, scope, source, and filePath", () => {
    const command = makeCommand("deploy", "project");
    const config = makeAggregatedConfig({ commands: [command] });
    const registry = buildRegistry(config, 0);

    const matches = lookupByName(registry, "deploy");
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("command");
    expect(matches[0].name).toBe("deploy");
    expect(matches[0].scope).toBe("project");
    expect(matches[0].source).toBe("project");
    expect(matches[0].filePath).toBe(command.filePath);
    expect(matches[0].itemKey).toBe("command:project:deploy");
  });

  it("an agent projects to a registry entry with type='agent' and the agent's name, scope, source, and filePath", () => {
    const agent = makeAgent("planner", "user");
    const config = makeAggregatedConfig({ agents: [agent] });
    const registry = buildRegistry(config, 0);

    const matches = lookupByName(registry, "planner");
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("agent");
    expect(matches[0].name).toBe("planner");
    expect(matches[0].scope).toBe("user");
    expect(matches[0].source).toBe("user");
    expect(matches[0].filePath).toBe(agent.filePath);
    expect(matches[0].itemKey).toBe("agent:user:planner");
  });

  it("a hook projects to a registry entry whose name is the basename of its filePath and type is 'hook'", () => {
    const hook = makeHook("pre-commit.sh", "project");
    const config = makeAggregatedConfig({ hooks: [hook] });
    const registry = buildRegistry(config, 0);

    const matches = lookupByName(registry, "pre-commit.sh");
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("hook");
    expect(matches[0].name).toBe("pre-commit.sh");
    expect(matches[0].scope).toBe("project");
    expect(matches[0].source).toBe("project");
    expect(matches[0].filePath).toBe(hook.filePath);
    expect(matches[0].itemKey).toBe("hook:project:pre-commit.sh");
  });

  it("an mcp server projects to a registry entry with type='mcp' and the server's name, scope, source, and filePath", () => {
    const server = makeMcpServer("filesystem", "user");
    const config = makeAggregatedConfig({ mcpServers: [server] });
    const registry = buildRegistry(config, 0);

    const matches = lookupByName(registry, "filesystem");
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("mcp");
    expect(matches[0].name).toBe("filesystem");
    expect(matches[0].scope).toBe("user");
    expect(matches[0].source).toBe("settings.json");
    expect(matches[0].filePath).toBe(server.filePath);
    expect(matches[0].itemKey).toBe("mcp:user:filesystem");
  });

  it("a rule projects to a registry entry with type='rule' and the basename of its filePath as the name", () => {
    const rule = makeRule("Always use TypeScript strict mode.", "project");
    const config = makeAggregatedConfig({ rules: [rule] });
    const registry = buildRegistry(config, 0);

    // makeRule sets filePath to '.claude/CLAUDE.md' for project scope, so
    // basename is 'CLAUDE.md'.
    const matches = lookupByName(registry, "CLAUDE.md");
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("rule");
    expect(matches[0].name).toBe("CLAUDE.md");
    expect(matches[0].scope).toBe("project");
    expect(matches[0].source).toBe("project");
    expect(matches[0].filePath).toBe(rule.filePath);
    expect(matches[0].itemKey).toBe("rule:project:CLAUDE.md");
  });

  it("a plugin projects to a registry entry whose source field equals the plugin's name (not its scope)", () => {
    const plugin = makePlugin("nw-wave");
    const config = makeAggregatedConfig({ plugins: [plugin] });
    const registry = buildRegistry(config, 0);

    const matches = lookupByName(registry, "nw-wave");
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("plugin");
    expect(matches[0].name).toBe("nw-wave");
    expect(matches[0].scope).toBe("plugin");
    // Plugin is the only RefType where `source` is the plugin's own name
    // rather than the scope token. Asserting this here pins the contract.
    expect(matches[0].source).toBe("nw-wave");
    expect(matches[0].filePath).toBe(plugin.filePath);
    expect(matches[0].itemKey).toBe("plugin:plugin:nw-wave");
  });
});

// =====================================================================
// Path normalisation contract -- the structural-equivalence rules.
//
// lookupByPath compares paths structurally so equivalent forms collide on
// the same registry entry. These tests exercise each rule individually so
// a regression in one rule (e.g., dropping the backslash conversion) is
// caught by a single failing assertion, not buried in a composite.
// =====================================================================

// @driving_port @path_normalisation
describe("normalisePath equivalence rules expose the same registry entry", () => {
  const skill = makeSkill("nw-rule-of-three", "user");
  const config = makeAggregatedConfig({ skills: [skill] });

  it("a Windows-style backslash path resolves to the same entry as the canonical forward-slash path", () => {
    const registry = buildRegistry(config, 0);
    // The fixture filePath is '~/.claude/skills/nw-rule-of-three/SKILL.md'.
    // A markdown link authored on Windows might use backslashes; the
    // registry must treat them as forward slashes.
    const backslashPath = "~\\.claude\\skills\\nw-rule-of-three\\SKILL.md";

    const entry = lookupByPath(registry, backslashPath);
    expect(entry).not.toBeNull();
    expect(entry?.name).toBe("nw-rule-of-three");
  });

  it("a path with a trailing slash resolves to the same entry as the canonical path", () => {
    const registry = buildRegistry(config, 0);
    const trailingSlashPath = "~/.claude/skills/nw-rule-of-three/SKILL.md/";

    const entry = lookupByPath(registry, trailingSlashPath);
    expect(entry).not.toBeNull();
    expect(entry?.name).toBe("nw-rule-of-three");
  });

  it("a path with interior '/./' segments resolves to the same entry as the canonical path", () => {
    const registry = buildRegistry(config, 0);
    const dotSegmentPath = "~/.claude/./skills/./nw-rule-of-three/SKILL.md";

    const entry = lookupByPath(registry, dotSegmentPath);
    expect(entry).not.toBeNull();
    expect(entry?.name).toBe("nw-rule-of-three");
  });

  it("a path with a leading './' resolves to the same entry as the path without it", () => {
    // Use a project-scope skill whose canonical filePath has no leading './'.
    const projectSkill = makeSkill("nw-detect-smells", "project");
    const projectConfig = makeAggregatedConfig({ skills: [projectSkill] });
    const registry = buildRegistry(projectConfig, 0);
    // Canonical: '.claude/skills/nw-detect-smells/SKILL.md'
    // Author-typed:  './.claude/skills/nw-detect-smells/SKILL.md'
    const leadingDotPath = "./.claude/skills/nw-detect-smells/SKILL.md";

    const entry = lookupByPath(registry, leadingDotPath);
    expect(entry).not.toBeNull();
    expect(entry?.name).toBe("nw-detect-smells");
  });

  it("a single '/' path is preserved (the trailing-slash rule does not strip the root)", () => {
    // An entry indexed at exactly '/' must remain reachable via '/'.
    // We insert a synthetic plugin whose filePath is '/' and verify the
    // root path still resolves. This is a contract-level guard against a
    // mutant that removes the `path.length > 1` guard.
    const rootPlugin = {
      name: "root-marker",
      version: "0.0.0",
      description: "root",
      homepage: "",
      installPath: "/",
      readme: "",
      installedAt: "2026-01-01T00:00:00Z",
      filePath: "/",
      scope: "plugin" as const,
    };
    const rootConfig = makeAggregatedConfig({ plugins: [rootPlugin] });
    const registry = buildRegistry(rootConfig, 0);

    const entry = lookupByPath(registry, "/");
    expect(entry).not.toBeNull();
    expect(entry?.name).toBe("root-marker");
  });
});

// =====================================================================
// AgentParseResult discrimination -- only parsed agents are indexed.
// =====================================================================

// @driving_port @agent_filter
describe("buildRegistry skips agent parse-error results", () => {
  it("an aggregated config containing only an agent parse-error produces an empty byName map", () => {
    const errorResult: AgentParseResult = {
      tag: "error",
      filePath: "~/.claude/agents/broken.md",
      message: "frontmatter parse failed",
    };
    const config = {
      ...emptyAggregatedConfig,
      agents: [errorResult],
    };

    const registry = buildRegistry(config, 0);

    expect(registry.byName.size).toBe(0);
    expect(registry.byFilePath.size).toBe(0);
  });

  it("when one agent parses and another errors, only the parsed agent appears in lookupByName", () => {
    const goodAgent = makeAgent("good-agent", "user");
    const errorResult: AgentParseResult = {
      tag: "error",
      filePath: "~/.claude/agents/broken.md",
      message: "frontmatter parse failed",
    };
    const config = {
      ...emptyAggregatedConfig,
      agents: [
        { tag: "parsed" as const, agent: goodAgent },
        errorResult,
      ],
    };

    const registry = buildRegistry(config, 0);

    expect(registry.byName.size).toBe(1);
    const matches = lookupByName(registry, "good-agent");
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("good-agent");
  });
});

// =====================================================================
// byFilePath first-writer-wins on path collisions.
// =====================================================================

// @driving_port @path_collision
describe("byFilePath retains the first entry on path collisions", () => {
  it("when two entries share a filePath, lookupByPath returns the first one inserted", () => {
    // Two skills with the same name and scope produce identical filePaths
    // (makeSkill is deterministic on (name, scope)). The first inserted
    // entry wins under the byFilePath contract.
    const firstSkill = { ...makeSkill("twin", "user"), source: "first" };
    const secondSkill = { ...makeSkill("twin", "user"), source: "second" };
    const config = makeAggregatedConfig({ skills: [firstSkill, secondSkill] });
    const registry = buildRegistry(config, 0);

    const entry = lookupByPath(registry, firstSkill.filePath);
    expect(entry).not.toBeNull();
    expect(entry?.source).toBe("first");
  });
});

// =====================================================================
// basename multi-segment behaviour -- the stable-id rule for hooks/rules.
// =====================================================================

// @driving_port @basename_contract
describe("basename-derived names use the last path segment, not the full path", () => {
  it("a deeply-nested hook filePath produces a registry name equal to the file's last segment", () => {
    // A hook whose filePath has many forward-slash segments must register
    // under just the final segment so cross-references by short name work.
    const hook = {
      event: "PreToolUse" as const,
      command: "bash deep/nested/script.sh",
      matchers: [],
      rawConfig: { command: "bash deep/nested/script.sh" },
      filePath: ".claude/hooks/deep/nested/script.sh",
      scope: "project" as const,
      source: "project",
    };
    const config = makeAggregatedConfig({ hooks: [hook] });
    const registry = buildRegistry(config, 0);

    const matches = lookupByName(registry, "script.sh");
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("hook");
    // The nested middle segments must not appear as standalone names.
    expect(lookupByName(registry, "nested")).toHaveLength(0);
    expect(lookupByName(registry, "deep")).toHaveLength(0);
  });

  it("a hook filePath that ends in a separator falls back to the hook command as the name", () => {
    // basename returns '' when the path ends in a separator; the projector
    // then falls back to hook.command. This locks the LogicalOperator
    // contract `basename(filePath) || hook.command`.
    const hook = {
      event: "PreToolUse" as const,
      command: "fallback-command-id",
      matchers: [],
      rawConfig: { command: "fallback-command-id" },
      filePath: ".claude/hooks/",
      scope: "project" as const,
      source: "project",
    };
    const config = makeAggregatedConfig({ hooks: [hook] });
    const registry = buildRegistry(config, 0);

    const matches = lookupByName(registry, "fallback-command-id");
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe("hook");
  });
});

// =====================================================================
// Version monotonicity on rebuild.
// =====================================================================

// @driving_port @version_monotonicity
describe("buildRegistry returns a version strictly greater than prevVersion", () => {
  it("a rebuild from prevVersion=N produces version N+1, not N or N-1", () => {
    const r1 = buildRegistry(emptyAggregatedConfig, 0);
    const r2 = buildRegistry(emptyAggregatedConfig, r1.version);
    const r3 = buildRegistry(emptyAggregatedConfig, r2.version);

    expect(r1.version).toBe(1);
    expect(r2.version).toBe(2);
    expect(r3.version).toBe(3);
    // The strictly-greater contract is the memoisation invariant. Locking
    // the exact +1 step pins the ArithmeticOperator mutant (prevVersion - 1
    // is killed by `>= 0` on the existing test, but `prevVersion + 0` and
    // `prevVersion - 1` would survive without the equality assertion).
  });
});

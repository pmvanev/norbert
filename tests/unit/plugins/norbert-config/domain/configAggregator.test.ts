/**
 * Unit tests: Configuration Aggregator
 *
 * Property-based tests for the aggregateConfig pure function.
 * Validates structural invariants: isolation, scope preservation,
 * and monotonic growth of output lists relative to input lists.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  aggregateConfig,
  type RawClaudeConfig,
  type FileEntry,
  type ReadErrorInfo,
} from "../../../../../src/plugins/norbert-config/domain/configAggregator";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const scopeArb = fc.constantFrom("user" as const, "project" as const);

const validAgentContent = fc.record({
  model: fc.constantFrom("opus-4", "sonnet-4", "haiku-3"),
}).map(({ model }) => `---\nmodel: ${model}\n---\n\nAgent description.`);

const validCommandContent = fc.string({ minLength: 1, maxLength: 100 })
  .map((text) => `# Command\n\n${text}`);

const fileEntryArb = (contentArb: fc.Arbitrary<string>, pathPrefix: string): fc.Arbitrary<FileEntry> =>
  fc.tuple(
    fc.string({ minLength: 1, maxLength: 20, unit: "grapheme" }).filter((s) => /^[a-z0-9-]+$/.test(s)),
    contentArb,
    scopeArb,
  ).map(([name, content, scope]) => ({
    path: `${scope === "user" ? "~/.claude" : "./.claude"}/${pathPrefix}/${name}.md`,
    content,
    scope,
  }));

const agentFileEntryArb = fileEntryArb(validAgentContent, "agents");
const commandFileEntryArb = fileEntryArb(validCommandContent, "commands");

const readErrorArb: fc.Arbitrary<ReadErrorInfo> = fc.tuple(
  fc.string({ minLength: 1, maxLength: 30, unit: "grapheme" }).filter((s) => /^[a-z0-9-]+$/.test(s)),
  fc.constantFrom("Permission denied", "File not found", "IO error"),
  scopeArb,
).map(([name, error, scope]) => ({
  path: `${scope === "user" ? "~/.claude" : "./.claude"}/agents/${name}.md`,
  error,
  scope,
}));

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("configAggregator properties", () => {
  it("agents output length equals agents input length (per-file parsing, no filtering)", () => {
    fc.assert(
      fc.property(
        fc.array(agentFileEntryArb, { minLength: 0, maxLength: 5 }),
        (agents) => {
          const rawConfig: RawClaudeConfig = {
            agents,
            commands: [],
            skills: [],
            settings: null,
            errors: [],
            scope: "both",
          };
          const result = aggregateConfig(rawConfig);
          expect(result.agents).toHaveLength(agents.length);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("commands output length equals commands input length", () => {
    fc.assert(
      fc.property(
        fc.array(commandFileEntryArb, { minLength: 0, maxLength: 5 }),
        (commands) => {
          const rawConfig: RawClaudeConfig = {
            agents: [],
            commands,
            skills: [],
            settings: null,
            errors: [],
            scope: "both",
          };
          const result = aggregateConfig(rawConfig);
          expect(result.commands).toHaveLength(commands.length);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("read errors are passed through unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(readErrorArb, { minLength: 0, maxLength: 5 }),
        (errors) => {
          const rawConfig: RawClaudeConfig = {
            agents: [],
            commands: [],
            skills: [],
            settings: null,
            errors,
            scope: "both",
          };
          const result = aggregateConfig(rawConfig);
          expect(result.errors).toHaveLength(errors.length);
          for (let i = 0; i < errors.length; i++) {
            expect(result.errors[i].path).toBe(errors[i].path);
            expect(result.errors[i].error).toBe(errors[i].error);
            expect(result.errors[i].scope).toBe(errors[i].scope);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("null settings produces empty hooks, mcpServers, rules, plugins, envVars", () => {
    const rawConfig: RawClaudeConfig = {
      agents: [],
      commands: [],
      skills: [],
      settings: null,
      errors: [],
      scope: "both",
    };
    const result = aggregateConfig(rawConfig);
    expect(result.hooks).toEqual([]);
    expect(result.mcpServers).toEqual([]);
    expect(result.rules).toEqual([]);
    expect(result.plugins).toEqual([]);
    expect(result.envVars).toEqual([]);
  });

  it("envVars from settings receive filePath annotation from FileEntry.path", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[A-Z_][A-Z0-9_]*$/.test(s)),
          fc.string({ maxLength: 50 }),
          { minKeys: 0, maxKeys: 10 },
        ),
        scopeArb,
        fc.constantFrom("~/.claude/settings.json", "./.claude/settings.json"),
        (envBlock, scope, settingsPath) => {
          const settingsJson = JSON.stringify({ env: envBlock });
          const rawConfig: RawClaudeConfig = {
            agents: [],
            commands: [],
            skills: [],
            settings: { path: settingsPath, content: settingsJson, scope, source: scope },
            errors: [],
            scope: "both",
          };
          const result = aggregateConfig(rawConfig);

          // envVars count matches input env block string entries
          const expectedCount = Object.values(envBlock).filter(
            (v) => typeof v === "string",
          ).length;
          expect(result.envVars).toHaveLength(expectedCount);

          // Every envVar has filePath set to the settings FileEntry.path
          for (const entry of result.envVars) {
            expect(entry.filePath).toBe(settingsPath);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("agent scope is preserved from FileEntry, not hardcoded", () => {
    fc.assert(
      fc.property(
        agentFileEntryArb,
        (agentEntry) => {
          const rawConfig: RawClaudeConfig = {
            agents: [agentEntry],
            commands: [],
            skills: [],
            settings: null,
            errors: [],
            scope: "both",
          };
          const result = aggregateConfig(rawConfig);
          const agentResult = result.agents[0];
          if (agentResult.tag === "parsed") {
            expect(agentResult.agent.scope).toBe(agentEntry.scope);
          }
        },
      ),
    );
  });

  describe("skill name derivation", () => {
    const baseRaw = (skillFile: FileEntry): RawClaudeConfig => ({
      agents: [],
      commands: [],
      skills: [skillFile],
      settings: null,
      errors: [],
      scope: "both",
    } as RawClaudeConfig);

    it("uses YAML frontmatter `name:` field when present", () => {
      const result = aggregateConfig(baseRaw({
        path: "/plugins/cache/nw/skills/troubleshooter-reviewer/SKILL.md",
        content: "---\nname: troubleshooter-reviewer\ndescription: Skill bundle\n---\n\nbody",
        scope: "user",
      } as FileEntry));
      expect(result.skills[0].name).toBe("troubleshooter-reviewer");
    });

    it("uses parent directory when filename is SKILL.md and no frontmatter name", () => {
      const result = aggregateConfig(baseRaw({
        path: "C:\\Users\\x\\plugins\\nw\\skills\\agent-builder\\SKILL.md",
        content: "# Some heading\n\nbody",
        scope: "user",
      } as FileEntry));
      expect(result.skills[0].name).toBe("agent-builder");
    });

    it("handles forward-slash POSIX paths for SKILL.md parent dir", () => {
      const result = aggregateConfig(baseRaw({
        path: "/home/me/.claude/plugins/cache/nw/skills/data-engineer/SKILL.md",
        content: "# heading",
        scope: "user",
      } as FileEntry));
      expect(result.skills[0].name).toBe("data-engineer");
    });

    it("frontmatter name wins over parent directory for SKILL.md", () => {
      const result = aggregateConfig(baseRaw({
        path: "/plugins/skills/dir-name/SKILL.md",
        content: "---\nname: explicit-name\n---\n\nbody",
        scope: "user",
      } as FileEntry));
      expect(result.skills[0].name).toBe("explicit-name");
    });

    it("falls back to filename for normal skill files", () => {
      const result = aggregateConfig(baseRaw({
        path: "./.claude/commands/deploy.md",
        content: "# Deploy\n\nbody",
        scope: "project",
      } as FileEntry));
      expect(result.skills[0].name).toBe("deploy");
    });
  });
});

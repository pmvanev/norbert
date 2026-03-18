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
            claudeMdFiles: [],
            errors: [],
            scope: "both",
          };
          const result = aggregateConfig(rawConfig);
          expect(result.agents).toHaveLength(agents.length);
        },
      ),
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
            claudeMdFiles: [],
            errors: [],
            scope: "both",
          };
          const result = aggregateConfig(rawConfig);
          expect(result.commands).toHaveLength(commands.length);
        },
      ),
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
            claudeMdFiles: [],
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
    );
  });

  it("null settings produces empty hooks, mcpServers, rules, plugins", () => {
    const rawConfig: RawClaudeConfig = {
      agents: [],
      commands: [],
      skills: [],
      settings: null,
      claudeMdFiles: [],
      errors: [],
      scope: "both",
    };
    const result = aggregateConfig(rawConfig);
    expect(result.hooks).toEqual([]);
    expect(result.mcpServers).toEqual([]);
    expect(result.rules).toEqual([]);
    expect(result.plugins).toEqual([]);
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
            claudeMdFiles: [],
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

  it("docs output length equals claudeMdFiles input length with scope preserved", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.constantFrom("./CLAUDE.md", "~/.claude/CLAUDE.md"),
            fc.string({ minLength: 1, maxLength: 50 }),
            scopeArb,
          ).map(([path, content, scope]) => ({ path, content, scope })),
          { minLength: 0, maxLength: 3 },
        ),
        (claudeMdFiles) => {
          const rawConfig: RawClaudeConfig = {
            agents: [],
            commands: [],
            skills: [],
            settings: null,
            claudeMdFiles,
            errors: [],
            scope: "both",
          };
          const result = aggregateConfig(rawConfig);
          expect(result.docs).toHaveLength(claudeMdFiles.length);
          for (let i = 0; i < claudeMdFiles.length; i++) {
            expect(result.docs[i].filePath).toBe(claudeMdFiles[i].path);
            expect(result.docs[i].scope).toBe(claudeMdFiles[i].scope);
          }
        },
      ),
    );
  });
});

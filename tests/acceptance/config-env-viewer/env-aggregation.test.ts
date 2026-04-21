/**
 * Acceptance tests: Env Var Aggregation (config-env-viewer, step 01-02)
 *
 * Validates that env vars from settings parse result are threaded through
 * configAggregator into AggregatedConfig with filePath annotation from
 * the FileEntry path.
 *
 * Driving port: pure domain function (aggregateConfig)
 */

import { describe, it, expect } from "vitest";
import {
  aggregateConfig,
  type RawClaudeConfig,
  type FileEntry,
} from "../../../src/plugins/norbert-config/domain/configAggregator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fileEntry = (path: string, content: string, scope: "user" | "project"): FileEntry => ({
  path,
  content,
  scope,
  source: scope,
});

const emptyConfig = (scope: "user" | "project" | "both"): RawClaudeConfig => ({
  agents: [],
  commands: [],
  skills: [],
  settings: null,
  hooks: [],
  rules: [],
  installedPlugins: null,
  pluginDetails: [],
  errors: [],
  scope,
});

// ---------------------------------------------------------------------------
// ACCEPTANCE SCENARIOS
// ---------------------------------------------------------------------------

describe("Env vars from settings are aggregated with filePath annotation", () => {
  it("aggregates 5 OTEL env vars from settings with filePath annotation", () => {
    // Given settings.json with 5 OTEL env vars
    const settingsJson = JSON.stringify({
      env: {
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
        OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
        OTEL_LOG_LEVEL: "debug",
        OTEL_SERVICE_NAME: "norbert",
        OTEL_TRACES_SAMPLER: "always_on",
      },
    });

    const rawConfig: RawClaudeConfig = {
      ...emptyConfig("user"),
      settings: fileEntry("~/.claude/settings.json", settingsJson, "user"),
    };

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then aggregated config contains 5 env var entries
    expect(aggregated.envVars).toHaveLength(5);

    // And each entry has filePath annotated from the FileEntry path
    for (const entry of aggregated.envVars) {
      expect(entry.filePath).toBe("~/.claude/settings.json");
    }

    // And entries carry correct scope
    for (const entry of aggregated.envVars) {
      expect(entry.scope).toBe("user");
    }
  });

  it("produces empty envVars when settings is null", () => {
    // Given no settings file
    const rawConfig: RawClaudeConfig = emptyConfig("user");

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then envVars is empty
    expect(aggregated.envVars).toEqual([]);
  });

  it("produces empty envVars when settings JSON is malformed", () => {
    // Given malformed settings.json
    const rawConfig: RawClaudeConfig = {
      ...emptyConfig("user"),
      settings: fileEntry("~/.claude/settings.json", "{ invalid json }", "user"),
    };

    // When the raw config is aggregated
    const aggregated = aggregateConfig(rawConfig);

    // Then envVars is empty (error path)
    expect(aggregated.envVars).toEqual([]);
  });
});

/// Unit tests for sandbox enforcement — pure function validation of SQL
/// against plugin namespace rules.
///
/// Domain invariants tested as properties:
/// - Plugin writes to own namespace always succeed
/// - Plugin writes to core tables always fail
/// - Plugin writes to other plugin namespaces always fail
/// - Read-only queries to any table always succeed

import { describe, it, expect } from "vitest";
import {
  pluginIdToNamespacePrefix,
  isPluginNamespacedTable,
  validateSqlForPlugin,
  extractTargetTable,
} from "../../../src/plugins/sandboxEnforcer";

// ---------------------------------------------------------------------------
// pluginIdToNamespacePrefix
// ---------------------------------------------------------------------------

describe("pluginIdToNamespacePrefix", () => {
  it("converts hyphens to underscores and prepends plugin_", () => {
    expect(pluginIdToNamespacePrefix("team-monitor")).toBe(
      "plugin_team_monitor_"
    );
  });

  it("handles plugin id without hyphens", () => {
    expect(pluginIdToNamespacePrefix("analytics")).toBe("plugin_analytics_");
  });

  it("handles multiple hyphens", () => {
    expect(pluginIdToNamespacePrefix("my-cool-plugin")).toBe(
      "plugin_my_cool_plugin_"
    );
  });
});

// ---------------------------------------------------------------------------
// isPluginNamespacedTable
// ---------------------------------------------------------------------------

describe("isPluginNamespacedTable", () => {
  it("returns true when table starts with the plugin namespace prefix", () => {
    expect(
      isPluginNamespacedTable("plugin_team_monitor_metrics", "team-monitor")
    ).toBe(true);
  });

  it("returns false for core tables", () => {
    expect(isPluginNamespacedTable("sessions", "team-monitor")).toBe(false);
  });

  it("returns false for another plugin namespace", () => {
    expect(
      isPluginNamespacedTable("plugin_analytics_data", "team-monitor")
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractTargetTable
// ---------------------------------------------------------------------------

describe("extractTargetTable", () => {
  it("extracts table from INSERT INTO", () => {
    expect(extractTargetTable("INSERT INTO sessions (id) VALUES ('x')")).toBe(
      "sessions"
    );
  });

  it("extracts table from CREATE TABLE", () => {
    expect(
      extractTargetTable(
        "CREATE TABLE plugin_team_monitor_metrics (id TEXT PRIMARY KEY)"
      )
    ).toBe("plugin_team_monitor_metrics");
  });

  it("extracts table from UPDATE", () => {
    expect(extractTargetTable("UPDATE sessions SET name = 'y' WHERE id = 1")).toBe(
      "sessions"
    );
  });

  it("extracts table from DELETE FROM", () => {
    expect(extractTargetTable("DELETE FROM sessions WHERE id = 1")).toBe(
      "sessions"
    );
  });

  it("extracts table from DROP TABLE", () => {
    expect(extractTargetTable("DROP TABLE plugin_team_monitor_old")).toBe(
      "plugin_team_monitor_old"
    );
  });

  it("extracts table from ALTER TABLE", () => {
    expect(
      extractTargetTable("ALTER TABLE plugin_team_monitor_metrics ADD COLUMN ts TEXT")
    ).toBe("plugin_team_monitor_metrics");
  });

  it("returns null for SELECT (read-only)", () => {
    expect(extractTargetTable("SELECT * FROM sessions")).toBeNull();
  });

  it("is case-insensitive for SQL keywords", () => {
    expect(extractTargetTable("insert into sessions (id) values ('x')")).toBe(
      "sessions"
    );
  });
});

// ---------------------------------------------------------------------------
// validateSqlForPlugin
// ---------------------------------------------------------------------------

describe("validateSqlForPlugin", () => {
  it("allows read-only SELECT on any table", () => {
    const result = validateSqlForPlugin(
      "SELECT * FROM sessions",
      "team-monitor"
    );
    expect(result.ok).toBe(true);
  });

  it("allows write to own namespaced table", () => {
    const result = validateSqlForPlugin(
      "INSERT INTO plugin_team_monitor_metrics (id) VALUES ('x')",
      "team-monitor"
    );
    expect(result.ok).toBe(true);
  });

  it("rejects write to core table with descriptive error", () => {
    const result = validateSqlForPlugin(
      "INSERT INTO sessions (id) VALUES ('x')",
      "team-monitor"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        "Plugin 'team-monitor' cannot write to core table 'sessions'"
      );
      expect(result.error).toContain("plugin_team_monitor_");
    }
  });

  it("rejects write to another plugin namespace", () => {
    const result = validateSqlForPlugin(
      "INSERT INTO plugin_analytics_data (id) VALUES ('x')",
      "team-monitor"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Plugin 'team-monitor' cannot write");
    }
  });

  it("allows CREATE TABLE in own namespace", () => {
    const result = validateSqlForPlugin(
      "CREATE TABLE plugin_team_monitor_metrics (id TEXT PRIMARY KEY, value REAL)",
      "team-monitor"
    );
    expect(result.ok).toBe(true);
  });

  it("rejects CREATE TABLE in core namespace", () => {
    const result = validateSqlForPlugin(
      "CREATE TABLE new_core_table (id TEXT)",
      "team-monitor"
    );
    expect(result.ok).toBe(false);
  });

  it("allows DELETE from own namespaced table", () => {
    const result = validateSqlForPlugin(
      "DELETE FROM plugin_team_monitor_metrics WHERE id = 'x'",
      "team-monitor"
    );
    expect(result.ok).toBe(true);
  });

  it("rejects DELETE from core table", () => {
    const result = validateSqlForPlugin(
      "DELETE FROM sessions WHERE id = 'x'",
      "team-monitor"
    );
    expect(result.ok).toBe(false);
  });
});

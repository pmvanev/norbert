/**
 * Acceptance tests: Session Metrics Table — Optional Columns
 *
 * Validates that users can show/hide additional columns beyond the
 * default set, and that optional columns handle missing data gracefully.
 *
 * Driving ports:
 *   - getAvailableOptionalColumns() -> ColumnDefinition[]
 *   - toggleColumn(visibleColumns, columnId) -> OptionalColumnId[]
 *   - formatCacheHitPct(cacheReadTokens, totalTokens) -> string
 *   - formatClaudeVersion (src/domain/sessionPresentation.ts)
 *   - formatPlatform (src/domain/sessionPresentation.ts)
 *   - buildTableRows (extended with optional column fields)
 *
 * Traces to: Milestone 5 — Optional Columns
 */

import { describe, it, expect } from "vitest";
import type { SessionInfo } from "../../../../src/domain/status";
import type { SessionMetrics } from "../../../../src/plugins/norbert-usage/domain/types";
import type { SessionMetadata } from "../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";
import type { OptionalColumnId } from "../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";
import {
  getAvailableOptionalColumns,
  toggleColumn,
  formatCacheHitPct,
  buildTableRows,
} from "../../../../src/plugins/norbert-session/domain/sessionMetricsTable";
import {
  formatClaudeVersion,
  formatPlatform,
} from "../../../../src/domain/sessionPresentation";
import { NOW, makeSession, makeMetadata, makeMetrics } from "./fixtures";

// ---------------------------------------------------------------------------
// COLUMN MENU
// ---------------------------------------------------------------------------

describe("Available optional columns listed for user selection", () => {
  it("7 optional columns are available beyond defaults", () => {
    // When the available optional columns are queried
    const columns = getAvailableOptionalColumns();

    // Then the list includes all 7 optional columns
    const columnIds = columns.map((c) => c.id);
    expect(columnIds).toEqual([
      "version",
      "platform",
      "inputTokens",
      "outputTokens",
      "cacheHitPct",
      "activeAgents",
      "events",
    ]);
    expect(columns).toHaveLength(7);

    // And each column has a human-readable label
    for (const col of columns) {
      expect(col.label).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// ENABLE COLUMNS
// ---------------------------------------------------------------------------

describe("User enables Claude Code Version column", () => {
  it("version column added to visible column set", () => {
    // Given default visible columns (empty optional set)
    const visibleColumns: readonly OptionalColumnId[] = [];

    // When "version" is toggled on
    const result = toggleColumn(visibleColumns, "version");

    // Then visible columns include "version"
    expect(result).toContain("version");
  });
});

describe("User enables Platform column", () => {
  it("platform column added to visible column set", () => {
    // Given default visible columns (empty optional set)
    const visibleColumns: readonly OptionalColumnId[] = [];

    // When "platform" is toggled on
    const result = toggleColumn(visibleColumns, "platform");

    // Then visible columns include "platform"
    expect(result).toContain("platform");
  });
});

describe("User enables Input and Output token split columns", () => {
  it("both token split columns added independently", () => {
    // Given default visible columns (empty optional set)
    const visibleColumns: readonly OptionalColumnId[] = [];

    // When "inputTokens" and "outputTokens" are toggled on
    const afterInput = toggleColumn(visibleColumns, "inputTokens");
    const afterBoth = toggleColumn(afterInput, "outputTokens");

    // Then visible columns include both "inputTokens" and "outputTokens"
    expect(afterBoth).toContain("inputTokens");
    expect(afterBoth).toContain("outputTokens");
  });
});

describe("User enables Cache Hit percentage column", () => {
  it("cache hit formatted as percentage of total tokens", () => {
    // Given session with 40,000 cache read tokens and 100,000 total tokens
    // When cache hit percentage is computed
    const result = formatCacheHitPct(40_000, 100_000);

    // Then the result is "40%"
    expect(result).toBe("40%");
  });
});

describe("User enables Active Agents column", () => {
  it("agent count shown as integer for each session", () => {
    // Given session "norbert" has 3 active agents
    // And session "api-server" has 0 active agents
    const sessions: readonly SessionInfo[] = [
      makeSession("s1", 30, { lastEventMinutesAgo: 1 }),
      makeSession("s2", 20, { lastEventMinutesAgo: 1 }),
    ];
    const metadata: readonly SessionMetadata[] = [
      makeMetadata("s1", "/home/phil/norbert"),
      makeMetadata("s2", "/home/phil/api-server"),
    ];
    const metrics: readonly SessionMetrics[] = [
      makeMetrics("s1", { activeAgentCount: 3 }),
      makeMetrics("s2", { activeAgentCount: 0 }),
    ];

    // When the table rows are built
    const rows = buildTableRows(sessions, metrics, metadata, NOW);

    // Then "norbert" shows 3 and "api-server" shows 0
    expect(rows[0].activeAgents).toBe(3);
    expect(rows[1].activeAgents).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// DISABLE COLUMNS
// ---------------------------------------------------------------------------

describe("User hides a previously enabled optional column", () => {
  it("toggling off removes column from visible set", () => {
    // Given visible columns include "platform"
    const visibleColumns: readonly OptionalColumnId[] = ["platform"];

    // When "platform" is toggled off
    const result = toggleColumn(visibleColumns, "platform");

    // Then visible columns no longer include "platform"
    expect(result).not.toContain("platform");
  });
});

// ---------------------------------------------------------------------------
// ERROR PATH: Missing data
// ---------------------------------------------------------------------------

describe("Optional column shows placeholder for sessions without data", () => {
  it("null service_version produces dash placeholder", () => {
    // Given session metadata has service_version null
    // When formatClaudeVersion is called with null
    const result = formatClaudeVersion(null);

    // Then the result is null (rendered as dash by the view)
    expect(result).toBeNull();
  });
});

describe("Cache hit handles zero total tokens without division error", () => {
  it("zero total tokens produces 0% cache hit", () => {
    // Given session with 0 cache read tokens and 0 total tokens
    // When cache hit percentage is computed
    const result = formatCacheHitPct(0, 0);

    // Then the result is "0%" (not NaN or error)
    expect(result).toBe("0%");
  });
});

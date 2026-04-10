/**
 * Acceptance tests: Session Metrics Table — Optional Columns
 *
 * Validates that users can show/hide additional columns beyond the
 * default set, and that optional columns handle missing data gracefully.
 *
 * Driving ports:
 *   - getAvailableOptionalColumns() -> ColumnDefinition[]
 *   - toggleColumn(visibleColumns, columnId) -> ColumnId[]
 *   - formatCacheHitPct(cacheReadTokens, totalTokens) -> string
 *   - formatClaudeVersion (src/domain/sessionPresentation.ts)
 *   - formatPlatform (src/domain/sessionPresentation.ts)
 *
 * Traces to: Milestone 5 — Optional Columns
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// PLACEHOLDER: imports will target production driving ports once implemented
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// COLUMN MENU
// ---------------------------------------------------------------------------

describe("Available optional columns listed for user selection", () => {
  it.skip("7 optional columns are available beyond defaults", () => {
    // When the available optional columns are queried
    //
    // Then the list includes:
    //   "version", "platform", "inputTokens", "outputTokens",
    //   "cacheHitPct", "activeAgents", "events"
  });
});

// ---------------------------------------------------------------------------
// ENABLE COLUMNS
// ---------------------------------------------------------------------------

describe("User enables Claude Code Version column", () => {
  it.skip("version column added to visible column set", () => {
    // Given default visible columns
    //
    // When "version" is toggled on
    //
    // Then visible columns include "version"
  });
});

describe("User enables Platform column", () => {
  it.skip("platform column added to visible column set", () => {
    // Given default visible columns
    //
    // When "platform" is toggled on
    //
    // Then visible columns include "platform"
  });
});

describe("User enables Input and Output token split columns", () => {
  it.skip("both token split columns added independently", () => {
    // Given default visible columns
    //
    // When "inputTokens" and "outputTokens" are toggled on
    //
    // Then visible columns include both "inputTokens" and "outputTokens"
  });
});

describe("User enables Cache Hit percentage column", () => {
  it.skip("cache hit formatted as percentage of total tokens", () => {
    // Given session with 40,000 cache read tokens and 100,000 total tokens
    //
    // When cache hit percentage is computed
    //
    // Then the result is "40%"
  });
});

describe("User enables Active Agents column", () => {
  it.skip("agent count shown as integer for each session", () => {
    // Given session "norbert" has 3 active agents
    // And session "api-server" has 0 active agents
    //
    // When the active agents column value is extracted
    //
    // Then "norbert" shows 3 and "api-server" shows 0
  });
});

// ---------------------------------------------------------------------------
// DISABLE COLUMNS
// ---------------------------------------------------------------------------

describe("User hides a previously enabled optional column", () => {
  it.skip("toggling off removes column from visible set", () => {
    // Given visible columns include "platform"
    //
    // When "platform" is toggled off
    //
    // Then visible columns no longer include "platform"
  });
});

// ---------------------------------------------------------------------------
// ERROR PATH: Missing data
// ---------------------------------------------------------------------------

describe("Optional column shows placeholder for sessions without data", () => {
  it.skip("null service_version produces dash placeholder", () => {
    // Given session metadata has service_version null
    //
    // When formatClaudeVersion is called with null
    //
    // Then the result is null (rendered as dash by the view)
  });
});

describe("Cache hit handles zero total tokens without division error", () => {
  it.skip("zero total tokens produces 0% cache hit", () => {
    // Given session with 0 cache read tokens and 0 total tokens
    //
    // When cache hit percentage is computed
    //
    // Then the result is "0%" (not NaN or error)
  });
});

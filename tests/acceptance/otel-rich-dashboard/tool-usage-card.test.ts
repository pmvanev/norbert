/**
 * Acceptance tests: Tool Usage Dashboard Card (US-002)
 *
 * Validates that tool_result events are aggregated into meaningful
 * summaries: total calls, per-tool breakdown, success rates, durations,
 * and error details.
 *
 * Driving ports: toolUsageAggregator (pure domain function)
 *
 * Traces to: US-002 acceptance criteria
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// PLACEHOLDER: imports will target production driving ports once implemented
// ---------------------------------------------------------------------------
// import {
//   aggregateToolUsage,
//   type ToolUsageSummary,
// } from "../../../src/plugins/norbert-usage/domain/toolUsageAggregator";

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Happy Path
// ---------------------------------------------------------------------------

describe("Tool usage summary shows aggregated statistics", () => {
  it.skip("total calls and success rate from multiple tool types", () => {
    // Given session "6e2a8c02" has tool results for
    //   Bash (15 calls, 13 success), Read (8 calls, 8 success), Write (5 calls, 5 success)
    // When Phil views the Tool Usage card
    // Then the card shows "3 types, 28 calls"
    // And overall success rate shows "93%"
  });

  it.skip("per-tool breakdown shows individual tool statistics", () => {
    // Given session "6e2a8c02" has 15 Bash tool results
    //   with average duration 2100ms and 87% success rate
    // When Phil views the Tool Usage breakdown
    // Then Bash shows 15 calls, 87% success rate, and 2.1s average duration
  });

  it.skip("failed tool call shows error detail", () => {
    // Given session "6e2a8c02" has a failed Bash call
    //   with error "command timed out after 15000ms" lasting 17.9 seconds
    // When Phil views the Bash tool detail
    // Then the failed call shows error "command timed out after 15000ms"
    // And the duration shows "17.9s"
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Error / Edge
// ---------------------------------------------------------------------------

describe("Tool usage handles edge cases", () => {
  it.skip("zero tool calls shows informational state", () => {
    // Given session "minimal-session" has no tool results
    // When Phil views the Tool Usage card
    // Then the card shows "0 calls"
  });

  it.skip("tools sorted by call count with most used first", () => {
    // Given session "6e2a8c02" has Read (20 calls), Bash (15 calls), Write (5 calls)
    // When Phil views the Tool Usage breakdown
    // Then tools appear in order: Read, Bash, Write
  });

  it.skip("all tool calls failed shows 0% success rate", () => {
    // Given session "broken-session" has 5 Bash calls all with success false
    // When Phil views the Tool Usage card
    // Then overall success rate shows "0%"
  });

  it.skip("tool with zero duration still appears in breakdown", () => {
    // Given session "6e2a8c02" has 3 Glob tool results with duration 0ms
    // When Phil views the Tool Usage breakdown
    // Then Glob shows 3 calls with 0.0s average duration
  });
});

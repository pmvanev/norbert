import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  aggregateToolUsage,
  EMPTY_TOOL_USAGE_SUMMARY,
  type ToolResultEvent,
} from "./toolUsageAggregator";

// ---------------------------------------------------------------------------
// Helpers: event builders
// ---------------------------------------------------------------------------

const buildToolResultEvent = (
  overrides: Partial<ToolResultEvent["payload"]> = {},
  receivedAt = "2026-03-24T10:00:00Z",
): ToolResultEvent => ({
  eventType: "tool_result",
  payload: {
    tool_name: "Bash",
    success: true,
    duration_ms: 100,
    ...overrides,
  },
  receivedAt,
});

// ---------------------------------------------------------------------------
// Arbitrary: generate random ToolResultEvent
// ---------------------------------------------------------------------------

const toolNameArb = fc.constantFrom("Bash", "Read", "Write", "Edit", "Grep", "Glob");
const toolResultEventArb: fc.Arbitrary<ToolResultEvent> = fc.record({
  eventType: fc.constant("tool_result" as const),
  payload: fc.record({
    tool_name: toolNameArb,
    success: fc.boolean(),
    duration_ms: fc.integer({ min: 0, max: 60000 }),
  }),
  receivedAt: fc.constant("2026-03-24T10:00:00Z"),
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("aggregateToolUsage", () => {
  it("returns empty summary for empty events array", () => {
    const result = aggregateToolUsage([]);
    expect(result).toEqual(EMPTY_TOOL_USAGE_SUMMARY);
  });

  // -------------------------------------------------------------------------
  // Example-based: known inputs
  // -------------------------------------------------------------------------

  it("computes correct summary for 3 tool_result events", () => {
    const events: ToolResultEvent[] = [
      buildToolResultEvent({ tool_name: "Bash", success: true, duration_ms: 200 }),
      buildToolResultEvent({ tool_name: "Bash", success: false, duration_ms: 300 }),
      buildToolResultEvent({ tool_name: "Read", success: true, duration_ms: 100 }),
    ];
    const result = aggregateToolUsage(events);

    expect(result.totalCalls).toBe(3);
    expect(result.successCount).toBe(2);
    expect(result.successRate).toBeCloseTo(2 / 3, 5);

    const bashStats = result.perToolBreakdown.get("Bash");
    expect(bashStats).toBeDefined();
    expect(bashStats!.count).toBe(2);
    expect(bashStats!.successCount).toBe(1);
    expect(bashStats!.successRate).toBeCloseTo(0.5, 5);
    expect(bashStats!.avgDurationMs).toBe(250);

    const readStats = result.perToolBreakdown.get("Read");
    expect(readStats).toBeDefined();
    expect(readStats!.count).toBe(1);
    expect(readStats!.successRate).toBe(1);
    expect(readStats!.avgDurationMs).toBe(100);
  });

  it("handles events with missing tool_name as 'unknown'", () => {
    const events: ToolResultEvent[] = [
      buildToolResultEvent({ tool_name: undefined, success: true, duration_ms: 50 }),
    ];
    const result = aggregateToolUsage(events);
    expect(result.totalCalls).toBe(1);
    expect(result.perToolBreakdown.has("unknown")).toBe(true);
  });

  it("handles events with missing success as false", () => {
    const events: ToolResultEvent[] = [
      buildToolResultEvent({ success: undefined, duration_ms: 50 }),
    ];
    const result = aggregateToolUsage(events);
    expect(result.successCount).toBe(0);
    expect(result.successRate).toBe(0);
  });

  it("handles events with missing duration_ms as 0", () => {
    const events: ToolResultEvent[] = [
      buildToolResultEvent({ duration_ms: undefined }),
    ];
    const result = aggregateToolUsage(events);
    const stats = result.perToolBreakdown.get("Bash");
    expect(stats!.avgDurationMs).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Property: totalCalls equals event count
  // -------------------------------------------------------------------------

  it("property: totalCalls equals number of events", () => {
    fc.assert(
      fc.property(fc.array(toolResultEventArb), (events) => {
        const result = aggregateToolUsage(events);
        expect(result.totalCalls).toBe(events.length);
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Property: successRate is between 0 and 1 inclusive
  // -------------------------------------------------------------------------

  it("property: successRate is between 0 and 1", () => {
    fc.assert(
      fc.property(
        fc.array(toolResultEventArb, { minLength: 1 }),
        (events) => {
          const result = aggregateToolUsage(events);
          expect(result.successRate).toBeGreaterThanOrEqual(0);
          expect(result.successRate).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property: sum of per-tool counts equals totalCalls
  // -------------------------------------------------------------------------

  it("property: per-tool counts sum to totalCalls", () => {
    fc.assert(
      fc.property(fc.array(toolResultEventArb), (events) => {
        const result = aggregateToolUsage(events);
        let perToolSum = 0;
        for (const stats of result.perToolBreakdown.values()) {
          perToolSum += stats.count;
        }
        expect(perToolSum).toBe(result.totalCalls);
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Property: per-tool avgDuration is non-negative
  // -------------------------------------------------------------------------

  it("property: per-tool avgDurationMs is non-negative", () => {
    fc.assert(
      fc.property(
        fc.array(toolResultEventArb, { minLength: 1 }),
        (events) => {
          const result = aggregateToolUsage(events);
          for (const stats of result.perToolBreakdown.values()) {
            expect(stats.avgDurationMs).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });
});

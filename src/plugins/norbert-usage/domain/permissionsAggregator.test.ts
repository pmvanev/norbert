import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  aggregatePermissions,
  EMPTY_PERMISSIONS_SUMMARY,
  type ToolDecisionEvent,
  type DecisionSource,
} from "./permissionsAggregator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildToolDecisionEvent = (
  overrides: Partial<ToolDecisionEvent["payload"]> = {},
  receivedAt = "2026-03-24T10:00:00Z",
): ToolDecisionEvent => ({
  eventType: "tool_decision",
  payload: {
    decision: "auto",
    tool_name: "Bash",
    ...overrides,
  },
  receivedAt,
});

// ---------------------------------------------------------------------------
// Arbitrary
// ---------------------------------------------------------------------------

const decisionSourceArb: fc.Arbitrary<DecisionSource> = fc.constantFrom("auto", "user", "rejected");
const toolDecisionEventArb: fc.Arbitrary<ToolDecisionEvent> = fc.record({
  eventType: fc.constant("tool_decision" as const),
  payload: fc.record({
    decision: decisionSourceArb,
    tool_name: fc.constantFrom("Bash", "Read", "Write", "Edit"),
  }),
  receivedAt: fc.constant("2026-03-24T10:00:00Z"),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("aggregatePermissions", () => {
  it("returns empty summary for empty events array", () => {
    const result = aggregatePermissions([]);
    expect(result).toEqual(EMPTY_PERMISSIONS_SUMMARY);
  });

  it("computes correct breakdown for known decisions", () => {
    const events: ToolDecisionEvent[] = [
      buildToolDecisionEvent({ decision: "auto" }),
      buildToolDecisionEvent({ decision: "auto" }),
      buildToolDecisionEvent({ decision: "auto" }),
      buildToolDecisionEvent({ decision: "user" }),
      buildToolDecisionEvent({ decision: "rejected" }),
    ];
    const result = aggregatePermissions(events);

    expect(result.totalDecisions).toBe(5);
    expect(result.autoApproved).toBe(3);
    expect(result.userApproved).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.autoRate).toBeCloseTo(3 / 5, 5);
  });

  it("handles events with missing decision as unknown (not counted in any bucket)", () => {
    const events: ToolDecisionEvent[] = [
      buildToolDecisionEvent({ decision: undefined }),
    ];
    const result = aggregatePermissions(events);
    expect(result.totalDecisions).toBe(1);
    // Unknown decisions count in total but not in any specific bucket
    expect(result.autoApproved + result.userApproved + result.rejected).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Property: totalDecisions equals event count
  // -------------------------------------------------------------------------

  it("property: totalDecisions equals number of events", () => {
    fc.assert(
      fc.property(fc.array(toolDecisionEventArb), (events) => {
        const result = aggregatePermissions(events);
        expect(result.totalDecisions).toBe(events.length);
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Property: auto + user + rejected <= totalDecisions
  // -------------------------------------------------------------------------

  it("property: categorized decisions do not exceed total", () => {
    fc.assert(
      fc.property(fc.array(toolDecisionEventArb), (events) => {
        const result = aggregatePermissions(events);
        expect(
          result.autoApproved + result.userApproved + result.rejected,
        ).toBeLessThanOrEqual(result.totalDecisions);
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Property: autoRate is between 0 and 1
  // -------------------------------------------------------------------------

  it("property: autoRate is between 0 and 1", () => {
    fc.assert(
      fc.property(
        fc.array(toolDecisionEventArb, { minLength: 1 }),
        (events) => {
          const result = aggregatePermissions(events);
          expect(result.autoRate).toBeGreaterThanOrEqual(0);
          expect(result.autoRate).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  it("autoRate is exactly 0 (not NaN) when all decisions are user-approved", () => {
    const events: ToolDecisionEvent[] = [
      buildToolDecisionEvent({ decision: "user" }),
      buildToolDecisionEvent({ decision: "user" }),
    ];
    const result = aggregatePermissions(events);
    expect(result.autoRate).toBe(0);
    expect(Number.isNaN(result.autoRate)).toBe(false);
  });

  it("empty array returns reference-equal EMPTY_PERMISSIONS_SUMMARY sentinel", () => {
    const result = aggregatePermissions([]);
    expect(result).toBe(EMPTY_PERMISSIONS_SUMMARY);
  });
});

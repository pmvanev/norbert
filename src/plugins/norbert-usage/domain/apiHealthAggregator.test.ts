import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  aggregateApiHealth,
  EMPTY_API_HEALTH_SUMMARY,
  type ApiErrorEvent,
} from "./apiHealthAggregator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildApiErrorEvent = (
  overrides: Partial<ApiErrorEvent["payload"]> = {},
  receivedAt = "2026-03-24T10:00:00Z",
): ApiErrorEvent => ({
  eventType: "api_error",
  payload: {
    status_code: 429,
    error: "rate_limit_exceeded",
    model: "claude-opus-4-6",
    attempt: 1,
    ...overrides,
  },
  receivedAt,
});

// ---------------------------------------------------------------------------
// Arbitrary
// ---------------------------------------------------------------------------

const statusCodeArb = fc.constantFrom(400, 401, 403, 429, 500, 502, 503);
const apiErrorEventArb: fc.Arbitrary<ApiErrorEvent> = fc.record({
  eventType: fc.constant("api_error" as const),
  payload: fc.record({
    status_code: statusCodeArb,
    error: fc.constantFrom("rate_limit_exceeded", "server_error", "auth_error"),
    model: fc.constant("claude-opus-4-6"),
    attempt: fc.integer({ min: 1, max: 5 }),
  }),
  receivedAt: fc.constant("2026-03-24T10:00:00Z"),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("aggregateApiHealth", () => {
  it("returns empty summary for empty events array", () => {
    const result = aggregateApiHealth([], 0);
    expect(result).toEqual(EMPTY_API_HEALTH_SUMMARY);
  });

  it("computes correct summary for known errors", () => {
    const events: ApiErrorEvent[] = [
      buildApiErrorEvent({ status_code: 429 }),
      buildApiErrorEvent({ status_code: 429 }),
      buildApiErrorEvent({ status_code: 500 }),
    ];
    const result = aggregateApiHealth(events, 47);

    expect(result.totalErrors).toBe(3);
    expect(result.totalApiRequests).toBe(47);
    expect(result.errorRate).toBeCloseTo(3 / 47, 5);
    expect(result.byStatusCode.get(429)).toBe(2);
    expect(result.byStatusCode.get(500)).toBe(1);
  });

  it("returns zero error rate when totalApiRequests is zero", () => {
    const events: ApiErrorEvent[] = [buildApiErrorEvent()];
    const result = aggregateApiHealth(events, 0);
    expect(result.totalErrors).toBe(1);
    expect(result.errorRate).toBe(0);
  });

  it("handles events with missing status_code as 0 (unknown)", () => {
    const events: ApiErrorEvent[] = [
      buildApiErrorEvent({ status_code: undefined }),
    ];
    const result = aggregateApiHealth(events, 10);
    expect(result.totalErrors).toBe(1);
    expect(result.byStatusCode.has(0)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Property: totalErrors equals event count
  // -------------------------------------------------------------------------

  it("property: totalErrors equals number of events", () => {
    fc.assert(
      fc.property(
        fc.array(apiErrorEventArb),
        fc.integer({ min: 0, max: 10000 }),
        (events, totalRequests) => {
          const result = aggregateApiHealth(events, totalRequests);
          expect(result.totalErrors).toBe(events.length);
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property: errorRate is between 0 and 1 when totalApiRequests >= totalErrors
  // -------------------------------------------------------------------------

  it("property: errorRate between 0 and 1 when requests >= errors", () => {
    fc.assert(
      fc.property(
        fc.array(apiErrorEventArb, { minLength: 1, maxLength: 50 }),
        (events) => {
          const totalRequests = events.length + 10; // always more requests than errors
          const result = aggregateApiHealth(events, totalRequests);
          expect(result.errorRate).toBeGreaterThanOrEqual(0);
          expect(result.errorRate).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  // -------------------------------------------------------------------------
  // Property: sum of byStatusCode values equals totalErrors
  // -------------------------------------------------------------------------

  it("property: byStatusCode values sum to totalErrors", () => {
    fc.assert(
      fc.property(fc.array(apiErrorEventArb), (events) => {
        const result = aggregateApiHealth(events, 100);
        let sum = 0;
        for (const count of result.byStatusCode.values()) {
          sum += count;
        }
        expect(sum).toBe(result.totalErrors);
      }),
    );
  });

  it("returns computed result (not empty sentinel) when events=0 but totalApiRequests>0", () => {
    const result = aggregateApiHealth([], 50);
    expect(result.totalApiRequests).toBe(50);
    expect(result.totalErrors).toBe(0);
    expect(result.errorRate).toBe(0);
    expect(result).not.toBe(EMPTY_API_HEALTH_SUMMARY);
  });

  it("empty events with 0 requests returns reference-equal EMPTY_API_HEALTH_SUMMARY", () => {
    const result = aggregateApiHealth([], 0);
    expect(result).toBe(EMPTY_API_HEALTH_SUMMARY);
  });
});

/**
 * Unit tests: Multi-Session Store adapter (Step 01-01)
 *
 * Tracks SessionMetrics for all active sessions. Mutable adapter at the edge.
 *
 * Behaviors tested:
 * - Initial state has no sessions
 * - addSession registers a new session with initial metrics
 * - removeSession removes a tracked session
 * - updateSession replaces metrics for a tracked session
 * - getSessions returns all tracked session metrics
 * - getSession returns metrics for a specific session or undefined
 * - Adding duplicate session ID is idempotent (keeps existing)
 * - Removing non-existent session is a no-op
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createMultiSessionStore } from "../../../../../src/plugins/norbert-usage/adapters/multiSessionStore";
import { createInitialMetrics } from "../../../../../src/plugins/norbert-usage/domain/metricsAggregator";
import type { SessionMetrics } from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMetrics = (
  sessionId: string,
  overrides: Partial<SessionMetrics> = {},
): SessionMetrics => ({
  ...createInitialMetrics(sessionId),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("multiSessionStore initial state", () => {
  it("has no sessions initially", () => {
    const store = createMultiSessionStore();
    expect(store.getSessions()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Add/remove sessions
// ---------------------------------------------------------------------------

describe("multiSessionStore add and remove", () => {
  it("addSession registers a new session", () => {
    const store = createMultiSessionStore();
    store.addSession("session-a");

    const sessions = store.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("session-a");
  });

  it("addSession with duplicate ID is idempotent", () => {
    const store = createMultiSessionStore();
    store.addSession("session-a");
    store.addSession("session-a");

    expect(store.getSessions()).toHaveLength(1);
  });

  it("removeSession removes tracked session", () => {
    const store = createMultiSessionStore();
    store.addSession("session-a");
    store.addSession("session-b");
    store.removeSession("session-a");

    const sessions = store.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("session-b");
  });

  it("removeSession on non-existent session is a no-op", () => {
    const store = createMultiSessionStore();
    store.addSession("session-a");
    store.removeSession("non-existent");

    expect(store.getSessions()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Update and query
// ---------------------------------------------------------------------------

describe("multiSessionStore update and query", () => {
  it("updateSession replaces metrics for tracked session", () => {
    const store = createMultiSessionStore();
    store.addSession("session-a");

    const updated = makeMetrics("session-a", { burnRate: 250, sessionCost: 3.5 });
    store.updateSession("session-a", updated);

    const result = store.getSession("session-a");
    expect(result).toBeDefined();
    expect(result!.burnRate).toBe(250);
    expect(result!.sessionCost).toBe(3.5);
  });

  it("getSession returns undefined for unknown session", () => {
    const store = createMultiSessionStore();
    expect(store.getSession("unknown")).toBeUndefined();
  });

  it("tracks add and remove of sessions independently", () => {
    const store = createMultiSessionStore();
    store.addSession("alpha");
    store.addSession("beta");
    store.addSession("gamma");

    store.updateSession("beta", makeMetrics("beta", { burnRate: 100 }));
    store.removeSession("alpha");

    const sessions = store.getSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions.map(s => s.sessionId).sort()).toEqual(["beta", "gamma"]);

    const beta = store.getSession("beta");
    expect(beta!.burnRate).toBe(100);
  });

  it("updateSession on unknown ID is a no-op", () => {
    const store = createMultiSessionStore();
    store.addSession("session-a");

    const before = store.getSession("session-a");
    store.updateSession("unknown-id", makeMetrics("unknown-id", { burnRate: 999 }));

    // Original session unchanged
    const after = store.getSession("session-a");
    expect(after).toEqual(before);

    // Unknown session was not created
    expect(store.getSession("unknown-id")).toBeUndefined();
    expect(store.getSessions()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Aggregate window buffer -- cross-session sum
// ---------------------------------------------------------------------------

describe("multiSessionStore aggregate window buffer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sums values across two sessions in the 1m window buffer", () => {
    // Control timestamps to ensure the aggregate multi-window buffer accepts both samples.
    // The 1m window has a 2000ms sample interval (aligned with the 2s heartbeat
    // poll), so timestamps must be >2000ms apart for the second append to pass
    // the downsample gate in multiWindowSampler.appendToWindow.
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    const store = createMultiSessionStore();
    store.addSession("session-a");
    store.addSession("session-b");

    // First sample at t=1000
    store.appendSessionSample("session-a", { tokens: 100, cost: 0, agents: 0, context: 0 });

    // Advance time past the 1m window's 2000ms sample interval
    now = 3100;
    store.appendSessionSample("session-b", { tokens: 250, cost: 0, agents: 0, context: 0 });

    // tokens is aggregateApplicable, so the aggregate window should sum both
    const aggregateBuffer = store.getAggregateWindowBuffer("tokens", "1m");
    expect(aggregateBuffer.samples.length).toBeGreaterThan(0);

    // The latest aggregate sample should reflect the sum of both sessions
    const latestSample = aggregateBuffer.samples[aggregateBuffer.samples.length - 1];
    expect(latestSample.tokenRate).toBe(350);
  });

  it("does not aggregate non-aggregatable categories (context)", () => {
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    const store = createMultiSessionStore();
    store.addSession("session-a");
    store.addSession("session-b");

    store.appendSessionSample("session-a", { tokens: 0, cost: 0, agents: 0, context: 60 });
    now = 1200;
    store.appendSessionSample("session-b", { tokens: 0, cost: 0, agents: 0, context: 80 });

    // context is not aggregateApplicable -- aggregate window buffer should be empty
    const aggregateBuffer = store.getAggregateWindowBuffer("context", "1m");
    expect(aggregateBuffer.samples).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Null-fallback paths in buffer retrieval
// ---------------------------------------------------------------------------

describe("multiSessionStore buffer fallback paths", () => {
  it("getSessionWindowBuffer returns undefined for unknown session", () => {
    const store = createMultiSessionStore();
    const result = store.getSessionWindowBuffer("unknown-session", "tokens", "1m");
    expect(result).toBeUndefined();
  });

  it("getSessionWindowBuffer returns empty buffer for session with no samples", () => {
    const store = createMultiSessionStore();
    store.addSession("session-a");

    // Session exists but no samples appended yet -- multi-window buffer exists with empty windows
    const result = store.getSessionWindowBuffer("session-a", "tokens", "1m");
    expect(result).toBeDefined();
    expect(result!.samples).toHaveLength(0);
  });

  it("getAggregateWindowBuffer returns empty buffer for category with no samples", () => {
    const store = createMultiSessionStore();

    // No sessions added, no samples -- aggregate multi-window buffer should return empty
    const result = store.getAggregateWindowBuffer("tokens", "1m");
    expect(result).toBeDefined();
    expect(result.samples).toHaveLength(0);
  });

  it("getSessionBuffer returns undefined for unknown session", () => {
    const store = createMultiSessionStore();
    const result = store.getSessionBuffer("unknown-session", "tokens");
    expect(result).toBeUndefined();
  });

  it("appendSessionSample on unknown session is a no-op", () => {
    const store = createMultiSessionStore();
    store.addSession("session-a");

    // Append to unknown session -- should not throw, should not affect existing
    store.appendSessionSample("unknown-session", { tokens: 100, cost: 0, agents: 0, context: 0 });

    const buffer = store.getSessionBuffer("session-a", "tokens");
    expect(buffer).toBeDefined();
    expect(buffer!.samples).toHaveLength(0);
  });
});

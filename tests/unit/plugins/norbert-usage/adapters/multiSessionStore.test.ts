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

import { describe, it, expect } from "vitest";
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
});

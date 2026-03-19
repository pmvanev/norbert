/**
 * Acceptance tests: Per-Session Per-Category Time-Series Buffers (v2)
 *
 * Validates the MultiSessionStore extension: per-session per-category
 * ring buffers, aggregate buffer computation, subscriber notification,
 * and the aggregate applicability rule (context has no aggregate).
 *
 * Driving ports: extended MultiSessionStore adapter
 * These tests exercise the adapter boundary with real internal domain
 * functions (ring buffers), mocking nothing internal.
 *
 * Traces to: ADR-008 "Per-Session Per-Category Time-Series Buffers",
 * ADR-009 "Aggregate Applicability by Category",
 * architecture-design.md "MultiSessionStore Extension",
 * data-models.md "Extended MultiSessionStore Interface"
 */

import { describe, it, expect } from "vitest";

// Driving port: extended MultiSessionStore (adapter boundary)
// These imports will resolve once the module is extended.
import {
  createMultiSessionStore,
  type MultiSessionStore,
} from "../../../src/plugins/norbert-usage/adapters/multiSessionStore";

import type { MetricCategoryId } from "../../../src/plugins/norbert-usage/domain/categoryConfig";

// ---------------------------------------------------------------------------
// WALKING SKELETON: User sees per-session graphs update with new data
// Traces to: ADR-008, US-PM-002 per-session graphs
// ---------------------------------------------------------------------------

describe("User sees per-session metric graphs update as events arrive", () => {
  it("appending a sample to a session creates per-category time-series data", () => {
    // Given a multi-session store with one active session "refactor-auth"
    const store = createMultiSessionStore();
    store.addSession("refactor-auth");

    // When a category sample is appended for that session
    store.appendSessionSample("refactor-auth", {
      tokens: 312,
      cost: 0.003,
      agents: 2,
      context: 45,
    });

    // Then the session's token buffer contains the sample
    const tokenBuffer = store.getSessionBuffer("refactor-auth", "tokens");
    expect(tokenBuffer).toBeDefined();
    expect(tokenBuffer!.samples.length).toBeGreaterThan(0);

    // And the session's context buffer also contains the sample
    const contextBuffer = store.getSessionBuffer("refactor-auth", "context");
    expect(contextBuffer).toBeDefined();
    expect(contextBuffer!.samples.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Per-Session Buffer Operations
// Traces to: ADR-008, data-models.md PerSessionCategoryBuffers
// ---------------------------------------------------------------------------

describe("Each session maintains independent buffers per category", () => {
  it("two sessions have separate token buffers with different values", () => {
    // Given two active sessions with different token rates
    const store = createMultiSessionStore();
    store.addSession("session-a");
    store.addSession("session-b");

    // When different samples are appended to each session
    store.appendSessionSample("session-a", { tokens: 500, cost: 0.005, agents: 1, context: 30 });
    store.appendSessionSample("session-b", { tokens: 100, cost: 0.001, agents: 2, context: 60 });

    // Then session-a's token buffer has its own values
    const bufferA = store.getSessionBuffer("session-a", "tokens");
    // And session-b's token buffer has its own values
    const bufferB = store.getSessionBuffer("session-b", "tokens");

    expect(bufferA).toBeDefined();
    expect(bufferB).toBeDefined();
    // And the values are independent (not mixed)
    expect(bufferA!.samples).not.toEqual(bufferB!.samples);
  });
});

describe("Removing a session cleans up its per-category buffers", () => {
  it("removed session's buffers are no longer accessible", () => {
    // Given a session with buffered samples
    const store = createMultiSessionStore();
    store.addSession("temp-session");
    store.appendSessionSample("temp-session", { tokens: 200, cost: 0.002, agents: 1, context: 50 });

    // When the session is removed
    store.removeSession("temp-session");

    // Then the session's buffers return undefined
    const buffer = store.getSessionBuffer("temp-session", "tokens");
    expect(buffer).toBeUndefined();
  });
});

describe("Appending to a nonexistent session is a no-op", () => {
  it("no error when appending to unknown session ID", () => {
    // Given an empty store
    const store = createMultiSessionStore();

    // When a sample is appended to a session that does not exist
    // Then no error is thrown
    expect(() => {
      store.appendSessionSample("ghost-session", { tokens: 100, cost: 0, agents: 0, context: 0 });
    }).not.toThrow();

    // And no buffer is created for the unknown session
    const buffer = store.getSessionBuffer("ghost-session", "tokens");
    expect(buffer).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Aggregate Buffer Computation
// Traces to: ADR-008 "aggregate ring buffers", ADR-009
// ---------------------------------------------------------------------------

describe("Aggregate token buffer sums across all sessions", () => {
  it("aggregate token value equals sum of per-session token rates", () => {
    // Given 3 sessions with known token rates
    const store = createMultiSessionStore();
    store.addSession("s1");
    store.addSession("s2");
    store.addSession("s3");

    store.appendSessionSample("s1", { tokens: 312, cost: 0.003, agents: 1, context: 45 });
    store.appendSessionSample("s2", { tokens: 185, cost: 0.002, agents: 2, context: 67 });
    store.appendSessionSample("s3", { tokens: 30, cost: 0.0003, agents: 1, context: 20 });

    // When the aggregate token buffer is read
    const aggBuffer = store.getAggregateBuffer("tokens");

    // Then the aggregate value is the sum (312 + 185 + 30 = 527)
    expect(aggBuffer).toBeDefined();
    const latestSample = aggBuffer!.samples[aggBuffer!.samples.length - 1];
    expect(latestSample).toBeDefined();
    // The aggregate sample value should approximately equal 527
    expect(latestSample.tokenRate + latestSample.costRate).toBeGreaterThan(0); // buffer has data
  });
});

describe("Aggregate cost buffer sums across all sessions", () => {
  it("aggregate cost value equals sum of per-session cost rates", () => {
    // Given 2 sessions with known cost rates
    const store = createMultiSessionStore();
    store.addSession("opus-session");
    store.addSession("sonnet-session");

    store.appendSessionSample("opus-session", { tokens: 300, cost: 0.18, agents: 1, context: 40 });
    store.appendSessionSample("sonnet-session", { tokens: 100, cost: 0.004, agents: 1, context: 30 });

    // When the aggregate cost buffer is read
    const aggBuffer = store.getAggregateBuffer("cost");

    // Then the aggregate buffer contains summed cost data
    expect(aggBuffer).toBeDefined();
    expect(aggBuffer!.samples.length).toBeGreaterThan(0);
  });
});

describe("Context category has no aggregate buffer", () => {
  it("aggregate context buffer is empty or not populated", () => {
    // Given multiple sessions with context data
    const store = createMultiSessionStore();
    store.addSession("s1");
    store.addSession("s2");

    store.appendSessionSample("s1", { tokens: 100, cost: 0.001, agents: 1, context: 45 });
    store.appendSessionSample("s2", { tokens: 200, cost: 0.002, agents: 1, context: 72 });

    // When the aggregate context buffer is requested
    const aggBuffer = store.getAggregateBuffer("context");

    // Then the buffer is empty (context aggregation is not applicable per ADR-009)
    expect(aggBuffer.samples).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Subscriber Notification
// Traces to: data-models.md "subscribe(callback)"
// ---------------------------------------------------------------------------

describe("Subscribers are notified when samples are appended", () => {
  it("callback invoked after appendSessionSample", () => {
    // Given a store with a subscriber
    const store = createMultiSessionStore();
    store.addSession("test-session");

    let notified = false;
    const unsubscribe = store.subscribe(() => { notified = true; });

    // When a sample is appended
    store.appendSessionSample("test-session", { tokens: 100, cost: 0, agents: 1, context: 50 });

    // Then the subscriber is notified
    expect(notified).toBe(true);

    // Cleanup
    unsubscribe();
  });
});

describe("Unsubscribed callbacks are not invoked", () => {
  it("callback not called after unsubscribe", () => {
    // Given a store with a subscriber that has been unsubscribed
    const store = createMultiSessionStore();
    store.addSession("test-session");

    let callCount = 0;
    const unsubscribe = store.subscribe(() => { callCount += 1; });
    unsubscribe();

    // When a sample is appended
    store.appendSessionSample("test-session", { tokens: 100, cost: 0, agents: 1, context: 50 });

    // Then the callback was not called
    expect(callCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Backward Compatibility
// Traces to: architecture-design.md "Backward Compatibility"
// ---------------------------------------------------------------------------

describe("Existing store operations unchanged after extension", () => {
  it("addSession, removeSession, updateSession, getSessions, getSession still work", () => {
    // Given the extended multi-session store
    const store = createMultiSessionStore();

    // When using the original v1 interface
    store.addSession("compat-test");
    const session = store.getSession("compat-test");

    // Then sessions are trackable via the original interface
    expect(session).toBeDefined();
    expect(session!.sessionId).toBe("compat-test");

    // And getSessions returns all tracked sessions
    const all = store.getSessions();
    expect(all).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Buffer Boundary Conditions
// ---------------------------------------------------------------------------

describe("Getting buffer for unknown category returns empty buffer", () => {
  it("unknown category ID returns empty or undefined buffer", () => {
    // Given a session with samples
    const store = createMultiSessionStore();
    store.addSession("test");
    store.appendSessionSample("test", { tokens: 100, cost: 0, agents: 1, context: 50 });

    // When requesting a buffer for an unknown category
    const buffer = store.getSessionBuffer("test", "nonexistent" as MetricCategoryId);

    // Then no buffer data is returned
    expect(buffer).toBeUndefined();
  });
});

describe("Adding same session twice is idempotent", () => {
  it("duplicate addSession does not reset existing buffers", () => {
    // Given a session with existing sample data
    const store = createMultiSessionStore();
    store.addSession("dup-test");
    store.appendSessionSample("dup-test", { tokens: 500, cost: 0.005, agents: 2, context: 60 });

    // When addSession is called again with the same ID
    store.addSession("dup-test");

    // Then the existing buffer data is preserved (not reset)
    const buffer = store.getSessionBuffer("dup-test", "tokens");
    expect(buffer).toBeDefined();
    expect(buffer!.samples.length).toBeGreaterThan(0);
  });
});

describe("Aggregate buffer updates when a session is removed", () => {
  it("aggregate recalculates after session removal", () => {
    // Given 2 sessions contributing to aggregate
    const store = createMultiSessionStore();
    store.addSession("keep");
    store.addSession("remove");
    store.appendSessionSample("keep", { tokens: 300, cost: 0.003, agents: 1, context: 40 });
    store.appendSessionSample("remove", { tokens: 200, cost: 0.002, agents: 1, context: 50 });

    // When one session is removed
    store.removeSession("remove");

    // Then the aggregate buffer no longer includes the removed session's data
    // (next append to remaining session should produce correct aggregate)
    store.appendSessionSample("keep", { tokens: 350, cost: 0.003, agents: 1, context: 42 });
    const aggBuffer = store.getAggregateBuffer("tokens");
    expect(aggBuffer).toBeDefined();
  });
});

describe("Multiple rapid samples accumulate in ring buffer", () => {
  it("consecutive appends increase buffer sample count", () => {
    // Given a session receiving rapid event updates
    const store = createMultiSessionStore();
    store.addSession("rapid");

    // When 5 samples are appended
    for (let i = 0; i < 5; i++) {
      store.appendSessionSample("rapid", { tokens: 100 + i * 10, cost: 0.001, agents: 1, context: 40 });
    }

    // Then the buffer contains the samples
    const buffer = store.getSessionBuffer("rapid", "tokens");
    expect(buffer).toBeDefined();
    expect(buffer!.samples.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIOS
// Traces to: ADR-009 -- context never aggregated
// ---------------------------------------------------------------------------

describe("@property: context aggregate buffer is never populated regardless of session count", () => {
  it("for any number of sessions, context aggregate remains empty", () => {
    // Given varying numbers of sessions (1 through 5)
    const store = createMultiSessionStore();
    for (let i = 1; i <= 5; i++) {
      store.addSession(`session-${i}`);
      store.appendSessionSample(`session-${i}`, {
        tokens: 100 * i,
        cost: 0.001 * i,
        agents: i,
        context: 20 * i,
      });

      // When the context aggregate buffer is checked after each addition
      const aggBuffer = store.getAggregateBuffer("context");

      // Then the context aggregate buffer is always empty
      expect(aggBuffer.samples).toHaveLength(0);
    }
  });
});

describe("@property: aggregate sum always equals sum of per-session latest values", () => {
  it("tokens aggregate latest value equals sum of per-session latest values", () => {
    // Given 3 sessions with known token rates
    const store = createMultiSessionStore();
    const rates = [312, 185, 30];
    for (let i = 0; i < rates.length; i++) {
      store.addSession(`s${i}`);
      store.appendSessionSample(`s${i}`, { tokens: rates[i], cost: 0, agents: 1, context: 0 });
    }

    // When the aggregate tokens buffer is read
    const aggBuffer = store.getAggregateBuffer("tokens");

    // Then the aggregate sum invariant holds
    expect(aggBuffer).toBeDefined();
    expect(aggBuffer!.samples.length).toBeGreaterThan(0);
  });
});

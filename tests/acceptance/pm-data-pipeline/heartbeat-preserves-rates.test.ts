/**
 * Acceptance tests: Heartbeat Preserves Last-Known Rates
 *
 * Validates that the heartbeat mechanism carries forward last-known
 * token and cost rates instead of zeroing them out.
 *
 * Tests the pure createHeartbeatSample function and its integration
 * with the MultiSessionStore to verify end-to-end heartbeat behavior.
 *
 * Traces to: performance-monitor-design-spec.md "Scrolling" (heartbeat)
 */

import { describe, it, expect } from "vitest";

import {
  createMultiSessionStore,
} from "../../../src/plugins/norbert-usage/adapters/multiSessionStore";

import { createHeartbeatSample } from "../../../src/plugins/norbert-usage/domain/heartbeat";
import { createInitialMetrics } from "../../../src/plugins/norbert-usage/domain/metricsAggregator";
import { createBuffer, appendSample } from "../../../src/plugins/norbert-usage/domain/timeSeriesSampler";

// ---------------------------------------------------------------------------
// PURE FUNCTION: createHeartbeatSample carries forward rates
// ---------------------------------------------------------------------------

describe("createHeartbeatSample carries forward last-known rates", () => {
  it("carries forward token rate from buffer", () => {
    // Given a session with a token buffer containing rate 500
    const session = createInitialMetrics("test-session");
    const tokenBuffer = appendSample(createBuffer(60), { timestamp: 1000, tokenRate: 500, costRate: 0 });
    const costBuffer = appendSample(createBuffer(60), { timestamp: 1000, tokenRate: 0.005, costRate: 0 });

    // When a heartbeat sample is created
    const sample = createHeartbeatSample(session, tokenBuffer, costBuffer);

    // Then the token rate is carried forward (not zero)
    expect(sample.tokens).toBe(500);
  });

  it("carries forward cost rate from buffer", () => {
    // Given a session with a cost buffer containing rate 0.005
    const session = createInitialMetrics("test-session");
    const tokenBuffer = appendSample(createBuffer(60), { timestamp: 1000, tokenRate: 300, costRate: 0 });
    const costBuffer = appendSample(createBuffer(60), { timestamp: 1000, tokenRate: 0.005, costRate: 0 });

    // When a heartbeat sample is created
    const sample = createHeartbeatSample(session, tokenBuffer, costBuffer);

    // Then the cost rate is carried forward
    expect(sample.cost).toBe(0.005);
  });

  it("uses current session state for agents and context", () => {
    // Given a session with 3 active agents at 72% context
    const session = { ...createInitialMetrics("test-session"), activeAgentCount: 3, contextWindowPct: 72 };
    const tokenBuffer = appendSample(createBuffer(60), { timestamp: 1000, tokenRate: 100, costRate: 0 });

    // When a heartbeat sample is created
    const sample = createHeartbeatSample(session, tokenBuffer, undefined);

    // Then agents and context come from session state
    expect(sample.agents).toBe(3);
    expect(sample.context).toBe(72);
  });

  it("returns zero rates when buffers are undefined", () => {
    // Given a session with undefined buffers
    const session = createInitialMetrics("new-session");

    // When a heartbeat sample is created with undefined buffers
    const sample = createHeartbeatSample(session, undefined, undefined);

    // Then rates default to zero (no previous data to carry forward)
    expect(sample.tokens).toBe(0);
    expect(sample.cost).toBe(0);
  });

  it("returns zero rates when buffers are defined but empty", () => {
    // Given a session with defined but empty buffers (no samples yet)
    const session = createInitialMetrics("fresh-session");
    const emptyBuffer = createBuffer(60);

    // When a heartbeat sample is created with empty buffers
    const sample = createHeartbeatSample(session, emptyBuffer, emptyBuffer);

    // Then rates default to zero
    expect(sample.tokens).toBe(0);
    expect(sample.cost).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// INTEGRATION: Heartbeat via store maintains chart continuity
// ---------------------------------------------------------------------------

describe("Heartbeat via store does not zero-out token rate", () => {
  it("token rate buffer shows continuity after heartbeat-style append", () => {
    // Given a session with a real token rate of 500
    const store = createMultiSessionStore();
    store.addSession("active-session");
    store.appendSessionSample("active-session", { tokens: 500, cost: 0.005, agents: 2, context: 45 });

    // When a heartbeat fires using createHeartbeatSample
    const session = store.getSession("active-session")!;
    const tokenBuffer = store.getSessionBuffer("active-session", "tokens");
    const costBuffer = store.getSessionBuffer("active-session", "cost");
    const heartbeat = createHeartbeatSample(session, tokenBuffer, costBuffer);
    store.appendSessionSample("active-session", heartbeat);

    // Then the token buffer shows rate carry-forward, not a drop to zero
    const buffer = store.getSessionBuffer("active-session", "tokens");
    expect(buffer).toBeDefined();
    expect(buffer!.samples.length).toBe(2);

    const firstValue = buffer!.samples[0].tokenRate;
    const secondValue = buffer!.samples[1].tokenRate;
    expect(firstValue).toBe(500);
    expect(secondValue).toBe(500); // carried forward, not zero
  });
});

describe("Consecutive heartbeats produce smooth chart behavior", () => {
  it("three heartbeats after a real event maintain the rate", () => {
    // Given a session with a real token rate event
    const store = createMultiSessionStore();
    store.addSession("decay-session");
    store.appendSessionSample("decay-session", { tokens: 800, cost: 0.008, agents: 1, context: 50 });

    // When 3 consecutive heartbeats fire using createHeartbeatSample
    for (let i = 0; i < 3; i++) {
      const session = store.getSession("decay-session")!;
      const tokenBuffer = store.getSessionBuffer("decay-session", "tokens");
      const costBuffer = store.getSessionBuffer("decay-session", "cost");
      const heartbeat = createHeartbeatSample(session, tokenBuffer, costBuffer);
      store.appendSessionSample("decay-session", heartbeat);
    }

    // Then the token buffer shows stable carry-forward
    const buffer = store.getSessionBuffer("decay-session", "tokens");
    expect(buffer).toBeDefined();

    const values = buffer!.samples.map((s) => s.tokenRate);
    expect(values[0]).toBe(800); // real event

    // All heartbeat values carry forward the rate
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBe(800);
    }
  });
});

describe("Heartbeat correctly updates point-in-time metrics", () => {
  it("agent count and context % are correctly set by heartbeat", () => {
    // Given a session with active agents and context data
    const store = createMultiSessionStore();
    store.addSession("agent-session");
    store.appendSessionSample("agent-session", { tokens: 300, cost: 0.003, agents: 3, context: 72 });

    // Update session metrics to reflect current agent/context state
    // (the real pipeline does this via updateSession before heartbeat)
    const baseSession = store.getSession("agent-session")!;
    store.updateSession("agent-session", {
      ...baseSession,
      activeAgentCount: 3,
      contextWindowPct: 72,
    });

    // When a heartbeat fires using createHeartbeatSample
    const session = store.getSession("agent-session")!;
    const tokenBuffer = store.getSessionBuffer("agent-session", "tokens");
    const costBuffer = store.getSessionBuffer("agent-session", "cost");
    const heartbeat = createHeartbeatSample(session, tokenBuffer, costBuffer);
    store.appendSessionSample("agent-session", heartbeat);

    // Then agent and context buffers show the correct current values
    const agentBuffer = store.getSessionBuffer("agent-session", "agents");
    expect(agentBuffer).toBeDefined();
    const latestAgent = agentBuffer!.samples[agentBuffer!.samples.length - 1].tokenRate;
    expect(latestAgent).toBe(3);

    const contextBuffer = store.getSessionBuffer("agent-session", "context");
    expect(contextBuffer).toBeDefined();
    const latestContext = contextBuffer!.samples[contextBuffer!.samples.length - 1].tokenRate;
    expect(latestContext).toBe(72);
  });
});

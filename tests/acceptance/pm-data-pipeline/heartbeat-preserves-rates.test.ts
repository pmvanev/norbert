/**
 * Acceptance tests: Heartbeat Injects Zero Rates
 *
 * Validates that the heartbeat mechanism injects zero for rate-based
 * categories (tokens, cost) because no tokens/dollars are flowing
 * during idle periods. Point-in-time categories (agents, context)
 * reflect current session state.
 *
 * Traces to: performance-monitor-design-spec.md "Scrolling" (heartbeat)
 */

import { describe, it, expect } from "vitest";

import {
  createMultiSessionStore,
} from "../../../src/plugins/norbert-usage/adapters/multiSessionStore";

import { createHeartbeatSample } from "../../../src/plugins/norbert-usage/domain/heartbeat";
import { createInitialMetrics } from "../../../src/plugins/norbert-usage/domain/metricsAggregator";

// ---------------------------------------------------------------------------
// PURE FUNCTION: createHeartbeatSample injects zero rates
// ---------------------------------------------------------------------------

describe("createHeartbeatSample injects zero for rate-based categories", () => {
  it("sets tokens and cost to zero during idle", () => {
    // Given a session (regardless of previous activity)
    const session = createInitialMetrics("test-session");

    // When a heartbeat sample is created
    const sample = createHeartbeatSample(session);

    // Then rate-based categories are zero (nothing flowing)
    expect(sample.tokens).toBe(0);
    expect(sample.cost).toBe(0);
  });

  it("uses current session state for agents and context", () => {
    // Given a session with 3 active agents at 72% context
    const session = { ...createInitialMetrics("test-session"), activeAgentCount: 3, contextWindowPct: 72 };

    // When a heartbeat sample is created
    const sample = createHeartbeatSample(session);

    // Then point-in-time categories reflect session state
    expect(sample.agents).toBe(3);
    expect(sample.context).toBe(72);
  });
});

// ---------------------------------------------------------------------------
// INTEGRATION: Heartbeat via store produces zero rates
// ---------------------------------------------------------------------------

describe("Heartbeat via store produces zero rate samples", () => {
  it("token rate drops to zero after heartbeat", () => {
    // Given a session with a real token rate of 500
    const store = createMultiSessionStore();
    store.addSession("active-session");
    store.appendSessionSample("active-session", { tokens: 500, cost: 0.005, agents: 2, context: 45 });

    // When a heartbeat fires
    const session = store.getSession("active-session")!;
    const heartbeat = createHeartbeatSample(session);
    store.appendSessionSample("active-session", heartbeat);

    // Then the token buffer shows the rate dropping to zero
    const buffer = store.getSessionBuffer("active-session", "tokens");
    expect(buffer).toBeDefined();
    expect(buffer!.samples.length).toBe(2);
    expect(buffer!.samples[0].tokenRate).toBe(500);
    expect(buffer!.samples[1].tokenRate).toBe(0);
  });
});

describe("Heartbeat correctly updates point-in-time metrics via store", () => {
  it("agent count and context % are correctly set by heartbeat", () => {
    // Given a session with active agents and context data
    const store = createMultiSessionStore();
    store.addSession("agent-session");
    store.appendSessionSample("agent-session", { tokens: 300, cost: 0.003, agents: 3, context: 72 });

    // Update session metrics to reflect current state
    const baseSession = store.getSession("agent-session")!;
    store.updateSession("agent-session", {
      ...baseSession,
      activeAgentCount: 3,
      contextWindowPct: 72,
    });

    // When a heartbeat fires
    const session = store.getSession("agent-session")!;
    const heartbeat = createHeartbeatSample(session);
    store.appendSessionSample("agent-session", heartbeat);

    // Then agent and context buffers show current values
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

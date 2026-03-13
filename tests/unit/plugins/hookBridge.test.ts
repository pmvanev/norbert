/// Unit tests for hookBridge — hook processor registration and event delivery.
///
/// Tests the pure functions for managing hook processor registrations
/// and delivering events to registered processors.

import { describe, it, expect, beforeEach } from "vitest";
import {
  createHookBridge,
  registerHookProcessor,
  deliverHookEvent,
  getStatusItem,
  registerStatusItem,
  updateStatusItem,
  resetHookBridge,
} from "../../../src/plugins/hookBridge";

// ---------------------------------------------------------------------------
// Hook processor registration and delivery
// ---------------------------------------------------------------------------

describe("registerHookProcessor", () => {
  beforeEach(() => {
    resetHookBridge();
  });

  it("registers a processor that receives events for the given hook name", () => {
    const received: unknown[] = [];
    registerHookProcessor("team-monitor", "team-events", (payload) => {
      received.push(payload);
    });

    const testPayload = { type: "update", member: "alice" };
    deliverHookEvent("team-events", testPayload);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(testPayload);
  });

  it("does not deliver events to processors registered for a different hook name", () => {
    const received: unknown[] = [];
    registerHookProcessor("team-monitor", "team-events", (payload) => {
      received.push(payload);
    });

    deliverHookEvent("other-events", { type: "something" });

    expect(received).toHaveLength(0);
  });

  it("delivers events to multiple processors registered for the same hook name", () => {
    const receivedA: unknown[] = [];
    const receivedB: unknown[] = [];

    registerHookProcessor("plugin-a", "shared-hook", (p) => receivedA.push(p));
    registerHookProcessor("plugin-b", "shared-hook", (p) => receivedB.push(p));

    const payload = { data: "test" };
    deliverHookEvent("shared-hook", payload);

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
    expect(receivedA[0]).toEqual(payload);
    expect(receivedB[0]).toEqual(payload);
  });

  it("returns a HookRegistration record with pluginId and hookName", () => {
    const registration = registerHookProcessor(
      "team-monitor",
      "team-events",
      () => {}
    );

    expect(registration.pluginId).toBe("team-monitor");
    expect(registration.hookName).toBe("team-events");
  });
});

// ---------------------------------------------------------------------------
// Status item management
// ---------------------------------------------------------------------------

describe("registerStatusItem", () => {
  beforeEach(() => {
    resetHookBridge();
  });

  it("registers a status item and makes it retrievable", () => {
    registerStatusItem("team-monitor", {
      id: "team-status",
      label: "Team: 0 online",
      icon: "users",
      position: "left",
      order: 10,
    });

    const item = getStatusItem("team-monitor", "team-status");
    expect(item).toBeDefined();
    expect(item!.id).toBe("team-status");
    expect(item!.label).toBe("Team: 0 online");
    expect(item!.icon).toBe("users");
    expect(item!.position).toBe("left");
  });

  it("returns undefined for unregistered status items", () => {
    const item = getStatusItem("team-monitor", "nonexistent");
    expect(item).toBeUndefined();
  });
});

describe("updateStatusItem", () => {
  beforeEach(() => {
    resetHookBridge();
  });

  it("updates label of an existing status item", () => {
    registerStatusItem("team-monitor", {
      id: "team-status",
      label: "Team: 0 online",
      icon: "users",
      position: "left",
      order: 10,
    });

    updateStatusItem("team-monitor", "team-status", { label: "Team: 3 online" });

    const item = getStatusItem("team-monitor", "team-status");
    expect(item).toBeDefined();
    expect(item!.label).toBe("Team: 3 online");
  });

  it("updates icon of an existing status item without changing other fields", () => {
    registerStatusItem("team-monitor", {
      id: "team-status",
      label: "Team: 0 online",
      icon: "users",
      position: "left",
      order: 10,
    });

    updateStatusItem("team-monitor", "team-status", { icon: "check" });

    const item = getStatusItem("team-monitor", "team-status");
    expect(item!.label).toBe("Team: 0 online");
    expect(item!.icon).toBe("check");
  });
});

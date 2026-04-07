/**
 * Unit tests: norbert-usage plugin manifest and entry point.
 *
 * Validates the plugin manifest structure, onLoad registrations,
 * and onUnload cleanup behavior.
 *
 * Tests use pure function stubs for the NorbertAPI (no mock libraries).
 */

import { describe, it, expect } from "vitest";
import { norbertUsagePlugin } from "../../../../src/plugins/norbert-usage/index";
import type {
  NorbertAPI,
  RegisterViewInput,
  RegisterTabInput,
  RegisterStatusItemInput,
  HookProcessor,
} from "../../../../src/plugins/types";

// ---------------------------------------------------------------------------
// Stub API factory — pure function test doubles
// ---------------------------------------------------------------------------

interface ApiCalls {
  readonly views: RegisterViewInput[];
  readonly tabs: RegisterTabInput[];
  readonly statusItems: RegisterStatusItemInput[];
  readonly hooks: Array<{ hookName: string; processor: HookProcessor }>;
}

const createStubApi = (): { api: NorbertAPI; calls: ApiCalls } => {
  const calls: ApiCalls = {
    views: [],
    tabs: [],
    statusItems: [],
    hooks: [],
  };

  const api: NorbertAPI = {
    db: { _brand: "DbAPI" as const, execute: () => ({ ok: true as const }) },
    hooks: {
      _brand: "HooksAPI" as const,
      register: (hookName: string, processor: HookProcessor) => {
        calls.hooks.push({ hookName, processor });
      },
    },
    ui: {
      _brand: "UiAPI" as const,
      registerView: (input: RegisterViewInput) => {
        calls.views.push(input);
      },
      registerTab: (input: RegisterTabInput) => {
        calls.tabs.push(input);
      },
      registerStatusItem: (input: RegisterStatusItemInput) => {
        calls.statusItems.push(input);
        return { update: () => {} };
      },
    },
    mcp: { _brand: "McpAPI" as const },
    events: { _brand: "EventsAPI" as const },
    config: { _brand: "ConfigAPI" as const },
    plugins: {
      _brand: "PluginsAPI" as const,
      get: () => ({ ok: false as const, error: "not available" }),
    },
  };

  return { api, calls };
};

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

describe("norbert-usage manifest", () => {
  it("declares id 'norbert-usage' with no plugin dependencies", () => {
    const { manifest } = norbertUsagePlugin;
    expect(manifest.id).toBe("norbert-usage");
    expect(manifest.name).toBe("Usage");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.norbert_api).toBe(">=1.0");
    expect(manifest.dependencies).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// View registrations
// ---------------------------------------------------------------------------

describe("norbert-usage onLoad view registrations", () => {
  it("registers exactly 3 views: usage-dashboard, session-status, performance-monitor", () => {
    const { api, calls } = createStubApi();
    norbertUsagePlugin.onLoad(api);

    expect(calls.views).toHaveLength(3);
    const viewIds = calls.views.map((v) => v.id);
    expect(viewIds).toContain("usage-dashboard");
    expect(viewIds).toContain("session-status");
    expect(viewIds).toContain("performance-monitor");
    expect(viewIds).not.toContain("gauge-cluster");
    expect(viewIds).not.toContain("session-dashboard");
  });

  it("performance-monitor is not primary and has no floatMetric", () => {
    const { api, calls } = createStubApi();
    norbertUsagePlugin.onLoad(api);

    const pm = calls.views.find((v) => v.id === "performance-monitor");
    expect(pm).toBeDefined();
    expect(pm!.primaryView).toBe(false);
    expect(pm!.floatMetric).toBeNull();
    expect(pm!.label).toBe("Performance Monitor");
  });

  it("session-status is secondary-only and has no floatMetric", () => {
    const { api, calls } = createStubApi();
    norbertUsagePlugin.onLoad(api);

    const sessionStatus = calls.views.find((v) => v.id === "session-status");
    expect(sessionStatus).toBeDefined();
    expect(sessionStatus!.primaryView).toBe(false);
    expect(sessionStatus!.floatMetric).toBeNull();
    expect(sessionStatus!.label).toBe("Session Status");
  });

  it("usage-dashboard is the primaryView", () => {
    const { api, calls } = createStubApi();
    norbertUsagePlugin.onLoad(api);

    const dashboard = calls.views.find((v) => v.id === "usage-dashboard");
    expect(dashboard).toBeDefined();
    expect(dashboard!.primaryView).toBe(true);
    expect(dashboard!.label).toBe("Usage Dashboard");
  });

  it("performance-monitor uses the activity icon", () => {
    const { api, calls } = createStubApi();
    norbertUsagePlugin.onLoad(api);

    const pm = calls.views.find((v) => v.id === "performance-monitor");
    expect(pm).toBeDefined();
    expect(pm!.icon).toBe("square-activity");
  });
});

// ---------------------------------------------------------------------------
// Tab registration
// ---------------------------------------------------------------------------

describe("norbert-usage onLoad tab registration", () => {
  it("registers a 'usage' tab with order 1", () => {
    const { api, calls } = createStubApi();
    norbertUsagePlugin.onLoad(api);

    expect(calls.tabs).toHaveLength(1);
    expect(calls.tabs[0].id).toBe("usage");
    expect(calls.tabs[0].label).toBe("Usage");
    expect(calls.tabs[0].order).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Status item registration
// ---------------------------------------------------------------------------

describe("norbert-usage onLoad status item registration", () => {
  it("registers 'cost-ticker' on the right", () => {
    const { api, calls } = createStubApi();
    norbertUsagePlugin.onLoad(api);

    expect(calls.statusItems).toHaveLength(1);
    expect(calls.statusItems[0].id).toBe("cost-ticker");
    expect(calls.statusItems[0].position).toBe("right");
  });
});

// ---------------------------------------------------------------------------
// Hook processor registration
// ---------------------------------------------------------------------------

describe("norbert-usage onLoad hook registration", () => {
  it("registers at least one hook processor for 'session-event'", () => {
    const { api, calls } = createStubApi();
    norbertUsagePlugin.onLoad(api);

    expect(calls.hooks.length).toBeGreaterThanOrEqual(1);
    expect(calls.hooks.some((h) => h.hookName === "session-event")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// onUnload
// ---------------------------------------------------------------------------

describe("norbert-usage onUnload", () => {
  it("does not throw on unload", () => {
    expect(() => norbertUsagePlugin.onUnload()).not.toThrow();
  });
});

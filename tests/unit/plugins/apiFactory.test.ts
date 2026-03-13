/**
 * Unit tests: NorbertAPI Factory
 *
 * Validates that createNorbertAPI produces a scoped API instance
 * per plugin, with all 7 sub-APIs present, and that registerView/registerTab
 * inject the pluginId automatically.
 */

import { describe, it, expect } from "vitest";
import { createNorbertAPI } from "../../../src/plugins/apiFactory";
import { NORBERT_API_KEYS } from "../../../src/plugins/types";
import type {
  NorbertAPI,
  ViewRegistration,
  TabRegistration,
} from "../../../src/plugins/types";

describe("createNorbertAPI", () => {
  it("returns an API object with all 7 required sub-API keys", () => {
    const collected: { views: ViewRegistration[]; tabs: TabRegistration[] } = {
      views: [],
      tabs: [],
    };
    const api = createNorbertAPI("test-plugin", collected);

    for (const key of NORBERT_API_KEYS) {
      expect(api).toHaveProperty(key);
      expect(api[key]).toBeDefined();
    }
  });

  it("ui.registerView injects pluginId into the ViewRegistration", () => {
    const collected: { views: ViewRegistration[]; tabs: TabRegistration[] } = {
      views: [],
      tabs: [],
    };
    const api = createNorbertAPI("team-monitor", collected);

    api.ui.registerView({
      id: "team-dashboard",
      label: "Team Dashboard",
      icon: "users",
      primaryView: true,
      minWidth: 300,
      minHeight: 200,
      floatMetric: null,
    });

    expect(collected.views).toHaveLength(1);
    expect(collected.views[0].pluginId).toBe("team-monitor");
    expect(collected.views[0].id).toBe("team-dashboard");
  });

  it("ui.registerTab injects pluginId into the TabRegistration", () => {
    const collected: { views: ViewRegistration[]; tabs: TabRegistration[] } = {
      views: [],
      tabs: [],
    };
    const api = createNorbertAPI("team-monitor", collected);

    api.ui.registerTab({
      id: "team-tab",
      icon: "users",
      label: "Team Monitor",
      order: 5,
    });

    expect(collected.tabs).toHaveLength(1);
    expect(collected.tabs[0].pluginId).toBe("team-monitor");
    expect(collected.tabs[0].id).toBe("team-tab");
  });

  it("creates distinct API instances per plugin with separate scoping", () => {
    const collectedA: { views: ViewRegistration[]; tabs: TabRegistration[] } = {
      views: [],
      tabs: [],
    };
    const collectedB: { views: ViewRegistration[]; tabs: TabRegistration[] } = {
      views: [],
      tabs: [],
    };

    const apiA = createNorbertAPI("plugin-a", collectedA);
    const apiB = createNorbertAPI("plugin-b", collectedB);

    apiA.ui.registerView({
      id: "view-a",
      label: "A",
      icon: "a",
      primaryView: true,
      minWidth: 200,
      minHeight: 100,
      floatMetric: null,
    });

    expect(collectedA.views).toHaveLength(1);
    expect(collectedB.views).toHaveLength(0);
  });
});

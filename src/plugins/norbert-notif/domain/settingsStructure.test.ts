/// Unit tests for settings section structure.
///
/// Tests the pure data that defines the settings view registration
/// and its sub-sections.

import { describe, it, expect } from "vitest";
import {
  NOTIF_SETTINGS_VIEW_ID,
  NOTIF_SETTINGS_VIEW_LABEL,
  NOTIF_SETTINGS_SUB_SECTIONS,
} from "./settingsStructure";

describe("settings structure constants", () => {
  it("settings view has id 'notif-settings'", () => {
    expect(NOTIF_SETTINGS_VIEW_ID).toBe("notif-settings");
  });

  it("settings view has label 'Notifications'", () => {
    expect(NOTIF_SETTINGS_VIEW_LABEL).toBe("Notifications");
  });

  it("defines three sub-sections: Events, Channels, Do Not Disturb", () => {
    expect(NOTIF_SETTINGS_SUB_SECTIONS).toHaveLength(3);

    const labels = NOTIF_SETTINGS_SUB_SECTIONS.map((s) => s.label);
    expect(labels).toContain("Events");
    expect(labels).toContain("Channels");
    expect(labels).toContain("Do Not Disturb");
  });

  it("each sub-section has a unique id", () => {
    const ids = NOTIF_SETTINGS_SUB_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

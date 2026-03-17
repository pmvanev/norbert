/// Unit tests for norbert-notif event registry.
///
/// Verifies the notification event source definitions:
/// - Each event source has a unique hook name
/// - The registry is a readonly array of event source descriptors
/// - All entries have required fields (hookName, label)

import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_EVENT_SOURCES,
  type NotificationEventSource,
} from "./eventRegistry";

describe("notification event registry", () => {
  it("contains at least one event source", () => {
    expect(NOTIFICATION_EVENT_SOURCES.length).toBeGreaterThanOrEqual(1);
  });

  it("every event source has a non-empty hookName", () => {
    for (const source of NOTIFICATION_EVENT_SOURCES) {
      expect(source.hookName).toBeTruthy();
      expect(typeof source.hookName).toBe("string");
    }
  });

  it("every event source has a non-empty label", () => {
    for (const source of NOTIFICATION_EVENT_SOURCES) {
      expect(source.label).toBeTruthy();
      expect(typeof source.label).toBe("string");
    }
  });

  it("all hook names are unique", () => {
    const hookNames = NOTIFICATION_EVENT_SOURCES.map((s) => s.hookName);
    const unique = new Set(hookNames);
    expect(unique.size).toBe(hookNames.length);
  });
});

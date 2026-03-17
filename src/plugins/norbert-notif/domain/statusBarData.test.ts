/// Unit tests for status bar data model.
///
/// Tests the pure functions that produce status bar label and icon
/// from DND state and unread count.

import { describe, it, expect } from "vitest";
import {
  formatStatusLabel,
  formatStatusIcon,
  type NotificationStatus,
} from "./statusBarData";

describe("formatStatusLabel", () => {
  it("shows DND off with zero unread count", () => {
    const status: NotificationStatus = { dndEnabled: false, unreadCount: 0 };
    expect(formatStatusLabel(status)).toBe("DND off \u00B7 0");
  });

  it("shows DND off with positive unread count", () => {
    const status: NotificationStatus = { dndEnabled: false, unreadCount: 5 };
    expect(formatStatusLabel(status)).toBe("DND off \u00B7 5");
  });

  it("shows DND on with zero unread count", () => {
    const status: NotificationStatus = { dndEnabled: true, unreadCount: 0 };
    expect(formatStatusLabel(status)).toBe("DND on \u00B7 0");
  });

  it("shows DND on with positive unread count", () => {
    const status: NotificationStatus = { dndEnabled: true, unreadCount: 3 };
    expect(formatStatusLabel(status)).toBe("DND on \u00B7 3");
  });
});

describe("formatStatusIcon", () => {
  it("returns bell symbol when DND is off", () => {
    expect(formatStatusIcon(false)).toBe("\u2407");
  });

  it("returns muted bell symbol when DND is on", () => {
    expect(formatStatusIcon(true)).toBe("\u2205");
  });
});

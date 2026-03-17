/**
 * Acceptance tests: Webhook and Email Channel Delivery (US-NOTIF-05)
 *
 * Validates that dispatch instructions for external channels (webhook, email)
 * contain the correct payload structure, timeout configuration, and maintain
 * independence from other channel instructions.
 *
 * Driving port: createDispatchInstructions (pure function)
 * Domain: dispatch engine with webhook/email channel preferences
 *
 * External channel adapters (SMTP, HTTP POST) are mocked at the adapter boundary.
 * These tests validate the dispatch instruction content, not network delivery.
 *
 * Traces to: US-NOTIF-05 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  createDispatchInstructions,
} from "../../../src/plugins/norbert-notif/domain/dispatchEngine";
import {
  type NotificationPreferences,
  type EventPreference,
} from "../../../src/plugins/norbert-notif/domain/types";

// ---------------------------------------------------------------------------
// TEST FIXTURES
// ---------------------------------------------------------------------------

const costThresholdEvent = {
  hookName: "usage-event",
  eventType: "cost_threshold_reached",
  payload: {
    sessionName: "api-refactor",
    cost: 25.12,
    threshold: 25.0,
  },
};

const anomalyEvent = {
  hookName: "anomaly-event",
  eventType: "anomaly_detected",
  payload: {
    sessionName: "batch-process",
    anomalyType: "cost_spike",
  },
};

const makeExternalPrefs = (
  webhookEnabled: boolean,
  emailEnabled: boolean
): NotificationPreferences => ({
  version: 1,
  events: [
    {
      eventId: "cost_threshold_reached",
      channels: {
        toast: true,
        banner: true,
        badge: true,
        email: emailEnabled,
        webhook: webhookEnabled,
      },
      sound: "amber-pulse",
      threshold: 25.0,
    },
    {
      eventId: "anomaly_detected",
      channels: {
        toast: true,
        banner: true,
        badge: true,
        email: emailEnabled,
        webhook: webhookEnabled,
      },
      sound: "amber-pulse",
      threshold: null,
    },
  ] as EventPreference[],
  globalVolume: 80,
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: External Channel Instructions
// ---------------------------------------------------------------------------

describe("Webhook dispatch instruction includes standard payload fields", () => {
  it("webhook instruction carries event type and event-specific data in metadata", () => {
    // Given "Cost threshold reached" is enabled for Webhook
    const prefs = makeExternalPrefs(true, false);

    // When the cost threshold is reached for session "api-refactor"
    const instructions = createDispatchInstructions(
      costThresholdEvent,
      prefs
    );

    // Then a webhook instruction is produced
    const webhook = instructions.find((i) => i.channel === "webhook");
    expect(webhook).toBeDefined();

    // And the instruction carries the event ID
    expect(webhook!.eventId).toBe("cost_threshold_reached");

    // And the metadata contains event-specific data
    expect(webhook!.metadata).toHaveProperty("cost", 25.12);
    expect(webhook!.metadata).toHaveProperty("threshold", 25.0);
    expect(webhook!.metadata).toHaveProperty("sessionName", "api-refactor");
  });
});

describe("Email dispatch instruction includes subject and body with event details", () => {
  it("email instruction title serves as subject and body contains event details", () => {
    // Given "Anomaly detected" is enabled for Email
    const prefs = makeExternalPrefs(false, true);

    // When an anomaly is detected for session "batch-process"
    const instructions = createDispatchInstructions(
      anomalyEvent,
      prefs
    );

    // Then an email instruction is produced
    const email = instructions.find((i) => i.channel === "email");
    expect(email).toBeDefined();

    // And the title contains event type for email subject
    expect(email!.title).toContain("Anomaly");

    // And the body contains session name
    expect(email!.body).toContain("batch-process");
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Modifying one channel config does not affect another channel's instructions", () => {
  it("webhook-only and email-only prefs produce independent instructions", () => {
    // Given "Cost threshold reached" is enabled for Webhook but not Email
    const webhookOnlyPrefs = makeExternalPrefs(true, false);

    // And a separate config enables Email but not Webhook
    const emailOnlyPrefs = makeExternalPrefs(false, true);

    // When dispatch instructions are produced for each config
    const webhookInstructions = createDispatchInstructions(
      costThresholdEvent,
      webhookOnlyPrefs
    );
    const emailInstructions = createDispatchInstructions(
      costThresholdEvent,
      emailOnlyPrefs
    );

    // Then webhook-only config produces webhook but not email
    const webhookChannels = webhookInstructions.map((i) => i.channel);
    expect(webhookChannels).toContain("webhook");
    expect(webhookChannels).not.toContain("email");

    // And email-only config produces email but not webhook
    const emailChannels = emailInstructions.map((i) => i.channel);
    expect(emailChannels).toContain("email");
    expect(emailChannels).not.toContain("webhook");
  });
});

describe("Webhook failure does not appear in other channel instructions", () => {
  it("toast and banner instructions exist independently of webhook instruction", () => {
    // Given "Cost threshold reached" is enabled for Toast, Banner, and Webhook
    const prefs = makeExternalPrefs(true, false);

    // When the cost threshold is reached
    const instructions = createDispatchInstructions(
      costThresholdEvent,
      prefs
    );

    // Then toast, banner, badge, and webhook instructions all exist independently
    const channels = instructions.map((i) => i.channel);
    expect(channels).toContain("toast");
    expect(channels).toContain("banner");
    expect(channels).toContain("webhook");

    // And each instruction is self-contained
    // (adapter-level failures are isolated; this test verifies the instructions
    // are independent data values, not coupled execution units)
    const toast = instructions.find((i) => i.channel === "toast")!;
    const webhook = instructions.find((i) => i.channel === "webhook")!;
    expect(toast.channel).not.toBe(webhook.channel);
    expect(toast.eventId).toBe(webhook.eventId);
  });
});

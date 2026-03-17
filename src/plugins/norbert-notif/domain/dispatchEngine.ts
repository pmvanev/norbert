/// Dispatch engine for norbert-notif notification center.
///
/// Pure evaluation pipeline: given (event, preferences, dndState),
/// produces a readonly array of DispatchInstruction values.
///
/// No side effects. No IO imports. Adapters execute the instructions.

import type {
  ChannelId,
  ChannelToggles,
  DispatchInstruction,
  HookEvent,
  NotificationEventId,
  NotificationPreferences,
} from "./types";
import { findEventDisplay } from "./defaults";

// ---------------------------------------------------------------------------
// Channel resolution
// ---------------------------------------------------------------------------

/// The set of channel IDs in toggle order.
const CHANNEL_IDS: readonly ChannelId[] = [
  "toast",
  "banner",
  "badge",
  "email",
  "webhook",
] as const;

/// Channels that do not play sound (badge-only, silent delivery).
const SILENT_CHANNELS: ReadonlySet<ChannelId> = new Set(["badge", "email", "webhook"]);

/// Extract the list of enabled channels from a channel toggles record.
const enabledChannels = (toggles: ChannelToggles): readonly ChannelId[] =>
  CHANNEL_IDS.filter((channelId) => toggles[channelId]);

// ---------------------------------------------------------------------------
// Instruction building
// ---------------------------------------------------------------------------

/// Resolve the effective sound for a channel.
/// Silent channels (badge, email, webhook) and the "silence" sound both resolve to null.
const resolveEffectiveSound = (channel: ChannelId, sound: string): string | null =>
  SILENT_CHANNELS.has(channel) ? null : sound === "silence" ? null : sound;

/// Build a single dispatch instruction for one channel.
const buildInstruction = (
  channel: ChannelId,
  title: string,
  body: string,
  sound: string,
  volume: number,
  eventId: NotificationEventId,
  timestamp: string,
  metadata: Record<string, unknown>
): DispatchInstruction => ({
  channel,
  title,
  body,
  sound: resolveEffectiveSound(channel, sound),
  volume,
  isTest: false,
  eventId,
  timestamp,
  metadata,
});

// ---------------------------------------------------------------------------
// Test notification creation
// ---------------------------------------------------------------------------

/// Create a synthetic test notification instruction for a specified channel.
///
/// Pure function: (channel, preferences, getNow?) -> DispatchInstruction
///
/// The instruction always has isTest=true and a [TEST] prefix in the title.
/// It bypasses DND and does not require channel configuration -- the adapter
/// is responsible for handling unconfigured channel errors.
///
/// The eventId is "test_notification" -- a sentinel value distinguishing
/// test instructions from real event dispatches.
///
/// The optional getNow parameter enables pure testing by injecting a clock.
export const createTestNotification = (
  channel: ChannelId,
  preferences: NotificationPreferences,
  getNow: () => string = defaultGetNow
): DispatchInstruction => ({
  channel,
  title: "[TEST] Test Notification",
  body: "This is a test notification for channel verification.",
  sound: SILENT_CHANNELS.has(channel) ? null : "phosphor-ping",
  volume: preferences.globalVolume,
  isTest: true,
  eventId: "test_notification" as NotificationEventId,
  timestamp: getNow(),
  metadata: {},
});

// ---------------------------------------------------------------------------
// Dispatch pipeline
// ---------------------------------------------------------------------------

/// Default clock function -- returns current time as ISO string.
const defaultGetNow = (): string => new Date().toISOString();

/// Create dispatch instructions for a hook event given user preferences.
///
/// Pure function: (event, preferences, getNow?) -> readonly DispatchInstruction[]
///
/// The optional getNow parameter enables pure testing by injecting a clock.
///
/// DND filtering is NOT applied here. The caller is responsible for
/// pipelining dispatch instructions through applyDndToInstructions
/// separately. This keeps each stage composable and independently testable.
///
/// Returns an empty array when:
/// - The event type is not recognized in the event display registry
/// - No preference entry exists for the event type
/// - All channels are disabled for the event
export const createDispatchInstructions = (
  event: HookEvent,
  preferences: NotificationPreferences,
  getNow: () => string = defaultGetNow
): readonly DispatchInstruction[] => {
  // Step 1: Look up event display metadata
  const eventDisplay = findEventDisplay(event.eventType);
  if (!eventDisplay) {
    return [];
  }

  // Step 2: Find user preference for this event
  const eventPreference = preferences.events.find(
    (pref) => pref.eventId === event.eventType
  );
  if (!eventPreference) {
    return [];
  }

  // Step 3: Determine enabled channels
  const channels = enabledChannels(eventPreference.channels);
  if (channels.length === 0) {
    return [];
  }

  // Step 4: Format title and body
  const title = eventDisplay.title;
  const body = eventDisplay.formatBody(event.payload);

  // Step 5: Capture timestamp once for all instructions in this batch
  const timestamp = getNow();

  // Step 6: Build one instruction per enabled channel
  return channels.map((channel) =>
    buildInstruction(
      channel,
      title,
      body,
      eventPreference.sound,
      preferences.globalVolume,
      eventDisplay.eventId,
      timestamp,
      { ...event.payload }
    )
  );
};

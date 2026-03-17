/// norbert-notif plugin entry point.
///
/// Implements the NorbertPlugin interface using only the public NorbertAPI.
/// Registers a sidebar tab (notifications), a status bar item (DND + unread),
/// and hook processors for notification event sources.
///
/// This is a first-party plugin that loads via the standard plugin loader
/// identically to any third-party plugin.

import type { NorbertPlugin, NorbertAPI } from "../types";
import { NORBERT_NOTIF_MANIFEST } from "./manifest";
import { NOTIFICATION_EVENT_SOURCES } from "./domain/eventRegistry";

// ---------------------------------------------------------------------------
// Tab constants
// ---------------------------------------------------------------------------

const NOTIF_TAB_ID = "notifications";
const NOTIF_TAB_LABEL = "Notifications";
const NOTIF_TAB_ICON = "\u2407"; // bell symbol (Unicode BEL)
const NOTIF_TAB_ORDER = 3;

// ---------------------------------------------------------------------------
// Status bar constants
// ---------------------------------------------------------------------------

const NOTIF_STATUS_ID = "notif-status";
const NOTIF_STATUS_LABEL = "DND off \u00B7 0";
const NOTIF_STATUS_ICON = "\u2407"; // bell symbol
const NOTIF_STATUS_POSITION = "left" as const;
const NOTIF_STATUS_ORDER = 0;

// ---------------------------------------------------------------------------
// Hook processor — minimal no-op for walking skeleton
// ---------------------------------------------------------------------------

/// Creates a no-op hook processor for the walking skeleton.
/// Future steps will wire this to the notification domain logic.
const createNotifHookProcessor = () => (_payload: unknown): void => {
  // No-op: hook processor registration establishes the wiring.
  // Actual event processing will be implemented in subsequent steps.
};

// ---------------------------------------------------------------------------
// Plugin lifecycle
// ---------------------------------------------------------------------------

/// Registers the notifications sidebar tab, status bar item, and hook
/// processors for all notification event sources via the public API.
///
/// Pure registration function: calls only api.ui.registerTab(),
/// api.ui.registerStatusItem(), and api.hooks.register().
/// No internal Norbert modules are accessed.
const onLoad = (api: NorbertAPI): void => {
  // Register sidebar tab for notifications
  api.ui.registerTab({
    id: NOTIF_TAB_ID,
    icon: NOTIF_TAB_ICON,
    label: NOTIF_TAB_LABEL,
    order: NOTIF_TAB_ORDER,
  });

  // Register status bar item (DND state + unread count)
  api.ui.registerStatusItem({
    id: NOTIF_STATUS_ID,
    label: NOTIF_STATUS_LABEL,
    icon: NOTIF_STATUS_ICON,
    position: NOTIF_STATUS_POSITION,
    order: NOTIF_STATUS_ORDER,
  });

  // Register hook processors for each notification event source
  const processor = createNotifHookProcessor();
  for (const source of NOTIFICATION_EVENT_SOURCES) {
    api.hooks.register(source.hookName, processor);
  }
};

/// Cleanup function called when the plugin is unloaded.
const onUnload = (): void => {
  // No cleanup needed for the walking skeleton.
  // Future: unsubscribe from event sources, clear notification state.
};

/// The norbert-notif plugin instance.
/// Satisfies the NorbertPlugin interface for standard plugin loading.
export const norbertNotifPlugin: NorbertPlugin = {
  manifest: NORBERT_NOTIF_MANIFEST,
  onLoad,
  onUnload,
};

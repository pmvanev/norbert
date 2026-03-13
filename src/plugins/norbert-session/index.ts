/// norbert-session plugin entry point.
///
/// Implements the NorbertPlugin interface using only the public NorbertAPI.
/// Registers Session List and Session Detail views, a sidebar tab,
/// and a hook processor for session events.
///
/// This is a first-party plugin that loads via the standard plugin loader
/// identically to any third-party plugin.

import type { NorbertPlugin, NorbertAPI } from "../types";
import { NORBERT_SESSION_MANIFEST } from "./manifest";
import {
  SESSION_LIST_VIEW_ID,
  SESSION_LIST_VIEW_LABEL,
  SESSION_LIST_VIEW_ICON,
} from "./sessionListView";
import {
  SESSION_DETAIL_VIEW_ID,
  SESSION_DETAIL_VIEW_LABEL,
  SESSION_DETAIL_VIEW_ICON,
} from "./sessionDetailView";
import { createSessionHookProcessor } from "./hookProcessor";

/// Registers all norbert-session views, tabs, and hooks via the public API.
///
/// Pure registration function: calls only api.ui.registerView(),
/// api.ui.registerTab(), and api.hooks.register().
/// No internal Norbert modules are accessed.
const onLoad = (api: NorbertAPI): void => {
  // Register the Session List as the primary view
  api.ui.registerView({
    id: SESSION_LIST_VIEW_ID,
    label: SESSION_LIST_VIEW_LABEL,
    icon: SESSION_LIST_VIEW_ICON,
    primaryView: true,
    minWidth: 280,
    minHeight: 200,
    floatMetric: "active_session_count",
  });

  // Register the Session Detail as a secondary view
  api.ui.registerView({
    id: SESSION_DETAIL_VIEW_ID,
    label: SESSION_DETAIL_VIEW_LABEL,
    icon: SESSION_DETAIL_VIEW_ICON,
    primaryView: false,
    minWidth: 400,
    minHeight: 300,
    floatMetric: null,
  });

  // Register sidebar tab for quick access
  api.ui.registerTab({
    id: "sessions",
    icon: SESSION_LIST_VIEW_ICON,
    label: SESSION_LIST_VIEW_LABEL,
    order: 0,
  });

  // Register hook processor for session events
  const processor = createSessionHookProcessor();
  api.hooks.register("session-event", processor);
};

/// Cleanup function called when the plugin is unloaded.
const onUnload = (): void => {
  // No cleanup needed for the walking skeleton.
  // Future: unsubscribe from event sources, clear caches.
};

/// The norbert-session plugin instance.
/// Satisfies the NorbertPlugin interface for standard plugin loading.
export const norbertSessionPlugin: NorbertPlugin = {
  manifest: NORBERT_SESSION_MANIFEST,
  onLoad,
  onUnload,
};

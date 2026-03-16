/// norbert-config plugin entry point.
///
/// Implements the NorbertPlugin interface using only the public NorbertAPI.
/// Registers a primary view (config-viewer) and a sidebar tab (config).
///
/// This is a first-party plugin that loads via the standard plugin loader
/// identically to any third-party plugin.

import type { NorbertPlugin, NorbertAPI } from "../types";
import { NORBERT_CONFIG_MANIFEST } from "./manifest";

// ---------------------------------------------------------------------------
// View constants
// ---------------------------------------------------------------------------

const CONFIG_VIEWER_VIEW_ID = "config-viewer";
const CONFIG_VIEWER_VIEW_LABEL = "Configuration Viewer";
const CONFIG_VIEWER_VIEW_ICON = "\u2699"; // gear symbol

// ---------------------------------------------------------------------------
// Tab constants
// ---------------------------------------------------------------------------

const CONFIG_TAB_ID = "config";
const CONFIG_TAB_LABEL = "Config";
const CONFIG_TAB_ICON = "\u2699"; // gear symbol
const CONFIG_TAB_ORDER = 2;

// ---------------------------------------------------------------------------
// Plugin lifecycle
// ---------------------------------------------------------------------------

/// Registers the config-viewer view and config sidebar tab via the public API.
///
/// Pure registration function: calls only api.ui.registerView() and
/// api.ui.registerTab(). No internal Norbert modules are accessed.
const onLoad = (api: NorbertAPI): void => {
  // Register the Configuration Viewer as the primary view
  api.ui.registerView({
    id: CONFIG_VIEWER_VIEW_ID,
    label: CONFIG_VIEWER_VIEW_LABEL,
    icon: CONFIG_VIEWER_VIEW_ICON,
    primaryView: true,
    minWidth: 400,
    minHeight: 300,
    floatMetric: null,
  });

  // Register sidebar tab for quick access
  api.ui.registerTab({
    id: CONFIG_TAB_ID,
    icon: CONFIG_TAB_ICON,
    label: CONFIG_TAB_LABEL,
    order: CONFIG_TAB_ORDER,
  });
};

/// Cleanup function called when the plugin is unloaded.
const onUnload = (): void => {
  // No cleanup needed for the walking skeleton.
  // Future: unsubscribe from event sources, clear caches.
};

/// The norbert-config plugin instance.
/// Satisfies the NorbertPlugin interface for standard plugin loading.
export const norbertConfigPlugin: NorbertPlugin = {
  manifest: NORBERT_CONFIG_MANIFEST,
  onLoad,
  onUnload,
};

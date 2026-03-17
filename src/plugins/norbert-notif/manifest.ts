/// Plugin manifest for norbert-notif.
///
/// Declares the plugin's identity, version, and API compatibility.
/// No dependencies on other plugins -- norbert-notif is standalone.

import type { PluginManifest } from "../types";

/// The norbert-notif plugin manifest.
/// Uses only the public NorbertPlugin/NorbertAPI interface.
export const NORBERT_NOTIF_MANIFEST: PluginManifest = {
  id: "norbert-notif",
  name: "Notifications",
  version: "1.0.0",
  norbert_api: ">=1.0",
  dependencies: {},
} as const;

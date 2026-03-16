/// Plugin manifest for norbert-config.
///
/// Declares the plugin's identity, version, and API compatibility.
/// No dependencies on other plugins -- norbert-config is standalone.

import type { PluginManifest } from "../types";

/// The norbert-config plugin manifest.
/// Uses only the public NorbertPlugin/NorbertAPI interface.
export const NORBERT_CONFIG_MANIFEST: PluginManifest = {
  id: "norbert-config",
  name: "Configuration",
  version: "1.0.0",
  norbert_api: ">=1.0",
  dependencies: {},
} as const;

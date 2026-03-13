/// Plugin manifest for norbert-usage.
///
/// Declares the plugin's identity, version, and API compatibility.
/// No dependencies on other plugins -- norbert-usage is standalone.

import type { PluginManifest } from "../types";

/// The norbert-usage plugin manifest.
/// Uses only the public NorbertPlugin/NorbertAPI interface.
export const NORBERT_USAGE_MANIFEST: PluginManifest = {
  id: "norbert-usage",
  name: "Usage",
  version: "1.0.0",
  norbert_api: ">=1.0",
  dependencies: {},
} as const;

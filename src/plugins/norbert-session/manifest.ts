/// Plugin manifest for norbert-session.
///
/// Declares the plugin's identity, version, and API compatibility.
/// No dependencies on other plugins — norbert-session is standalone.

import type { PluginManifest } from "../types";

/// The norbert-session plugin manifest.
/// Uses only the public NorbertPlugin/NorbertAPI interface.
export const NORBERT_SESSION_MANIFEST: PluginManifest = {
  id: "norbert-session",
  name: "Norbert Session",
  version: "0.3.0",
  norbert_api: "^0.3.0",
  dependencies: {},
} as const;

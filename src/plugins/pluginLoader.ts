/// Plugin Loader — scan pipeline for discovering and validating plugins.
///
/// Pipeline: scan -> validate -> resolve -> load
/// For the walking skeleton, scan accepts in-memory plugin arrays.
/// Filesystem scanning will be added when the adapter boundary is implemented.

import type { PluginManifest, NorbertPlugin } from "./types";
import { PLUGIN_MANIFEST_REQUIRED_FIELDS } from "./types";

// ---------------------------------------------------------------------------
// Manifest validation
// ---------------------------------------------------------------------------

/// Result of manifest validation — either valid or invalid with missing fields.
export type ManifestValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly missingFields: readonly string[] };

/// Validates that a manifest contains all required fields.
/// Returns a validation result indicating which fields are missing, if any.
export const validateManifest = (
  manifest: PluginManifest
): ManifestValidationResult => {
  const asRecord = manifest as unknown as Record<string, unknown>;
  const missingFields = PLUGIN_MANIFEST_REQUIRED_FIELDS.filter(
    (field) =>
      asRecord[field] === undefined ||
      asRecord[field] === null ||
      asRecord[field] === ""
  );

  return missingFields.length === 0
    ? { valid: true }
    : { valid: false, missingFields };
};

// ---------------------------------------------------------------------------
// Plugin scanning
// ---------------------------------------------------------------------------

/// Scans for available plugins from an in-memory source.
/// In the walking skeleton, this is a pass-through for provided plugins.
/// Future adapters will scan node_modules or filesystem paths.
export const scanPlugins = (
  pluginSources: readonly NorbertPlugin[]
): readonly NorbertPlugin[] => [...pluginSources];

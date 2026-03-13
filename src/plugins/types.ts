/// Plugin architecture type definitions.
///
/// Algebraic data types for the plugin system: NorbertAPI contract,
/// PluginManifest, view/tab registrations, and dependency resolution errors.
///
/// Follows the pattern from domain/theme.ts: const arrays for known values,
/// type unions derived from arrays, readonly interfaces throughout.

// ---------------------------------------------------------------------------
// NorbertAPI sub-API keys
// ---------------------------------------------------------------------------

/// The 7 sub-APIs that compose the NorbertAPI contract.
/// Each plugin receives an api object with all of these as required properties.
export const NORBERT_API_KEYS = [
  "db",
  "hooks",
  "ui",
  "mcp",
  "events",
  "config",
  "plugins",
] as const;

export type NorbertApiKey = (typeof NORBERT_API_KEYS)[number];

/// Validates whether a value is a recognized NorbertAPI sub-API key.
export const isValidNorbertApiKey = (value: unknown): value is NorbertApiKey =>
  typeof value === "string" &&
  NORBERT_API_KEYS.includes(value as NorbertApiKey);

// ---------------------------------------------------------------------------
// Sub-API type placeholders
// ---------------------------------------------------------------------------

/// Database access API scoped to plugin namespace.
export interface DbAPI {
  readonly _brand: "DbAPI";
}

/// Callback type for hook event processors.
export type HookProcessor = (payload: unknown) => void;

/// A registered hook processor binding a plugin to a hook name.
export interface HookRegistration {
  readonly pluginId: string;
  readonly hookName: string;
}

/// Hook processor registration API.
export interface HooksAPI {
  readonly _brand: "HooksAPI";
  readonly register: (hookName: string, processor: HookProcessor) => void;
}

/// Input for registering a view from within a plugin's onLoad callback.
/// The pluginId is injected by the API factory, so plugins omit it.
export interface RegisterViewInput {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly primaryView: boolean;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly floatMetric: string | null;
}

/// Input for registering a sidebar tab from within a plugin's onLoad callback.
/// The pluginId is injected by the API factory, so plugins omit it.
export interface RegisterTabInput {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  readonly order: number;
}

/// Allowed positions for status bar items.
export const STATUS_ITEM_POSITIONS = ["left", "right"] as const;
export type StatusItemPosition = (typeof STATUS_ITEM_POSITIONS)[number];

/// Input for registering a status bar item from a plugin.
export interface RegisterStatusItemInput {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly position: StatusItemPosition;
  readonly order: number;
}

/// A registered status bar item with plugin ownership.
export interface StatusItemRegistration {
  readonly id: string;
  readonly pluginId: string;
  readonly label: string;
  readonly icon: string;
  readonly position: StatusItemPosition;
  readonly order: number;
}

/// Partial update for a status item (only specified fields change).
export interface StatusItemUpdate {
  readonly label?: string;
  readonly icon?: string;
}

/// Handle returned to plugin for dynamic updates to a status item.
export interface StatusItemHandle {
  readonly update: (changes: StatusItemUpdate) => void;
}

/// UI registration API (views, tabs, status items).
export interface UiAPI {
  readonly _brand: "UiAPI";
  readonly registerView: (input: RegisterViewInput) => void;
  readonly registerTab: (input: RegisterTabInput) => void;
  readonly registerStatusItem: (input: RegisterStatusItemInput) => StatusItemHandle;
}

/// MCP tool registration API.
export interface McpAPI {
  readonly _brand: "McpAPI";
}

/// Event subscription API.
export interface EventsAPI {
  readonly _brand: "EventsAPI";
}

/// Plugin-scoped configuration API.
export interface ConfigAPI {
  readonly _brand: "ConfigAPI";
}

/// Inter-plugin dependency access API.
export interface PluginsAPI {
  readonly _brand: "PluginsAPI";
}

// ---------------------------------------------------------------------------
// NorbertAPI — the contract exposed to each plugin
// ---------------------------------------------------------------------------

/// The complete API object passed to a plugin's onLoad callback.
/// All 7 sub-APIs are required (non-optional) properties.
export interface NorbertAPI {
  readonly db: DbAPI;
  readonly hooks: HooksAPI;
  readonly ui: UiAPI;
  readonly mcp: McpAPI;
  readonly events: EventsAPI;
  readonly config: ConfigAPI;
  readonly plugins: PluginsAPI;
}

// ---------------------------------------------------------------------------
// PluginManifest
// ---------------------------------------------------------------------------

/// Required fields in a plugin manifest, used for validation.
export const PLUGIN_MANIFEST_REQUIRED_FIELDS = [
  "id",
  "name",
  "version",
  "norbert_api",
  "dependencies",
] as const;

export type PluginManifestField = (typeof PLUGIN_MANIFEST_REQUIRED_FIELDS)[number];

/// Declares a plugin's identity, compatibility range, and dependencies.
export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly norbert_api: string;
  readonly dependencies: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// NorbertPlugin interface — the contract a plugin must implement
// ---------------------------------------------------------------------------

/// The interface every plugin package must export.
/// onLoad receives the sandboxed NorbertAPI; onUnload is called on shutdown.
export interface NorbertPlugin {
  readonly manifest: PluginManifest;
  readonly onLoad: (api: NorbertAPI) => void | Promise<void>;
  readonly onUnload: () => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// ViewRegistration
// ---------------------------------------------------------------------------

/// A view registered by a plugin for display in zones or floating panels.
export interface ViewRegistration {
  readonly id: string;
  readonly pluginId: string;
  readonly label: string;
  readonly icon: string;
  readonly primaryView: boolean;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly floatMetric: string | null;
}

// ---------------------------------------------------------------------------
// TabRegistration
// ---------------------------------------------------------------------------

/// A sidebar tab registered by a plugin.
export interface TabRegistration {
  readonly id: string;
  readonly pluginId: string;
  readonly icon: string;
  readonly label: string;
  readonly order: number;
}

// ---------------------------------------------------------------------------
// ResolutionError — dependency resolution failures
// ---------------------------------------------------------------------------

/// The three types of dependency resolution failure.
export const RESOLUTION_ERROR_TYPES = [
  "missing",
  "version_mismatch",
  "disabled",
] as const;

export type ResolutionErrorType = (typeof RESOLUTION_ERROR_TYPES)[number];

/// Validates whether a value is a recognized resolution error type.
export const isValidResolutionErrorType = (
  value: unknown
): value is ResolutionErrorType =>
  typeof value === "string" &&
  RESOLUTION_ERROR_TYPES.includes(value as ResolutionErrorType);

// ---------------------------------------------------------------------------
// PluginRegistry — immutable store of loaded plugin state
// ---------------------------------------------------------------------------

/// Immutable registry of all loaded plugins and their registrations.
export interface PluginRegistry {
  readonly views: readonly ViewRegistration[];
  readonly tabs: readonly TabRegistration[];
  readonly hookRegistrations: readonly HookRegistration[];
  readonly statusItems: readonly StatusItemRegistration[];
  readonly loadedPluginIds: readonly string[];
}

/// A dependency resolution error for a specific plugin.
export interface ResolutionError {
  readonly pluginId: string;
  readonly type: ResolutionErrorType;
  readonly dependency: string;
  readonly requiredVersion: string;
  readonly installedVersion: string | null;
}

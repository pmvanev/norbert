/// Hook Bridge — manages hook processor registration and event delivery.
///
/// This module maintains the runtime state for hook processors and status items.
/// Hook processors are registered by plugins and receive events when delivered.
/// Status items are mutable at the edge (dynamic updates) but tracked immutably
/// in the PluginRegistry for the initial registration snapshot.
///
/// This is an effects boundary — it holds mutable maps for runtime dispatch.
/// The pure PluginRegistry captures the registration metadata separately.

import type {
  HookProcessor,
  HookRegistration,
  RegisterStatusItemInput,
  StatusItemRegistration,
  StatusItemUpdate,
} from "./types";

// ---------------------------------------------------------------------------
// Module-level mutable state (effects boundary)
// ---------------------------------------------------------------------------

/// Map of hookName -> list of processors registered for that hook.
let hookProcessors: Map<string, Array<{ pluginId: string; processor: HookProcessor }>> = new Map();

/// Map of "pluginId:itemId" -> current status item state.
let statusItems: Map<string, StatusItemRegistration> = new Map();

// ---------------------------------------------------------------------------
// Hook processor registration and delivery
// ---------------------------------------------------------------------------

/// Registers a hook processor for a given plugin and hook name.
/// Returns a HookRegistration record for tracking in the registry.
export const registerHookProcessor = (
  pluginId: string,
  hookName: string,
  processor: HookProcessor
): HookRegistration => {
  const existing = hookProcessors.get(hookName) ?? [];
  hookProcessors.set(hookName, [...existing, { pluginId, processor }]);

  return { pluginId, hookName };
};

/// Delivers an event payload to all processors registered for the given hook name.
export const deliverHookEvent = (hookName: string, payload: unknown): void => {
  const processors = hookProcessors.get(hookName) ?? [];
  processors.forEach(({ processor }) => processor(payload));
};

// ---------------------------------------------------------------------------
// Status item management
// ---------------------------------------------------------------------------

/// Computes the storage key for a status item.
const statusItemKey = (pluginId: string, itemId: string): string =>
  `${pluginId}:${itemId}`;

/// Registers a status item and stores it for later retrieval and updates.
export const registerStatusItem = (
  pluginId: string,
  input: RegisterStatusItemInput
): StatusItemRegistration => {
  const registration: StatusItemRegistration = {
    ...input,
    pluginId,
  };
  statusItems.set(statusItemKey(pluginId, input.id), registration);
  return registration;
};

/// Retrieves the current state of a status item, or undefined if not found.
export const getStatusItem = (
  pluginId: string,
  itemId: string
): StatusItemRegistration | undefined =>
  statusItems.get(statusItemKey(pluginId, itemId));

/// Updates a status item with partial changes (label, icon).
/// Only the specified fields are updated; others remain unchanged.
export const updateStatusItem = (
  pluginId: string,
  itemId: string,
  changes: StatusItemUpdate
): void => {
  const key = statusItemKey(pluginId, itemId);
  const existing = statusItems.get(key);
  if (existing === undefined) return;

  statusItems.set(key, {
    ...existing,
    ...(changes.label !== undefined ? { label: changes.label } : {}),
    ...(changes.icon !== undefined ? { icon: changes.icon } : {}),
  });
};

// ---------------------------------------------------------------------------
// Reset (for test isolation)
// ---------------------------------------------------------------------------

/// Resets all hook processors and status items. Used for test isolation.
export const resetHookBridge = (): void => {
  hookProcessors = new Map();
  statusItems = new Map();
};

// ---------------------------------------------------------------------------
// Factory placeholder (unused but exported for API completeness)
// ---------------------------------------------------------------------------

/// Creates a fresh hook bridge state. Currently a no-op since state is module-level.
export const createHookBridge = (): void => {
  resetHookBridge();
};

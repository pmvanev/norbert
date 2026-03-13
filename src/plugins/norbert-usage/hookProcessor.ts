/// Hook processor for norbert-usage plugin.
///
/// Creates a pure hook processor function that accepts session event payloads.
/// This processor is registered via the public HooksAPI during plugin load.

import type { HookProcessor } from "../types";

/// Creates a usage event hook processor.
///
/// Returns a pure function that accepts unknown payloads safely.
/// The processor handles session-related events for usage tracking
/// (cost accumulation, token counting, etc.).
export const createUsageHookProcessor = (): HookProcessor => {
  return (_payload: unknown): void => {
    // Hook processor receives session events via the public HooksAPI.
    // The payload is validated and processed here.
    // For the walking skeleton, this is a no-op receiver that
    // demonstrates the hook registration pattern.
    // Future: parse payload, update usage metrics for views.
  };
};

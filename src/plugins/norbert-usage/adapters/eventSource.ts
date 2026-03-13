/**
 * Event Source adapter -- thin wiring between hook events and processor.
 *
 * Effect boundary: receives events from the hooks API and forwards
 * them to the hook processor function. No business logic.
 *
 * createEventSource(hooksApi, processor) => { start(), stop() }
 */

// ---------------------------------------------------------------------------
// Hooks API port -- minimal interface needed from the API
// ---------------------------------------------------------------------------

export interface EventSourceHooksApi {
  readonly register: (hookName: string, processor: (payload: unknown) => void) => void;
}

// ---------------------------------------------------------------------------
// Event Source interface
// ---------------------------------------------------------------------------

export interface EventSource {
  readonly start: () => void;
  readonly stop: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an event source that wires hook events to the processor.
 *
 * start() registers a session-event hook that delegates each payload
 * to the provided processor function.
 *
 * stop() is a lifecycle hook for cleanup (currently no-op since
 * the hooks API does not expose unregister).
 */
export const createEventSource = (
  hooksApi: EventSourceHooksApi,
  processor: (payload: unknown) => void,
): EventSource => {
  const start = (): void => {
    hooksApi.register("session-event", processor);
  };

  const stop = (): void => {
    // No-op: the hooks API does not currently expose unregister.
    // Future: track registration and call unregister when available.
  };

  return { start, stop };
};

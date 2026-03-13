/**
 * Unit tests: eventSource adapter (Step 03-03)
 *
 * The eventSource is a thin adapter that wires hook events from
 * the API hooks system to the processor function. No business logic.
 *
 * Behaviors tested:
 * - start() subscribes to hook events via API and forwards to processor
 * - stop() unsubscribes from hook events
 * - Processor receives each event payload forwarded by the adapter
 */

import { describe, it, expect } from "vitest";
import { createEventSource } from "../../../../../src/plugins/norbert-usage/adapters/eventSource";

// ---------------------------------------------------------------------------
// Stub API: simulates hook event subscription
// ---------------------------------------------------------------------------

interface StubHooksApi {
  readonly register: (hookName: string, processor: (payload: unknown) => void) => void;
  readonly registeredProcessors: Array<{ hookName: string; processor: (payload: unknown) => void }>;
}

const createStubHooksApi = (): StubHooksApi => {
  const registeredProcessors: Array<{ hookName: string; processor: (payload: unknown) => void }> = [];

  return {
    register: (hookName, processor) => {
      registeredProcessors.push({ hookName, processor });
    },
    registeredProcessors,
  };
};

// ---------------------------------------------------------------------------
// start() wires hook events to processor
// ---------------------------------------------------------------------------

describe("eventSource start", () => {
  it("registers a session-event hook via the API", () => {
    const hooksApi = createStubHooksApi();
    const receivedPayloads: unknown[] = [];
    const processor = (payload: unknown) => { receivedPayloads.push(payload); };

    const source = createEventSource(hooksApi, processor);
    source.start();

    expect(hooksApi.registeredProcessors).toHaveLength(1);
    expect(hooksApi.registeredProcessors[0].hookName).toBe("session-event");
  });

  it("forwards hook event payloads to the processor", () => {
    const hooksApi = createStubHooksApi();
    const receivedPayloads: unknown[] = [];
    const processor = (payload: unknown) => { receivedPayloads.push(payload); };

    const source = createEventSource(hooksApi, processor);
    source.start();

    // Simulate hook event delivery
    const testPayload = { event_type: "prompt_submit", usage: { input_tokens: 100 } };
    hooksApi.registeredProcessors[0].processor(testPayload);

    expect(receivedPayloads).toHaveLength(1);
    expect(receivedPayloads[0]).toEqual(testPayload);
  });
});

// ---------------------------------------------------------------------------
// stop() is callable without error
// ---------------------------------------------------------------------------

describe("eventSource stop", () => {
  it("does not throw when stopped", () => {
    const hooksApi = createStubHooksApi();
    const processor = () => {};

    const source = createEventSource(hooksApi, processor);
    source.start();

    expect(() => source.stop()).not.toThrow();
  });
});

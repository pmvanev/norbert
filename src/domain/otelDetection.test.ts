import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  isOtelActiveSession,
  OTEL_EVENT_TYPE,
  type SessionEvent,
} from "./otelDetection";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a non-OTel event type (any string except "api_request"). */
const nonOtelEventType = fc
  .string({ minLength: 1 })
  .filter((s) => s !== OTEL_EVENT_TYPE);

/** Generate a session event with a specific event type. */
const sessionEvent = (eventType: fc.Arbitrary<string>): fc.Arbitrary<SessionEvent> =>
  eventType.map((et) => ({ event_type: et }));

/** Generate a non-OTel session event. */
const nonOtelEvent: fc.Arbitrary<SessionEvent> = sessionEvent(nonOtelEventType);

// ---------------------------------------------------------------------------
// Acceptance: OTel-active detection
// ---------------------------------------------------------------------------

describe("isOtelActiveSession", () => {
  // AC: Sessions with api_request events skip transcript polling
  it("returns true when session has at least one api_request event", () => {
    fc.assert(
      fc.property(
        fc.array(nonOtelEvent),
        fc.array(nonOtelEvent),
        (before, after) => {
          const events: ReadonlyArray<SessionEvent> = [
            ...before,
            { event_type: OTEL_EVENT_TYPE },
            ...after,
          ];
          expect(isOtelActiveSession(events)).toBe(true);
        },
      ),
    );
  });

  // AC: Sessions without api_request events continue transcript polling
  it("returns false when session has no api_request events", () => {
    fc.assert(
      fc.property(fc.array(nonOtelEvent), (events) => {
        expect(isOtelActiveSession(events)).toBe(false);
      }),
    );
  });

  // AC: First api_request triggers detection
  it("returns true even with a single api_request event among many others", () => {
    const events: ReadonlyArray<SessionEvent> = [
      { event_type: "session_start" },
      { event_type: "tool_call_start" },
      { event_type: "api_request" },
      { event_type: "tool_call_end" },
    ];
    expect(isOtelActiveSession(events)).toBe(true);
  });

  // AC: Empty events list means not OTel-active
  it("returns false for empty event list", () => {
    expect(isOtelActiveSession([])).toBe(false);
  });

  // AC: Mixed sessions handled independently (each session's events checked separately)
  it("detects OTel independently per event array", () => {
    const otelSessionEvents: ReadonlyArray<SessionEvent> = [
      { event_type: "session_start" },
      { event_type: "api_request" },
    ];
    const transcriptSessionEvents: ReadonlyArray<SessionEvent> = [
      { event_type: "session_start" },
      { event_type: "tool_call_end" },
    ];

    expect(isOtelActiveSession(otelSessionEvents)).toBe(true);
    expect(isOtelActiveSession(transcriptSessionEvents)).toBe(false);
  });
});

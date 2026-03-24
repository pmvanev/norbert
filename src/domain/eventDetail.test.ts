import { describe, it, expect } from "vitest";
import {
  type SessionEvent,
  formatCanonicalEventType,
  extractToolName,
  formatEventTimestamp,
  formatPayloadSnippet,
  formatEventLabel,
} from "./eventDetail";

/// Helper to build a SessionEvent for tests.
function buildEvent(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    session_id: "sess-1",
    event_type: "tool_call_start",
    payload: { tool: "bash" },
    received_at: "2026-03-12T10:05:30Z",
    provider: "claude_code",
    ...overrides,
  };
}

describe("formatCanonicalEventType", () => {
  it("converts snake_case event type to uppercase label", () => {
    expect(formatCanonicalEventType("tool_call_start")).toBe("TOOL CALL START");
  });

  it("converts session_start to uppercase label", () => {
    expect(formatCanonicalEventType("session_start")).toBe("SESSION START");
  });

  it("converts session_end to uppercase label", () => {
    expect(formatCanonicalEventType("session_end")).toBe("SESSION END");
  });

  it("converts tool_call_end to uppercase label", () => {
    expect(formatCanonicalEventType("tool_call_end")).toBe("TOOL CALL END");
  });

  it("converts agent_complete to uppercase label", () => {
    expect(formatCanonicalEventType("agent_complete")).toBe("AGENT COMPLETE");
  });

  it("converts prompt_submit to uppercase label", () => {
    expect(formatCanonicalEventType("prompt_submit")).toBe("PROMPT SUBMIT");
  });

  it("prefixes unrecognized event types with UNKNOWN", () => {
    expect(formatCanonicalEventType("mystery_event")).toBe(
      "UNKNOWN: MYSTERY EVENT"
    );
  });

  it("prefixes empty string with UNKNOWN", () => {
    expect(formatCanonicalEventType("")).toBe("UNKNOWN: ");
  });
});

describe("extractToolName", () => {
  it("extracts tool name from tool_call_start payload", () => {
    const event = buildEvent({
      event_type: "tool_call_start",
      payload: { tool: "bash" },
    });
    expect(extractToolName(event)).toBe("bash");
  });

  it("extracts tool name from tool_call_end payload", () => {
    const event = buildEvent({
      event_type: "tool_call_end",
      payload: { tool: "Read" },
    });
    expect(extractToolName(event)).toBe("Read");
  });

  it("returns null for non-tool events even when payload has a tool field", () => {
    // This test kills the mutant that replaces the TOOL_EVENT_TYPES guard
    // with `if (false)` -- without the guard, a session_start event with
    // a tool field would incorrectly return the tool name.
    const event = buildEvent({
      event_type: "session_start",
      payload: { tool: "bash" },
    });
    expect(extractToolName(event)).toBeNull();
  });

  it("returns null when payload has no tool field", () => {
    const event = buildEvent({
      event_type: "tool_call_start",
      payload: { other: "data" },
    });
    expect(extractToolName(event)).toBeNull();
  });

  it("returns null when payload is not an object", () => {
    const event = buildEvent({
      event_type: "tool_call_start",
      payload: "string-payload",
    });
    expect(extractToolName(event)).toBeNull();
  });

  it("returns null when payload is null for a tool event", () => {
    // Kills the mutant that replaces (payload === null) with false
    // in the compound condition. Without the null guard, accessing
    // properties on null would throw.
    const event = buildEvent({
      event_type: "tool_call_start",
      payload: null,
    });
    expect(extractToolName(event)).toBeNull();
  });

  it("extracts tool_name field as fallback", () => {
    const event = buildEvent({
      event_type: "tool_call_start",
      payload: { tool_name: "Write" },
    });
    expect(extractToolName(event)).toBe("Write");
  });
});

describe("formatEventTimestamp", () => {
  it("formats ISO timestamp to time-only string", () => {
    const result = formatEventTimestamp("2026-03-12T10:05:30Z");
    // Should contain time components
    expect(result).toContain(":");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatPayloadSnippet", () => {
  it("returns truncated JSON string for large payloads", () => {
    const largePayload = { key: "a".repeat(200) };
    const snippet = formatPayloadSnippet(largePayload, 80);
    expect(snippet.length).toBeLessThanOrEqual(83); // 80 + "..."
    expect(snippet).toContain("...");
  });

  it("returns full JSON for small payloads", () => {
    const smallPayload = { tool: "bash" };
    const snippet = formatPayloadSnippet(smallPayload, 80);
    expect(snippet).toBe('{"tool":"bash"}');
  });

  it("returns empty object string for empty payload", () => {
    const snippet = formatPayloadSnippet({}, 80);
    expect(snippet).toBe("{}");
  });

  it("handles null payload", () => {
    const snippet = formatPayloadSnippet(null, 80);
    expect(snippet).toBe("null");
  });

  it("returns full JSON when length equals exactly maxLength (boundary)", () => {
    // Build a payload whose JSON serialization is exactly 10 characters.
    // {"a":"bc"} = 10 chars. With maxLength=10, <= returns full, < would truncate.
    const payload = { a: "bc" };
    const json = JSON.stringify(payload); // '{"a":"bc"}'
    expect(json.length).toBe(10); // verify our assumption
    const snippet = formatPayloadSnippet(payload, 10);
    expect(snippet).toBe(json);
    expect(snippet).not.toContain("...");
  });
});

describe("formatEventLabel", () => {
  it("returns uppercase type for non-tool events", () => {
    const event = buildEvent({ event_type: "session_start", payload: {} });
    expect(formatEventLabel(event)).toBe("SESSION START");
  });

  it("appends tool name for tool_call_start events", () => {
    const event = buildEvent({
      event_type: "tool_call_start",
      payload: { tool: "bash" },
    });
    expect(formatEventLabel(event)).toBe("TOOL CALL START: bash");
  });

  it("appends tool name for tool_call_end events", () => {
    const event = buildEvent({
      event_type: "tool_call_end",
      payload: { tool: "Read" },
    });
    expect(formatEventLabel(event)).toBe("TOOL CALL END: Read");
  });

  it("omits tool name when not extractable", () => {
    const event = buildEvent({
      event_type: "tool_call_start",
      payload: {},
    });
    expect(formatEventLabel(event)).toBe("TOOL CALL START");
  });
});

/// Event data returned from the Rust backend via Tauri IPC.
///
/// Fields match the Rust Event struct's serialized JSON.
/// The event_type field arrives as a snake_case string (e.g., "tool_call_start").
export interface SessionEvent {
  readonly session_id: string;
  readonly event_type: string;
  readonly payload: unknown;
  readonly received_at: string;
  readonly provider: string;
}

/// Convert a snake_case canonical event type to an uppercase display label.
///
/// Pure function: replaces underscores with spaces and uppercases.
/// Example: "tool_call_start" -> "TOOL CALL START"
export function formatCanonicalEventType(eventType: string): string {
  return eventType.replace(/_/g, " ").toUpperCase();
}

/// Event types that carry a tool name in their payload.
const TOOL_EVENT_TYPES = new Set(["tool_call_start", "tool_call_end"]);

/// Extract the tool name from an event's payload.
///
/// Pure function: returns the tool name for tool_call_start and tool_call_end
/// events when the payload contains a "tool" or "tool_name" field.
/// Returns null for all other event types or when the field is missing.
export function extractToolName(event: SessionEvent): string | null {
  if (!TOOL_EVENT_TYPES.has(event.event_type)) {
    return null;
  }

  const payload = event.payload;
  if (payload === null || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.tool === "string") {
    return record.tool;
  }
  if (typeof record.tool_name === "string") {
    return record.tool_name;
  }

  return null;
}

/// Format an ISO 8601 timestamp to a time-only display string.
///
/// Pure function: extracts the time portion for event-level display,
/// since the date is already shown in the session header.
export function formatEventTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString();
}

/// Format a payload value as a truncated JSON snippet.
///
/// Pure function: serializes the payload to JSON, then truncates
/// to maxLength characters with an ellipsis if needed.
export function formatPayloadSnippet(
  payload: unknown,
  maxLength: number
): string {
  const json = JSON.stringify(payload);
  if (json.length <= maxLength) {
    return json;
  }
  return json.slice(0, maxLength) + "...";
}

/// Format the full display label for an event.
///
/// Pure function: combines the uppercase event type with the tool name
/// (if applicable) in the format "EVENT TYPE: toolname".
export function formatEventLabel(event: SessionEvent): string {
  const typeLabel = formatCanonicalEventType(event.event_type);
  const toolName = extractToolName(event);
  if (toolName !== null) {
    return `${typeLabel}: ${toolName}`;
  }
  return typeLabel;
}

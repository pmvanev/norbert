/**
 * Dashboard API client -- pure functions for fetching data from Norbert server.
 *
 * No @norbert/* runtime dependencies. Communicates via HTTP only.
 * Functions accept baseUrl to enable testing without real server.
 */

// ---------------------------------------------------------------------------
// API response types (dashboard's own types, not importing from @norbert/core)
// ---------------------------------------------------------------------------

export interface DashboardEvent {
  readonly eventType: string;
  readonly sessionId: string;
  readonly timestamp: string;
  readonly toolName?: string;
  readonly mcpServer?: string;
}

export interface DashboardSession {
  readonly id: string;
  readonly startTime: string;
  readonly endTime?: string;
  readonly model: string;
  readonly eventCount: number;
  readonly status: string;
}

export interface EventsResponse {
  readonly events: readonly DashboardEvent[];
}

export interface SessionsResponse {
  readonly sessions: readonly DashboardSession[];
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

export const fetchRecentEvents = async (
  baseUrl: string,
  limit: number = 50
): Promise<EventsResponse> => {
  const response = await fetch(`${baseUrl}/api/events?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status}`);
  }
  return response.json() as Promise<EventsResponse>;
};

export const fetchSessions = async (
  baseUrl: string
): Promise<SessionsResponse> => {
  const response = await fetch(`${baseUrl}/api/sessions`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.status}`);
  }
  return response.json() as Promise<SessionsResponse>;
};

// ---------------------------------------------------------------------------
// URL builder (pure)
// ---------------------------------------------------------------------------

export const buildApiUrl = (
  host: string = 'localhost',
  port: number = 7777
): string => `http://${host}:${port}`;

export const buildWsUrl = (
  host: string = 'localhost',
  port: number = 7777
): string => `ws://${host}:${port}/ws`;

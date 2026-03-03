/**
 * @norbert/dashboard -- Svelte 5 SPA dashboard.
 *
 * No runtime dependencies on other @norbert/* packages.
 * Communicates with server via HTTP REST API and WebSocket only.
 *
 * Exports API client and WebSocket client utilities for programmatic use.
 */

export { fetchRecentEvents, fetchSessions, fetchOverview, buildApiUrl, buildWsUrl } from './api-client.js';
export type {
  DashboardEvent,
  DashboardSession,
  EventsResponse,
  SessionsResponse,
  OverviewSummaryResponse,
  McpHealthEntry,
  OverviewSession,
  OverviewResponse,
} from './api-client.js';

export { createWsClient, parseServerMessage } from './ws-client.js';
export type { ServerMessage, NewEventMessage, SessionUpdatedMessage, ConnectionState, WsClient, WsClientCallbacks } from './ws-client.js';

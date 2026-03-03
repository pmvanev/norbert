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
// Overview response types
// ---------------------------------------------------------------------------

export interface OverviewSummaryResponse {
  readonly sessionCount: number;
  readonly totalTokens: number;
  readonly estimatedCost: number;
  readonly mcpServerCount: number;
}

export interface McpHealthEntry {
  readonly serverName: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly callCount: number;
  readonly errorCount: number;
  readonly avgLatencyMs: number;
  readonly tokenOverhead: number;
}

export interface OverviewSession {
  readonly id: string;
  readonly startTime: string;
  readonly endTime?: string;
  readonly model: string;
  readonly agentCount: number;
  readonly eventCount: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly estimatedCost: number;
  readonly mcpErrorCount: number;
  readonly status: string;
}

export interface OverviewResponse {
  readonly summary: OverviewSummaryResponse;
  readonly recentSessions: readonly OverviewSession[];
  readonly mcpHealth: readonly McpHealthEntry[];
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

export const fetchOverview = async (
  baseUrl: string
): Promise<OverviewResponse> => {
  const response = await fetch(`${baseUrl}/api/overview`);
  if (!response.ok) {
    throw new Error(`Failed to fetch overview: ${response.status}`);
  }
  return response.json() as Promise<OverviewResponse>;
};

// ---------------------------------------------------------------------------
// Trace graph response types
// ---------------------------------------------------------------------------

export interface TraceAgentNode {
  readonly agentId: string;
  readonly parentAgentId: string | undefined;
  readonly toolCallCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
  readonly status: string;
  readonly children: readonly TraceAgentNode[];
}

export interface TraceEdge {
  readonly fromAgentId: string;
  readonly toAgentId: string;
}

export interface TraceGraphResponse {
  readonly sessionId: string;
  readonly rootAgent: TraceAgentNode;
  readonly allAgents: readonly TraceAgentNode[];
  readonly edges: readonly TraceEdge[];
}

export const fetchSessionTrace = async (
  baseUrl: string,
  sessionId: string
): Promise<TraceGraphResponse> => {
  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/trace`);
  if (!response.ok) {
    throw new Error(`Failed to fetch session trace: ${response.status}`);
  }
  return response.json() as Promise<TraceGraphResponse>;
};

// ---------------------------------------------------------------------------
// Cost breakdown response types
// ---------------------------------------------------------------------------

export interface CostToolCallDetail {
  readonly toolName: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
}

export interface CostAgentEntry {
  readonly agentId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
  readonly toolCalls: readonly CostToolCallDetail[];
}

export interface CostMcpEntry {
  readonly serverName: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
}

export interface CostBreakdownResponse {
  readonly sessionId: string;
  readonly agents: readonly CostAgentEntry[];
  readonly totalCost: number;
  readonly costByMcpServer: readonly CostMcpEntry[];
  readonly costMethodologyNote: string;
}

export const fetchSessionCosts = async (
  baseUrl: string,
  sessionId: string
): Promise<CostBreakdownResponse> => {
  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/costs`);
  if (!response.ok) {
    throw new Error(`Failed to fetch session costs: ${response.status}`);
  }
  return response.json() as Promise<CostBreakdownResponse>;
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

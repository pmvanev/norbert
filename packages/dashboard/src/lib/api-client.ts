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
// MCP health detail response types
// ---------------------------------------------------------------------------

export interface McpDiagnosticEntry {
  readonly category: string;
  readonly recommendation: string;
}

export interface McpErrorCategoryEntry {
  readonly category: string;
  readonly count: number;
}

export interface McpToolCallDetail {
  readonly serverName: string;
  readonly toolName: string;
  readonly timestamp: string;
  readonly latencyMs: number | null;
  readonly status: 'success' | 'error';
  readonly errorDetail?: string;
}

export interface McpServerDetailResponse {
  readonly serverName: string;
  readonly connectionStatus: 'connected' | 'disconnected' | 'error';
  readonly health: McpHealthEntry;
  readonly errorsByCategory: readonly McpErrorCategoryEntry[];
  readonly diagnostics: readonly McpDiagnosticEntry[];
  readonly latencyTrend: 'stable' | 'degrading' | 'improving';
  readonly recentCalls: readonly McpToolCallDetail[];
}

export interface McpHealthDetailResponse {
  readonly servers: readonly McpServerDetailResponse[];
  readonly hasServers: boolean;
}

export const fetchMcpHealthDetail = async (
  baseUrl: string
): Promise<McpHealthDetailResponse> => {
  const response = await fetch(`${baseUrl}/api/mcp/health`);
  if (!response.ok) {
    throw new Error(`Failed to fetch MCP health detail: ${response.status}`);
  }
  return response.json() as Promise<McpHealthDetailResponse>;
};

// ---------------------------------------------------------------------------
// Session comparison response types
// ---------------------------------------------------------------------------

export interface AgentComparisonEntry {
  readonly agentId: string;
  readonly status: 'unchanged' | 'new' | 'removed';
  readonly previousCost: number;
  readonly currentCost: number;
  readonly costDelta: number;
  readonly costChangePercent: number;
}

export interface SessionComparisonResponse {
  readonly previousSession: OverviewSession;
  readonly currentSession: OverviewSession;
  readonly deltas: {
    readonly tokensDelta: number;
    readonly costDelta: number;
    readonly agentCountDelta: number;
    readonly errorCountDelta: number;
  };
  readonly changePercents: {
    readonly tokens: number;
    readonly cost: number;
    readonly agents: number;
    readonly errors: number;
    readonly duration: number;
  };
  readonly agentComparisons: readonly AgentComparisonEntry[];
  readonly projectedMonthlySavings: number;
}

export const fetchSessionComparison = async (
  baseUrl: string,
  currentId: string,
  previousId: string
): Promise<SessionComparisonResponse> => {
  const response = await fetch(
    `${baseUrl}/api/sessions/compare?current=${encodeURIComponent(currentId)}&previous=${encodeURIComponent(previousId)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch session comparison: ${response.status}`);
  }
  return response.json() as Promise<SessionComparisonResponse>;
};

// ---------------------------------------------------------------------------
// Session history response types
// ---------------------------------------------------------------------------

export interface DailyTrendResponse {
  readonly date: string;
  readonly sessionCount: number;
  readonly totalTokens: number;
  readonly totalCost: number;
}

export interface SessionBaselinesResponse {
  readonly averageCost: number;
  readonly p95Cost: number;
  readonly averageDuration: number;
  readonly sampleSize: number;
  readonly isConfident: boolean;
  readonly confidenceNote: string | undefined;
}

export interface SessionHistoryResponse {
  readonly sessions: readonly OverviewSession[];
  readonly trends: readonly DailyTrendResponse[];
  readonly baselines: SessionBaselinesResponse;
}

export interface SessionHistoryParams {
  readonly dateStart?: string;
  readonly dateEnd?: string;
  readonly costMin?: number;
  readonly costMax?: number;
  readonly agentMin?: number;
  readonly agentMax?: number;
  readonly sortBy?: string;
  readonly sortOrder?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export const fetchSessionHistory = async (
  baseUrl: string,
  params: SessionHistoryParams = {}
): Promise<SessionHistoryResponse> => {
  const searchParams = new URLSearchParams();
  if (params.dateStart !== undefined) searchParams.set('dateStart', params.dateStart);
  if (params.dateEnd !== undefined) searchParams.set('dateEnd', params.dateEnd);
  if (params.costMin !== undefined) searchParams.set('costMin', String(params.costMin));
  if (params.costMax !== undefined) searchParams.set('costMax', String(params.costMax));
  if (params.agentMin !== undefined) searchParams.set('agentMin', String(params.agentMin));
  if (params.agentMax !== undefined) searchParams.set('agentMax', String(params.agentMax));
  if (params.sortBy !== undefined) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder !== undefined) searchParams.set('sortOrder', params.sortOrder);
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset));

  const queryString = searchParams.toString();
  const url = `${baseUrl}/api/sessions/history${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch session history: ${response.status}`);
  }
  return response.json() as Promise<SessionHistoryResponse>;
};

/**
 * Build the URL for CSV export with the given filter parameters.
 * Returns a URL string suitable for window.location or anchor href.
 */
export const getSessionExportUrl = (
  baseUrl: string,
  params: SessionHistoryParams = {}
): string => {
  const searchParams = new URLSearchParams();
  searchParams.set('format', 'csv');
  if (params.dateStart !== undefined) searchParams.set('dateStart', params.dateStart);
  if (params.dateEnd !== undefined) searchParams.set('dateEnd', params.dateEnd);
  if (params.costMin !== undefined) searchParams.set('costMin', String(params.costMin));
  if (params.costMax !== undefined) searchParams.set('costMax', String(params.costMax));
  if (params.agentMin !== undefined) searchParams.set('agentMin', String(params.agentMin));
  if (params.agentMax !== undefined) searchParams.set('agentMax', String(params.agentMax));
  if (params.sortBy !== undefined) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder !== undefined) searchParams.set('sortOrder', params.sortOrder);
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
  return `${baseUrl}/api/sessions/export?${searchParams.toString()}`;
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

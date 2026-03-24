/// API Health Aggregator: pure fold over api_error events.
///
/// Input: array of api_error events + total api request count.
/// Output: ApiHealthSummary with error rate, error groups by status code.
///
/// No side effects, no IO imports.

// ---------------------------------------------------------------------------
// Event shape accepted by this aggregator
// ---------------------------------------------------------------------------

export interface ApiErrorEvent {
  readonly eventType: "api_error";
  readonly payload: {
    readonly status_code?: number;
    readonly error?: string;
    readonly model?: string;
    readonly attempt?: number;
  };
  readonly receivedAt: string;
}

// ---------------------------------------------------------------------------
// Aggregated summary
// ---------------------------------------------------------------------------

export interface ApiHealthSummary {
  readonly totalErrors: number;
  readonly totalApiRequests: number;
  readonly errorRate: number;
  readonly byStatusCode: ReadonlyMap<number, number>;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const EMPTY_API_HEALTH_SUMMARY: ApiHealthSummary = {
  totalErrors: 0,
  totalApiRequests: 0,
  errorRate: 0,
  byStatusCode: new Map(),
};

// ---------------------------------------------------------------------------
// Aggregator (pure function)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Status code grouping (pure fold step)
// ---------------------------------------------------------------------------

const groupByStatusCode = (
  byCode: Map<number, number>,
  event: ApiErrorEvent,
): Map<number, number> => {
  const code = event.payload.status_code ?? 0;
  byCode.set(code, (byCode.get(code) ?? 0) + 1);
  return byCode;
};

// ---------------------------------------------------------------------------
// Aggregator (pure function)
// ---------------------------------------------------------------------------

export const aggregateApiHealth = (
  events: ReadonlyArray<ApiErrorEvent>,
  totalApiRequests: number,
): ApiHealthSummary => {
  if (events.length === 0 && totalApiRequests === 0) return EMPTY_API_HEALTH_SUMMARY;

  const totalErrors = events.length;
  const byStatusCode = events.reduce(groupByStatusCode, new Map<number, number>());
  const errorRate = totalApiRequests > 0 ? totalErrors / totalApiRequests : 0;

  return {
    totalErrors,
    totalApiRequests,
    errorRate,
    byStatusCode,
  };
};

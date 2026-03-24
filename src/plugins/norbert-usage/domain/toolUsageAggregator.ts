/// Tool Usage Aggregator: pure fold over tool_result events.
///
/// Input: array of tool_result events (filtered by event_type externally).
/// Output: ToolUsageSummary with total calls, success rate, per-tool breakdown.
///
/// No side effects, no IO imports.

// ---------------------------------------------------------------------------
// Event shape accepted by this aggregator
// ---------------------------------------------------------------------------

export interface ToolResultEvent {
  readonly eventType: "tool_result";
  readonly payload: {
    readonly tool_name?: string;
    readonly success?: boolean;
    readonly duration_ms?: number;
  };
  readonly receivedAt: string;
}

// ---------------------------------------------------------------------------
// Per-tool breakdown
// ---------------------------------------------------------------------------

export interface PerToolStats {
  readonly count: number;
  readonly successCount: number;
  readonly successRate: number;
  readonly totalDurationMs: number;
  readonly avgDurationMs: number;
}

// ---------------------------------------------------------------------------
// Aggregated summary
// ---------------------------------------------------------------------------

export interface ToolUsageSummary {
  readonly totalCalls: number;
  readonly successCount: number;
  readonly successRate: number;
  readonly perToolBreakdown: ReadonlyMap<string, PerToolStats>;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const EMPTY_TOOL_USAGE_SUMMARY: ToolUsageSummary = {
  totalCalls: 0,
  successCount: 0,
  successRate: 0,
  perToolBreakdown: new Map(),
};

// ---------------------------------------------------------------------------
// Internal accumulator (mutable during fold, frozen on output)
// ---------------------------------------------------------------------------

interface ToolAccumulator {
  count: number;
  successCount: number;
  totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Per-tool fold step
// ---------------------------------------------------------------------------

const accumulateToolEvent = (
  byTool: Map<string, ToolAccumulator>,
  event: ToolResultEvent,
): Map<string, ToolAccumulator> => {
  const toolName = event.payload.tool_name ?? "unknown";
  const prev = byTool.get(toolName) ?? { count: 0, successCount: 0, totalDurationMs: 0 };
  byTool.set(toolName, {
    count: prev.count + 1,
    successCount: prev.successCount + (event.payload.success === true ? 1 : 0),
    totalDurationMs: prev.totalDurationMs + (event.payload.duration_ms ?? 0),
  });
  return byTool;
};

// ---------------------------------------------------------------------------
// Finalize per-tool accumulators into PerToolStats
// ---------------------------------------------------------------------------

const finalizePerToolStats = (acc: ToolAccumulator): PerToolStats => ({
  count: acc.count,
  successCount: acc.successCount,
  successRate: acc.count > 0 ? acc.successCount / acc.count : 0,
  totalDurationMs: acc.totalDurationMs,
  avgDurationMs: acc.count > 0 ? acc.totalDurationMs / acc.count : 0,
});

// ---------------------------------------------------------------------------
// Aggregator (pure function)
// ---------------------------------------------------------------------------

export const aggregateToolUsage = (
  events: ReadonlyArray<ToolResultEvent>,
): ToolUsageSummary => {
  if (events.length === 0) return EMPTY_TOOL_USAGE_SUMMARY;

  const byTool = events.reduce(accumulateToolEvent, new Map<string, ToolAccumulator>());

  const totalCalls = events.length;
  const successCount = events.filter((e) => e.payload.success === true).length;

  const perToolBreakdown = new Map<string, PerToolStats>();
  for (const [toolName, acc] of byTool) {
    perToolBreakdown.set(toolName, finalizePerToolStats(acc));
  }

  return {
    totalCalls,
    successCount,
    successRate: totalCalls > 0 ? successCount / totalCalls : 0,
    perToolBreakdown,
  };
};

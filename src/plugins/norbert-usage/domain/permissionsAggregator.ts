/// Permissions Aggregator: pure fold over tool_decision events.
///
/// Input: array of tool_decision events.
/// Output: PermissionsSummary with auto/user/rejected breakdown.
///
/// No side effects, no IO imports.

// ---------------------------------------------------------------------------
// Event shape accepted by this aggregator
// ---------------------------------------------------------------------------

export type DecisionSource = "auto" | "user" | "rejected";

export interface ToolDecisionEvent {
  readonly eventType: "tool_decision";
  readonly payload: {
    readonly decision?: DecisionSource;
    readonly tool_name?: string;
  };
  readonly receivedAt: string;
}

// ---------------------------------------------------------------------------
// Aggregated summary
// ---------------------------------------------------------------------------

export interface PermissionsSummary {
  readonly totalDecisions: number;
  readonly autoApproved: number;
  readonly userApproved: number;
  readonly rejected: number;
  readonly autoRate: number;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const EMPTY_PERMISSIONS_SUMMARY: PermissionsSummary = {
  totalDecisions: 0,
  autoApproved: 0,
  userApproved: 0,
  rejected: 0,
  autoRate: 0,
};

// ---------------------------------------------------------------------------
// Aggregator (pure function)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Decision counting (pure fold step)
// ---------------------------------------------------------------------------

interface DecisionAccumulator {
  autoApproved: number;
  userApproved: number;
  rejected: number;
}

const accumulateDecision = (
  acc: DecisionAccumulator,
  event: ToolDecisionEvent,
): DecisionAccumulator => {
  const decision = event.payload.decision;
  return {
    autoApproved: acc.autoApproved + (decision === "auto" ? 1 : 0),
    userApproved: acc.userApproved + (decision === "user" ? 1 : 0),
    rejected: acc.rejected + (decision === "rejected" ? 1 : 0),
  };
};

// ---------------------------------------------------------------------------
// Aggregator (pure function)
// ---------------------------------------------------------------------------

export const aggregatePermissions = (
  events: ReadonlyArray<ToolDecisionEvent>,
): PermissionsSummary => {
  if (events.length === 0) return EMPTY_PERMISSIONS_SUMMARY;

  const totalDecisions = events.length;
  const counts = events.reduce(accumulateDecision, {
    autoApproved: 0,
    userApproved: 0,
    rejected: 0,
  });

  return {
    totalDecisions,
    autoApproved: counts.autoApproved,
    userApproved: counts.userApproved,
    rejected: counts.rejected,
    autoRate: totalDecisions > 0 ? counts.autoApproved / totalDecisions : 0,
  };
};

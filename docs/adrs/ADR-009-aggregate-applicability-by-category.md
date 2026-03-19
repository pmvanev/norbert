# ADR-009: Aggregate Applicability by Category

## Status
Accepted

## Context
Not every metric category has a meaningful aggregate across sessions. Specifically:
- **Tokens/s**: Sum across sessions = total throughput. Meaningful.
- **Cost**: Sum across sessions = total spend rate. Meaningful.
- **Agents**: Sum across sessions = total active agents. Meaningful.
- **Context**: Each session has its own context window. Averaging or summing percentages is meaningless -- 50% + 80% does not equal 130% context.

The v2 design spec requires that when a category's aggregate is not applicable, the large aggregate graph is **omitted entirely** and only per-session graphs are shown (rendered larger as the primary display).

## Decision
Model aggregate applicability as a **boolean flag on the MetricCategory configuration type**: `aggregateApplicable: boolean`. When `false`:
- The detail pane omits the aggregate graph
- Per-session graphs render at a larger size (they become the primary display)
- The sidebar sparkline shows the maximum value across sessions (for at-a-glance reference) rather than a sum

This is a compile-time-checkable configuration property, not a runtime branching decision.

## Alternatives Considered

### Alternative 1: Always show aggregate, use "max" strategy for context
- Show aggregate graph for context using max(contextPct) across sessions
- **Rejected**: "Max context across sessions" is a misleading aggregate -- it implies overall system context pressure when each session's context is independent. The design spec explicitly says "skip the large aggregate graph."

### Alternative 2: Runtime type guard (discriminated union with 'aggregatable' | 'non-aggregatable' tags)
- Use algebraic data types to make non-aggregatable categories structurally distinct
- **Rejected**: Over-engineering. A boolean flag on the configuration type is sufficient. The rendering logic has a single branch point (show/hide aggregate graph). A discriminated union would force unnecessary type narrowing throughout the view code.

## Consequences
- **Positive**: Context category renders correctly per design spec
- **Positive**: Future non-aggregatable categories only need `aggregateApplicable: false`
- **Positive**: Simple boolean check, not complex type machinery
- **Negative**: No compile-time enforcement that aggregate buffers are not read for non-applicable categories (runtime check only)

# DESIGN Wave Handoff: norbert-performance-monitor

## Handoff Summary

**Feature:** Performance Monitor -- multi-metric, multi-scope monitoring dashboard for the norbert-usage plugin
**From:** DISCUSS wave (product-owner)
**To:** DESIGN wave (solution-architect)
**Date:** 2026-03-18

---

## Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| JTBD Analysis | `docs/feature/norbert-performance-monitor/discuss/jtbd-analysis.md` | 6 job stories, forces analysis, opportunity scoring, MVP vs Later prioritization |
| Journey Visual | `docs/feature/norbert-performance-monitor/discuss/journey-performance-monitoring-visual.md` | ASCII flow, emotional arc, UI mockups per step, error paths, oscilloscope subsumption strategy |
| Journey Schema | `docs/feature/norbert-performance-monitor/discuss/journey-performance-monitoring.yaml` | Structured YAML: steps, artifacts, emotional states, integration validation rules |
| Gherkin Scenarios | `docs/feature/norbert-performance-monitor/discuss/journey-performance-monitoring.feature` | 22 BDD scenarios covering happy paths, error paths, urgency detection, backward compatibility, properties |
| Shared Artifacts | `docs/feature/norbert-performance-monitor/discuss/shared-artifacts-registry.md` | 12 tracked artifacts with sources, consumers, risk levels, cross-view consistency rules |
| User Stories | `docs/feature/norbert-performance-monitor/discuss/user-stories.md` | 7 stories, 32 UAT scenarios total, DoR validated |
| This Handoff | `docs/feature/norbert-performance-monitor/discuss/handoff-design.md` | Handoff package for solution-architect |

---

## Story Summary

| ID | Title | Size | Scenarios | Depends On |
|----|-------|------|-----------|------------|
| US-PM-001 | Performance Monitor View Registration | 2 days | 4 | norbert-usage US-001, US-002 (complete) |
| US-PM-002 | Multi-Session Aggregate Metrics | 2 days | 5 | US-PM-001 |
| US-PM-003 | Session Drill-Down Navigation | 2 days | 5 | US-PM-001, US-PM-002 |
| US-PM-004 | Configurable Time Window | 3 days | 6 | US-PM-001 |
| US-PM-005 | Context Window Pressure Monitoring | 2 days | 5 | US-PM-001 |
| US-PM-006 | Cost Rate Trending | 1 day | 4 | US-PM-001 |
| US-PM-007 | Oscilloscope Backward Compatibility | 1 day | 3 | Existing oscilloscope (US-005, complete) |

**Total estimated effort:** 13 days
**All stories:** Must Have (MoSCoW)

---

## Key Design Decisions for Solution Architect

### 1. View Architecture -- Mode Within Existing Plugin

The Performance Monitor is a new mode view within the norbert-usage plugin, not a separate plugin. It registers alongside the existing Oscilloscope and Usage Dashboard modes. This preserves plugin isolation (zero new plugin dependencies) and reuses the existing data pipeline.

### 2. Multi-Session Aggregation (New Capability)

Current architecture tracks SessionMetrics per broadcast session. The PM requires:
- Maintaining SessionMetrics for ALL active sessions simultaneously (not just broadcast)
- A new AggregateMetrics type summing across sessions
- Session lifecycle awareness (additions and removals in real time)

This is the most significant architectural addition. The existing MetricsAggregator operates per-session; the PM needs a cross-session aggregation layer.

### 3. Time Window System (New Capability)

Current oscilloscope uses a fixed 60-second window at 10Hz (600-sample ring buffer). The PM needs:
- Multiple window sizes: 1m, 5m, 15m, full-session
- Adaptive sample resolution per window (10Hz for 1m, 2Hz for 5m, 1Hz for 15m)
- Historical data loading from SQLite for windows exceeding live buffer
- Target: 300-900 data points per chart regardless of window size

### 4. Drill-Down Navigation (View-Level)

Drill-down is internal to the PM component, not a plugin mode switch:
- Aggregate overview is the default
- Clicking a session transitions to session detail
- Back preserves aggregate state (time window, scroll)
- Agent breakdown within session detail (depends on agent identification in payloads)

### 5. Oscilloscope Subsumption Strategy

Coexistence, not replacement:
- Oscilloscope view registration preserved -- floating panels and preferences unbroken
- PM token rate chart reuses oscilloscope.ts pure functions (prepareWaveformPoints, computeGridLines)
- Both views subscribe to the same MetricsStore
- Future: oscilloscope could become PM's "focus mode" (expand single chart to full width)

### 6. Shared Configuration

Urgency thresholds (amber 70%, red 90% for context) MUST be shared between PM and Gauge Cluster. Both must reference the same configuration constant. Hardcoded thresholds in view code is an anti-pattern.

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | All PM charts update without visible frame drops. 1m window at ~10Hz, wider windows at proportionally lower frequencies. |
| Consistency | Aggregate always equals sum of parts. Same metric value shown identically in PM, Gauge Cluster, and cost ticker. |
| Accuracy | Cost rate reflects per-model pricing. Token aggregation uses sum, not average. |
| Resilience | Missing metrics (context data unavailable) handled gracefully -- explanatory message, layout stable. |
| Responsiveness | New sessions appear in aggregate within 2 seconds. Ended sessions removed within 2 seconds. |
| Backward Compatibility | Existing oscilloscope floating panels continue to work. No view registrations removed. |
| Accessibility | All urgency indicators use both color and shape/pattern (not color alone). |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Multi-session MetricsStore requires significant refactor | Medium | High | Evaluate whether existing per-session architecture extends or needs new abstraction |
| Agent identification inconsistent in event payloads | High | Medium | Agent breakdown shown as "best effort" with fallback to session-level only |
| Wider time windows cause performance issues (large data sets) | Medium | Medium | Downsampled resolution + SQL LIMIT on historical queries |
| Context utilization data not reliably available | High | Low | Already handled in Gauge Cluster (graceful degradation); same pattern in PM |
| Time window state management complexity | Low | Medium | React state management; consider URL-encoded state for deep linking |

---

## DoR Validation Summary

All 7 stories pass all 8 DoR items. See detailed validation in user-stories.md.

| Story | Problem | Persona | Examples | UAT | AC | Size | Tech Notes | Dependencies |
|-------|---------|---------|----------|-----|-----|------|-----------|-------------|
| US-PM-001 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-PM-002 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-PM-003 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-PM-004 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-PM-005 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-PM-006 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-PM-007 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

---

## Suggested Implementation Order

```
Phase A (foundation):     US-PM-001 -> US-PM-007 (verify no regressions)
Phase B (core metrics):   US-PM-002 + US-PM-005 + US-PM-006 (parallel)
Phase C (navigation):     US-PM-003
Phase D (time windows):   US-PM-004
```

US-PM-001 establishes the view registration and grid layout. US-PM-007 validates backward compatibility immediately. Once the view exists, aggregate metrics (002), context pressure (005), and cost rate (006) can be built in parallel. Drill-down (003) requires aggregates. Time window (004) is the most complex story and benefits from all other views being functional first.

---

## Deferred to Performance Monitor v2

The following metrics were identified during JTBD analysis but deferred based on opportunity scoring and implementation complexity:

| Metric | Job Story | Reason for Deferral |
|--------|-----------|-------------------|
| tokens/s per agent | JS-PM-2 | Requires reliable agent identification in payloads (high risk) |
| response latency (time to first token) | JS-PM-6 | Requires new event timing analysis not in current pipeline |
| tool calls/s | JS-PM-6 | Useful but lower priority than core aggregate metrics |
| error rate (failed tool calls) | JS-PM-6 | Requires error classification not in current event types |
| compression events | JS-PM-4 | Requires compaction event detection (not currently in event stream) |
| model distribution | -- | Informational, not actionable in real time |
| queue depth | -- | Requires agent lifecycle tracking beyond current capabilities |
| cache hit rate | -- | Requires cache metrics in payloads (not currently available) |

These should be reconsidered once PM v1 is shipping and user feedback is available.

# DESIGN Wave Handoff: norbert-usage

## Handoff Summary

**Feature:** norbert-usage plugin -- Token tracking, cost calculation, Gauge Cluster, Oscilloscope, Usage Dashboard
**From:** DISCUSS wave (product-owner)
**To:** DESIGN wave (solution-architect)
**Date:** 2026-03-13

---

## Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| JTBD Analysis | `docs/feature/norbert-usage/discuss/jtbd-analysis.md` | 4 job stories, forces analysis, opportunity scoring |
| Journey Visual | `docs/feature/norbert-usage/discuss/journey-usage-monitoring-visual.md` | ASCII flow, emotional arc, UI mockups per step, error paths |
| Journey Schema | `docs/feature/norbert-usage/discuss/journey-usage-monitoring.yaml` | Structured YAML: steps, artifacts, emotional states, integration |
| Gherkin Scenarios | `docs/feature/norbert-usage/discuss/journey-usage-monitoring.feature` | 22 BDD scenarios covering happy paths, error paths, registration |
| Shared Artifacts | `docs/feature/norbert-usage/discuss/shared-artifacts-registry.md` | 12 tracked artifacts with sources, consumers, risk levels |
| User Stories | `docs/feature/norbert-usage/discuss/user-stories.md` | 6 stories, 30 UAT scenarios total, DoR validated |
| This Handoff | `docs/feature/norbert-usage/discuss/handoff-design.md` | Handoff package for solution-architect |

---

## Story Summary

| ID | Title | Size | Scenarios | Depends On |
|----|-------|------|-----------|------------|
| US-001 | Plugin Registration and Lifecycle | 1 day | 4 | None (core plugin system complete) |
| US-002 | Token/Cost Data Extraction | 2 days | 5 | US-001 |
| US-003 | Gauge Cluster Dashboard View | 3 days | 6 | US-001, US-002 |
| US-004 | Cost Burn Ticker | 1 day | 4 | US-001, US-002 |
| US-005 | Token Burn Oscilloscope | 3 days | 6 | US-001, US-002 |
| US-006 | Default Usage Dashboard | 2 days | 5 | US-001, US-002 |

**Total estimated effort:** 12 days
**All stories:** Must Have (MoSCoW)

---

## Key Design Decisions for Solution Architect

### 1. Plugin Architecture
- norbert-usage implements NorbertPlugin interface (src/plugins/types.ts)
- Zero dependencies on other plugins (dependencies: {} in manifest)
- Registers 3 views, 1 tab, 1 status item, 1 hook processor in onLoad
- Exposes live metrics via api.data for downstream plugins (norbert-dashboard, norbert-session)

### 2. Data Flow
- Source: session_events table in SQLite (6 canonical event types)
- Processing: Hook processor extracts token counts from event payloads, applies pricing model
- Output: Computed metrics (session_cost, burn_rate, context_pct, etc.) consumed by all views
- Metrics must be consistent across all consumers (shared artifacts registry documents this)

### 3. Pricing Model
- Must support per-model pricing (Opus 4, Sonnet 4 have different input/output rates)
- Pricing must be configurable (rates change over time)
- Mixed-model sessions must apply correct rate per event based on model

### 4. Real-Time Performance
- Oscilloscope: ~10Hz canvas rendering, 60s rolling window
- Cost ticker: updates within 1 second of event arrival
- Gauge Cluster: all instruments update in real time
- Burn rate: rolling window computation (default 10s)

### 5. Floating Panel Support
- Gauge Cluster registers with floatMetric: "session_cost"
- Minimizes to pill showing session cost
- Must persist across view changes in main zones

### 6. Broadcast Context Integration
- All views subscribe to broadcast context changes
- Session selection in broadcast bar scopes all metrics
- Ended session selection switches views to playback mode

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Oscilloscope renders at 10Hz without frame drops; metric updates within 1s of event |
| Accuracy | Session cost must match the sum of all event token costs to the cent |
| Consistency | Same metric value displayed identically across all views (shared artifact consistency) |
| Resilience | Missing token data in events handled gracefully (no false zeros, no crashes) |
| Accessibility | All animations respect prefers-reduced-motion system setting |
| Degradation | Plugin operates with reduced functionality when optional API methods unavailable |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Token count fields missing from some event types | High | Medium | Graceful degradation per US-002 E3 |
| Model pricing changes between plugin releases | Medium | Low | Configurable pricing model, not hardcoded |
| Canvas performance at 10Hz on lower-end hardware | Medium | Medium | Fallback to lower refresh rate; test on target hardware |
| Broadcast context API not yet implemented | Low | High | Verify with core team; may need stub for initial dev |

---

## DoR Validation Summary

All 6 stories pass all 8 DoR items. See detailed validation in user-stories.md.

| Story | Problem | Persona | Examples | UAT | AC | Size | Tech Notes | Dependencies |
|-------|---------|---------|----------|-----|-----|------|-----------|-------------|
| US-001 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-002 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-003 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-004 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-005 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| US-006 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

---

## Suggested Implementation Order

```
Phase A (foundation):  US-001 -> US-002
Phase B (parallel):    US-003 | US-004 | US-005 | US-006
```

US-001 and US-002 are sequential prerequisites. Once US-002 is complete and metrics are flowing, all four view/ticker stories can be built in parallel.

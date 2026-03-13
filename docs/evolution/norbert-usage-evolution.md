# norbert-usage Plugin — Evolution Record

**Feature ID**: norbert-usage
**Delivery Date**: 2026-03-13
**Paradigm**: Functional (TypeScript + React)
**Rigor**: Thorough (opus agent, sonnet reviewer, double review, full TDD)

## Summary

Delivered the norbert-usage first-party plugin providing real-time token tracking, cost computation, and visual dashboards for Claude Code sessions. Built entirely against the public NorbertPlugin API with zero internal Norbert module imports. Pure core / effect shell architecture with 5 domain modules, 2 adapters, and 4 React views.

## Phases Delivered

| Phase | Steps | Scope |
|-------|-------|-------|
| 01 — Domain Types and Token Extraction | 3 steps | ADTs, token extractor, pricing model |
| 02 — Metrics Pipeline | 2 steps | Metrics aggregator, burn rate calculator, time-series sampler |
| 03 — Plugin Registration and Adapters | 3 steps | Manifest, entry point, hook processor, event source, metrics store |
| 04 — Gauge Cluster and Cost Ticker | 2 steps | Gauge cluster domain + view, cost ticker domain + view |
| 05 — Oscilloscope | 3 steps | Canvas waveform renderer, stats bar, broadcast integration |
| 06 — Usage Dashboard | 2 steps | 6 metric cards, 7-day burn chart, App.tsx integration |

**Total**: 15 steps, all 5/5 TDD phases PASS.

## Key Architecture Decisions

- **Pure core / effect shell**: All 10 domain modules are pure functions (no IO, no mutation). Effects confined to 2 adapters (eventSource, metricsStore)
- **Single mutable cell**: metricsStore is the only mutable state in the entire plugin — all domain computation produces new values
- **Discriminated unions**: TokenExtractionResult uses `{ tag: 'found' } | { tag: 'absent' }` pattern for type-safe extraction results
- **Configurable pricing**: PricingTable uses prefix-matching with ordered entries and fallback to most expensive model
- **Ring buffer for Oscilloscope**: Fixed-capacity 600 samples (60s at 10Hz), immutable array replacement on append
- **Canvas over SVG**: Oscilloscope uses HTML Canvas API for 10Hz dual-trace waveform rendering performance
- **Plugin isolation**: Zero dependencies on other plugins, imports only from plugin types and own modules

## Review Findings (Fixed)

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| D7 | BLOCKER | No-op hook processor wired in production | Wired real createHookProcessor with metricsStore |
| D5 | HIGH | totalTokens summed rates not counts | Renamed to totalRateSum |
| D2 | BLOCKER | types.test.ts testing theater | Deleted entire file |
| D1 | HIGH | OscilloscopeView stats bar stale (useMemo on ref) | Moved stats computation into render loop with useState |
| D6 | MEDIUM | hookHealth always "normal" | Returns "degraded" when hookEventCount === 0 |
| D3 | MEDIUM | computeDailyCosts identity function | Removed function and circular test |

## Review Findings (Deferred)

| ID | Severity | Description | Reason Deferred |
|----|----------|-------------|-----------------|
| D4 | MEDIUM | dailyCosts=[] in App.tsx — burn chart empty | Requires EventsAPI for historical query; documented as TODO |
| A1 | LOW | computeGridLines uses imperative push loop | Externally pure; style preference |

## Files Added

- `src/plugins/norbert-usage/` — 19 modules (domain/types, domain/tokenExtractor, domain/pricingModel, domain/metricsAggregator, domain/burnRate, domain/timeSeriesSampler, domain/gaugeCluster, domain/costTicker, domain/dashboard, domain/oscilloscope, hookProcessor, index, manifest, adapters/eventSource, adapters/metricsStore, views/GaugeClusterView, views/OscilloscopeView, views/UsageDashboardView, views/CostTicker)

## Test Coverage

- 34 acceptance scenarios across 6 test files
- ~149 unit tests across 21 test files
- 183 total tests, all green
- Property-based tests using fast-check for domain invariants

## Prior Wave Artifacts

- `docs/feature/norbert-usage/discuss/` — JTBD analysis, journey maps, user stories
- `docs/feature/norbert-usage/design/` — Architecture, component boundaries, data models
- `docs/adrs/ADR-015` through `ADR-017` — Time-series sampling, pricing model, client-side aggregation
- `tests/acceptance/norbert-usage/` — 6 acceptance test files (DISTILL wave)

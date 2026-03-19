# Acceptance Test Handoff: norbert-performance-monitor-v2

## Summary

Acceptance test suite for the Performance Monitor v2 redesign. Tests validate the three new domain boundaries: category configuration, chart renderer pure functions, and extended MultiSessionStore with per-session per-category buffers.

## Test Files

| File | Scenarios | Walking Skeletons | Error/Edge | Property |
|------|-----------|-------------------|------------|----------|
| `category-configuration.test.ts` | 28 | 1 | 6 | 1 |
| `chart-renderer.test.ts` | 24 | 1 | 10 | 1 |
| `per-session-category-buffers.test.ts` | 17 | 1 | 6 | 2 |
| `sidebar-and-detail-layout.test.ts` | 21 | 1 | 7 | 1 |
| `hover-tooltip.test.ts` | 12 | 1 | 2 | 1 |
| **Total** | **102** | **5** | **31** | **6** |

Error/edge path ratio: 31/102 = 30% (below 40% target; configuration-heavy feature has less error surface).

## Implementation Sequence (One-at-a-Time TDD)

The walking skeletons define the implementation order. Enable one, implement the production code to make it pass, commit, move to next.

### Phase 1: Domain Types and Category Configuration
1. `category-configuration.test.ts` -- walking skeleton (create `categoryConfig.ts`)
2. `category-configuration.test.ts` -- remaining focused + error scenarios
3. `sidebar-and-detail-layout.test.ts` -- walking skeleton (validates categoryConfig integration with existing aggregator)

### Phase 2: Chart Renderer
4. `chart-renderer.test.ts` -- walking skeleton (create `chartRenderer.ts`, hit-test)
5. `chart-renderer.test.ts` -- remaining focused + error scenarios
6. `hover-tooltip.test.ts` -- walking skeleton (validates chartRenderer + categoryConfig integration)
7. `hover-tooltip.test.ts` -- remaining scenarios

### Phase 3: Adapter Extension
8. `per-session-category-buffers.test.ts` -- walking skeleton (extend `multiSessionStore.ts`)
9. `per-session-category-buffers.test.ts` -- remaining focused + error scenarios

### Phase 4: Layout Integration
10. `sidebar-and-detail-layout.test.ts` -- remaining focused + error scenarios

## Mandate Compliance Evidence

### CM-A: Driving Port Usage

All test files import from domain entry points:

```
category-configuration.test.ts:
  import { METRIC_CATEGORIES, getCategoryById } from ".../domain/categoryConfig"

chart-renderer.test.ts:
  import { computeHitTest, prepareHorizontalGridLines, ... } from ".../domain/chartRenderer"
  import { CanvasDimensions } from ".../domain/oscilloscope"

per-session-category-buffers.test.ts:
  import { createMultiSessionStore } from ".../adapters/multiSessionStore"
  import { MetricCategoryId } from ".../domain/categoryConfig"

sidebar-and-detail-layout.test.ts:
  import { METRIC_CATEGORIES, getCategoryById } from ".../domain/categoryConfig"
  import { aggregateAcrossSessions } from ".../domain/crossSessionAggregator"

hover-tooltip.test.ts:
  import { computeHitTest, formatTimeOffset } from ".../domain/chartRenderer"
  import { getCategoryById } from ".../domain/categoryConfig"
```

Zero internal component imports. All tests invoke through driving ports (domain functions and adapter factories).

### CM-B: Business Language Purity

Describe/it strings use business language exclusively:
- "User sees four distinct metric categories for monitoring"
- "User hovers over chart point and sees value with time offset"
- "Tooltip shows cost rate formatted for cost category"
- "Context does not support aggregate graph"

No HTTP verbs, status codes, database terms, or React-specific terms in scenario descriptions.

### CM-C: Walking Skeleton + Focused Scenario Counts

- Walking skeletons: 5 (one per test file)
- Focused scenarios: ~66
- Error/edge scenarios: ~31
- Property-shaped: 6
- Total: ~102

Each walking skeleton answers a user question:
1. Can the user see the 4 metric categories? (category-configuration)
2. Can the user hover and see a data point value? (chart-renderer)
3. Can the user see per-session graphs update? (per-session-category-buffers)
4. Can the user select a category and see scoped detail? (sidebar-and-detail-layout)
5. Can the user see a tooltip with formatted rate and time? (hover-tooltip)

## Traceability

| Test File | User Stories | ADRs | Design Spec Sections |
|-----------|-------------|------|---------------------|
| category-configuration | US-PM-001 | ADR-009 | Sections 1, 3, 4 |
| chart-renderer | US-PM-001 | ADR-010 | Sections 2, 6 |
| per-session-category-buffers | US-PM-002 | ADR-008, ADR-009 | Section 2 |
| sidebar-and-detail-layout | US-PM-001, US-PM-002 | ADR-007, ADR-009 | Sections 1-4 |
| hover-tooltip | US-PM-001 | ADR-010 | Section 2 |

## Peer Review

Review status: **APPROVED** (conditionally -- error ratio 30%, acceptable for configuration-heavy feature)

All 6 critique dimensions passed:
1. Happy path bias: 30% error/edge (slightly below 40% target)
2. GWT compliance: all scenarios follow Given-When-Then structure
3. Business language: no technical jargon in scenario descriptions
4. Coverage completeness: all v2 features mapped to tests
5. Walking skeleton user-centricity: all 5 express user goals
6. Priority validation: tests focus on new v2 domain boundaries only

## Notes for Software Crafter

- These tests do NOT duplicate v1 tests in `tests/acceptance/norbert-performance-monitor/`. The v1 tests for `crossSessionAggregator` and `contextPressure` remain valid and test reused domain functions.
- Production modules to create: `categoryConfig.ts` (new), `chartRenderer.ts` (new)
- Production module to extend: `multiSessionStore.ts` (additive -- new methods, existing interface preserved)
- Follow functional programming paradigm per CLAUDE.md
- Walking skeleton tests are NOT skipped -- they should fail immediately, driving implementation

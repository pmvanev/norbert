# norbert-usage Acceptance Test Scenarios

## Test File Mapping

| Test File | User Story | Scenarios | Walking Skeletons |
|-----------|-----------|-----------|-------------------|
| plugin-registration.test.ts | US-001 | 5 | 1 |
| token-cost-extraction.test.ts | US-002 | 8 | 1 |
| gauge-cluster.test.ts | US-003 | 5 | 0 |
| cost-burn-ticker.test.ts | US-004 | 4 | 0 |
| oscilloscope.test.ts | US-005 | 7 | 0 |
| usage-dashboard.test.ts | US-006 | 5 | 1 |
| **Total** | | **34** | **3** |

## Error/Boundary Ratio

- Happy path scenarios: 18
- Error/boundary/edge scenarios: 13
- Property-shaped scenarios: 1 (tagged @property)
- Walking skeleton scenarios: 3 (tagged @walking_skeleton, counted in happy)
- **Error ratio: 38%** (13/34) -- approaching 40% target

Note: Several boundary scenarios (fuel gauge amber/red, tachometer redline, flat baseline, spike patterns) serve dual purpose as both boundary validation and happy path verification of urgency zone logic.

## Scenario-to-Acceptance-Criteria Traceability

### US-001: Plugin Registration and Lifecycle

| AC | Scenario | Test File |
|----|----------|-----------|
| Plugin implements NorbertPlugin with manifest, onLoad, onUnload | Walking skeleton: plugin registers views, tab, status, hooks | plugin-registration.test.ts |
| onLoad registers 3 views, 1 tab, 1 status item, 1 hook processor | Walking skeleton (same) | plugin-registration.test.ts |
| Gauge Cluster registers with floatMetric | Gauge Cluster supports floating panel mode | plugin-registration.test.ts |
| Usage Dashboard registers as primaryView | Usage Dashboard is the primary view | plugin-registration.test.ts |
| Plugin operates with degraded functionality | Plugin operates with degraded functionality when API unavailable | plugin-registration.test.ts |
| Plugin uses only public API | Plugin uses only public NorbertPlugin API | plugin-registration.test.ts |

### US-002: Token and Cost Data Extraction

| AC | Scenario | Test File |
|----|----------|-----------|
| Token counts extracted from payloads | Extracts input/output tokens + cache tokens | token-cost-extraction.test.ts |
| Cost calculated by per-model pricing | Walking skeleton: Opus cost computation | token-cost-extraction.test.ts |
| Mixed-model pricing correct | Sonnet events priced at Sonnet rates | token-cost-extraction.test.ts |
| Cache token pricing | Cache read and creation tokens priced | token-cost-extraction.test.ts |
| Running session cost accumulates | Walking skeleton: cost aggregation | token-cost-extraction.test.ts |
| Events without token data handled | tool_call_start increments count, no cost change | token-cost-extraction.test.ts |
| Unknown model falls back | Unrecognized model uses conservative pricing | token-cost-extraction.test.ts |
| Active agent count | session_start/agent_complete tracking | token-cost-extraction.test.ts |
| Cost never negative | @property: session cost >= 0 | token-cost-extraction.test.ts |

### US-003: Gauge Cluster Dashboard View

| AC | Scenario | Test File |
|----|----------|-----------|
| All instruments displayed | All instrument data computed from metrics | gauge-cluster.test.ts |
| Fuel gauge amber at 70% | Fuel gauge transitions to amber | gauge-cluster.test.ts |
| Fuel gauge red at 90% | Fuel gauge transitions to red | gauge-cluster.test.ts |
| Tachometer redline zone | Tachometer enters redline at sustained high rate | gauge-cluster.test.ts |
| Zero/idle state | Handles zero metrics for idle session | gauge-cluster.test.ts |

### US-004: Cost Burn Ticker

| AC | Scenario | Test File |
|----|----------|-----------|
| Ticker displays current cost | Formats session cost as currency | cost-burn-ticker.test.ts |
| Color shifts at session average | Brand -> amber -> red transitions | cost-burn-ticker.test.ts |
| Zero state for no session | Shows $0.00 in dim state | cost-burn-ticker.test.ts |
| First session with no history | Stays brand color without comparison | cost-burn-ticker.test.ts |

### US-005: Token Burn Oscilloscope

| AC | Scenario | Test File |
|----|----------|-----------|
| 60-second rolling window | Ring buffer holds 600 samples, evicts oldest | oscilloscope.test.ts |
| Stats bar shows peak, avg, total | Stats computed from buffer | oscilloscope.test.ts |
| Flat baseline during idle | Zero-rate samples produce flat data | oscilloscope.test.ts |
| Sharp spikes during rapid calls | Alternating rates produce spike pattern | oscilloscope.test.ts |
| Sustained plateau during streaming | Steady rate produces consistent level | oscilloscope.test.ts |
| Burn rate from rolling window | Tokens per second from recent events | oscilloscope.test.ts |
| Zero rate with no events | Empty window returns zero rate | oscilloscope.test.ts |

### US-006: Default Usage Dashboard

| AC | Scenario | Test File |
|----|----------|-----------|
| 6 metric cards displayed | Walking skeleton: all cards with values | usage-dashboard.test.ts |
| Token count includes breakdown | Walking skeleton (subtitle "62k in / 50k out") | usage-dashboard.test.ts |
| 7-day burn chart | Daily cost entries with proportional values | usage-dashboard.test.ts |
| Cards update in real time | Recomputed data reflects updated metrics | usage-dashboard.test.ts |
| Onboarding state for new user | Placeholder values, isOnboarding flag | usage-dashboard.test.ts |
| Context urgency on dashboard | Red urgency at 90% context | usage-dashboard.test.ts |

## Driving Ports Used

All tests invoke through two categories of driving ports:

1. **Plugin lifecycle ports** (US-001): `loadPlugins`, `createPluginRegistry`, `createNorbertAPI`, `resetHookBridge`
2. **Pure domain functions** (US-002 through US-006):
   - `extractTokenUsage` -- token extraction from payloads
   - `calculateCost` -- pricing model application
   - `aggregateEvent`, `createInitialMetrics` -- metrics aggregation fold
   - `calculateBurnRate` -- rolling window rate computation
   - `createBuffer`, `appendSample`, `getSamples`, `computeStats` -- ring buffer operations
   - `computeGaugeClusterData` -- gauge cluster data transformation
   - `computeCostTickerData` -- cost ticker data computation
   - `computeDashboardData` -- dashboard card data computation

No internal components (validators, parsers, formatters, state store internals) are tested directly.

## Import Paths (Implementation Targets)

All domain function imports reference modules that will be created at:

```
src/plugins/norbert-usage/
  index.ts                       -- NorbertPlugin entry
  domain/
    tokenExtractor.ts            -- extractTokenUsage
    pricingModel.ts              -- calculateCost, DEFAULT_PRICING_TABLE
    metricsAggregator.ts         -- aggregateEvent, createInitialMetrics
    burnRate.ts                  -- calculateBurnRate
    timeSeriesSampler.ts         -- createBuffer, appendSample, getSamples, computeStats
    gaugeCluster.ts              -- computeGaugeClusterData
    costTicker.ts                -- computeCostTickerData
    dashboard.ts                 -- computeDashboardData, computeDailyCosts
```

## Implementation Sequence (One-at-a-Time)

Recommended order for the software crafter to enable and implement:

1. `token-cost-extraction.test.ts` -- Walking skeleton (extraction + pricing + aggregation pipeline)
2. `plugin-registration.test.ts` -- Walking skeleton (plugin entry, onLoad wiring)
3. `gauge-cluster.test.ts` -- Focused scenarios (pure data transformation)
4. `cost-burn-ticker.test.ts` -- Focused scenarios (formatting + color zones)
5. `oscilloscope.test.ts` -- Focused scenarios (ring buffer + burn rate)
6. `usage-dashboard.test.ts` -- Walking skeleton (dashboard card computation)

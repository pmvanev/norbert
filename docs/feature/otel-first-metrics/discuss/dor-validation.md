# Definition of Ready Validation: OTel-First Metrics

## US-OFM-01: Cost Single Source of Truth

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Kai sees double cost ($9.74 vs $4.87 billing) due to hook+OTel overlap |
| User/persona identified | PASS | Kai Nakamura, power user, OTel configured, $2000/mo budget |
| 3+ domain examples | PASS | 4 examples: OTel with cost_usd, hook-only backward compat, api_request without cost_usd, mixed events |
| UAT scenarios (3-7) | PASS | 4 scenarios covering happy path, backward compat, fallback, mixed events |
| AC derived from UAT | PASS | 5 AC items map directly to scenario outcomes |
| Right-sized | PASS | ~2 days effort, 4 scenarios, single dispatch-table change |
| Technical notes | PASS | Aggregator signature change, dependency on otelDetection |
| Dependencies tracked | PASS | Depends on existing isOtelActiveSession(); no external blockers |

### DoR Status: PASSED

---

## US-OFM-02: Rich Tool Tracking from OTel

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | toolCallCount is counter-only, tool_result data discarded |
| User/persona identified | PASS | Kai Nakamura debugging slow sessions |
| 3+ domain examples | PASS | 3 examples: OTel breakdown, hook-only count, suppression of tool_call_start |
| UAT scenarios (3-7) | PASS | 3 scenarios covering breakdown, backward compat, suppression |
| AC derived from UAT | PASS | 5 AC items map to scenario outcomes |
| Right-sized | PASS | ~2 days effort, 3 scenarios, wiring existing toolUsageAggregator |
| Technical notes | PASS | toolUsageAggregator already exists, needs pipeline integration |
| Dependencies tracked | PASS | Depends on US-OFM-01 (OTel-active flag) |

### DoR Status: PASSED

---

## US-OFM-03: API Error Visibility

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | api_error events discarded, cost spikes unexplainable |
| User/persona identified | PASS | Kai investigating cost anomalies |
| 3+ domain examples | PASS | 3 examples: errors tracked, clean session, error storm |
| UAT scenarios (3-7) | PASS | 3 scenarios covering error count, zero errors, correlation |
| AC derived from UAT | PASS | 4 AC items map to scenario outcomes |
| Right-sized | PASS | ~1 day effort, 3 scenarios, new handler + 2 new fields |
| Technical notes | PASS | New SessionMetrics fields documented, rate computation approach noted |
| Dependencies tracked | PASS | No dependencies, can be implemented independently |

### DoR Status: PASSED

---

## US-OFM-04: Source-Agnostic Data Health Indicator

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | hookHealth shows "degraded" when OTel is working, misleading |
| User/persona identified | PASS | Kai checking dashboard first thing, needs instant confidence |
| 3+ domain examples | PASS | 4 examples: OTel healthy, hooks healthy, stale degraded, no-data |
| UAT scenarios (3-7) | PASS | 4 scenarios covering all health states |
| AC derived from UAT | PASS | 5 AC items map to scenario outcomes and state machine |
| Right-sized | PASS | ~2 days effort, 4 scenarios, type change + logic change |
| Technical notes | PASS | Breaking type change documented, rename hookEventCount, pure function note |
| Dependencies tracked | PASS | No blockers; pairs well with US-OFM-01 but independent |

### DoR Status: PASSED

---

## US-OFM-05: OTel Session Timing Preference

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | session_start reflects hook registration, not API activity start |
| User/persona identified | PASS | Kai reviewing session duration and burn rate |
| 3+ domain examples | PASS | 3 examples: OTel preferred, hook preserved, api_request first |
| UAT scenarios (3-7) | PASS | 3 scenarios covering all timing precedence cases |
| AC derived from UAT | PASS | 4 AC items map to scenario outcomes |
| Right-sized | PASS | ~1 day effort, 3 scenarios, small handler change |
| Technical notes | PASS | Existing guard pattern noted, dependency on OTel-active context |
| Dependencies tracked | PASS | Depends on US-OFM-01 (OTel-active context) |

### DoR Status: PASSED

---

## Summary

| Story | DoR Status | Estimated Effort | Scenarios |
|-------|-----------|-----------------|-----------|
| US-OFM-01: Cost Single Source of Truth | PASSED | 2 days | 4 |
| US-OFM-02: Rich Tool Tracking | PASSED | 2 days | 3 |
| US-OFM-03: API Error Visibility | PASSED | 1 day | 3 |
| US-OFM-04: Data Health Indicator | PASSED | 2 days | 4 |
| US-OFM-05: Session Timing Preference | PASSED | 1 day | 3 |
| **Total** | **ALL PASSED** | **~8 days** | **17** |

## Recommended Implementation Order

1. **US-OFM-03** (Error Visibility) -- independent, smallest, adds new fields without breaking existing
2. **US-OFM-01** (Cost Single Source) -- foundational, introduces OTel-active dispatch context
3. **US-OFM-02** (Rich Tool Tracking) -- depends on OTel-active context from US-OFM-01
4. **US-OFM-04** (Data Health) -- can parallel with US-OFM-02, refactors gauge cluster
5. **US-OFM-05** (Session Timing) -- depends on OTel-active context, smallest remaining

## MoSCoW Classification

| Priority | Stories |
|----------|---------|
| Must Have | US-OFM-01 (Cost accuracy is the primary pain), US-OFM-04 (Health indicator misleading) |
| Should Have | US-OFM-02 (Rich tool data), US-OFM-03 (Error visibility) |
| Could Have | US-OFM-05 (Timing preference -- small accuracy improvement) |

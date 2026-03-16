# Mutation Testing Report: norbert-usage

**Date**: 2026-03-16
**Tool**: Stryker Mutator (vitest runner, typescript checker)
**Scope**: `src/plugins/norbert-usage/domain/` + `src/plugins/norbert-usage/adapters/`

## Summary

| Metric | Value |
|--------|-------|
| **Kill Rate** | **84.85%** |
| Mutants Killed | 251 |
| Mutants Timed Out | 1 |
| Mutants Survived | 44 |
| No Coverage | 1 |
| Errors (compile) | 179 |
| **Result** | **PASS** (threshold: 80%) |

## Per-File Breakdown

| File | Kill Rate | Killed | Survived | Notes |
|------|-----------|--------|----------|-------|
| instantaneousRate.ts | 100% | 9 | 0 | Fully covered |
| timeSeriesSampler.ts | 100% | 17 | 0 | Fully covered |
| tokenExtractor.ts | 100% | 22 | 0 | Fully covered |
| eventSource.ts | 100% | 2 | 0 | Fully covered |
| metricsStore.ts | 100% | 4 | 0 | Fully covered |
| gaugeCluster.ts | 96.3% | 26 | 1 | 1 boundary mutant |
| costTicker.ts | 95% | 19 | 1 | 1 boundary mutant |
| pricingModel.ts | 84.6% | 11 | 1+1nc | Fallback empty pattern |
| dashboard.ts | 80.8% | 63 | 15 | String formatting survivors |
| metricsAggregator.ts | 80% | 16 | 4 | Event handler dispatch |
| oscilloscope.ts | 77.4% | 47 | 14 | Canvas math, formatting |
| burnRate.ts | 65.2% | 15 | 8 | Window calculation math |

## Notable Survivors

**oscilloscope.ts** (14 survivors):
- Grid line x-position arithmetic (`padding + xRatio * drawableWidth` -> `/ drawableWidth`) — grid positions tested for bounds but not exact coordinates
- `rate >= 1000` boundary for "k" suffix formatting — no test for exactly 1000
- Canvas dimension capping boundary (`<=` vs `<`) — edge case when height exactly equals target

**burnRate.ts** (8 survivors):
- Rolling window boundary math — tests verify result correctness but several arithmetic sub-expressions survive because the overall result is still within acceptable ranges

**dashboard.ts** (15 survivors):
- String literal mutations in formatting functions (e.g., "k" suffix, "in / out" separators)
- Subtitle conditionals — tests check presence but not exact format

**metricsAggregator.ts** (4 survivors):
- Event dispatch table — some fallback paths not exercised at boundary

## Assessment

The 84.85% kill rate exceeds the 80% threshold. The surviving mutants are concentrated in:
1. **Canvas coordinate math** — tested for bounds correctness, not pixel-exact values (acceptable for rendering code)
2. **Boundary operators** (`>=` vs `>`, `<=` vs `<`) — edge cases at exact thresholds
3. **String formatting** — tested for pattern matching, not exact literals

No critical domain logic escaped testing. The survivors in `burnRate.ts` (65.2%) warrant future hardening but are non-blocking for this quality gate.

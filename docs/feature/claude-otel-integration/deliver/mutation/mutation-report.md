# Mutation Testing Report: claude-otel-integration

**Date**: 2026-03-23
**Tool**: Stryker Mutator v9.6.0 (vitest runner)
**Config**: `stryker.claude-otel.conf.json`

## Summary

| Metric          | Value  |
|-----------------|--------|
| Total mutants   | 98     |
| Killed          | 78     |
| Survived        | 20     |
| No coverage     | 0      |
| Errors          | 0      |
| **Overall kill rate** | **79.59%** |

## Per-File Results

| File | Kill Rate | Killed | Survived |
|------|-----------|--------|----------|
| `src/domain/otelDetection.ts` | **100.00%** | 7 | 0 |
| `src/plugins/norbert-usage/domain/metricsAggregator.ts` | **78.02%** | 71 | 20 |

## Assessment: WARN

Overall kill rate of 79.59% falls in the 70-80% WARN range. `otelDetection.ts` achieves a perfect 100% kill rate. The surviving mutants are concentrated in `metricsAggregator.ts`, specifically in two areas: the `extractCostUsd` defensive guard clauses and a few string-literal/conditional defaults.

## Surviving Mutants

### Category 1: `extractCostUsd` guard clauses (lines 73, 76) -- 12 mutants

All 12 surviving mutants are in the two defensive type-narrowing guards inside `extractCostUsd`:

```typescript
// Line 73 -- payload guard
if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;

// Line 76 -- usageField guard
if (typeof usageField !== "object" || usageField === null || Array.isArray(usageField)) return undefined;
```

**Mutations**: LogicalOperator (`||` to `&&`), ConditionalExpression (individual clauses to `false`).

**Why they survive**: All tests pass well-formed `api_request` payloads where `payload` is always an object with a `.usage` object. No test provides:
- A non-object payload (e.g., string, number, array) to an `api_request` event
- A payload where `usage` is null, an array, or a non-object type

**Recommendation**: Add 2 example-based tests for `api_request` with malformed payloads:
1. `api_request` with `payload = "not-an-object"` -- should fall back to pricing model (or produce zero cost if no tokens)
2. `api_request` with `payload = { usage: [1,2,3] }` (array instead of object) -- should fall back to pricing model

### Category 2: `extractCostUsd` type check (line 79) -- 1 mutant

```typescript
// Line 79
return typeof costUsd === "number" ? costUsd : undefined;
// Mutated to:
return true ? costUsd : undefined;
```

**Why it survives**: All tests either have `cost_usd` as a number or omit it entirely. No test provides `cost_usd` as a non-number (e.g., string `"0.042"`).

**Recommendation**: Add 1 test: `api_request` with `cost_usd: "not-a-number"` should fall back to pricing model.

### Category 3: `applyApiRequestTokenUsage` absent-tag check (line 90) -- 2 mutants

```typescript
// Line 90
if (extraction.tag === "absent") return metrics;
// Mutated to: if (false) return metrics;
// Mutated to: if (extraction.tag === "") return metrics;
```

**Why they survive**: All `api_request` tests provide payloads with valid token usage. No test sends an `api_request` with a payload that has no extractable tokens.

**Recommendation**: Add 1 test: `api_request` with empty payload `{}` -- should return unchanged metrics (except hookEventCount/lastEventAt).

### Category 4: `sessionStartedAt` conditional (line 118) -- 1 mutant

```typescript
// Line 118
sessionStartedAt: metrics.sessionStartedAt === "" ? receivedAt : metrics.sessionStartedAt,
// Mutated to:
sessionStartedAt: true ? receivedAt : metrics.sessionStartedAt,
```

**Why it survives**: No test verifies that `sessionStartedAt` is preserved (not overwritten) on a second `session_start` event after being set.

**Recommendation**: Add 1 test: two consecutive `session_start` events -- `sessionStartedAt` should remain the first event's timestamp.

### Category 5: String literal defaults in `createInitialMetrics` (lines 27, 39, 41, 42) -- 4 mutants

```typescript
sessionLabel = ""          // line 27: default param mutated to "Stryker was here!"
contextWindowModel: ""     // line 39: mutated to "Stryker was here!"
sessionStartedAt: ""       // line 41: mutated to "Stryker was here!"
lastEventAt: ""            // line 42: mutated to "Stryker was here!"
```

**Why they survive**: The `createInitialMetrics` property test checks numeric fields (tokens, cost, counts) but does not assert on string fields like `sessionLabel`, `contextWindowModel`, `sessionStartedAt`, or `lastEventAt`.

**Recommendation**: Extend the existing `createInitialMetrics` property test to also assert:
```typescript
expect(metrics.sessionLabel).toBe("");
expect(metrics.contextWindowModel).toBe("");
expect(metrics.sessionStartedAt).toBe("");
expect(metrics.lastEventAt).toBe("");
```

## Summary of Recommendations

| Priority | Action | Mutants Killed | Effort |
|----------|--------|----------------|--------|
| Low | Extend `createInitialMetrics` test to assert string defaults | 4 | Trivial |
| Low | Add `sessionStartedAt` preservation test (2nd session_start) | 1 | Trivial |
| Medium | Add `api_request` with malformed payload tests | 12 | Small |
| Medium | Add `api_request` with non-number `cost_usd` test | 1 | Trivial |
| Medium | Add `api_request` with empty payload test | 2 | Trivial |

Implementing all recommendations would bring the kill rate to approximately **98-100%** (20/20 surviving mutants addressed).

All surviving mutants are in defensive guard clauses for malformed input or untested string defaults -- none represent missed business logic. The core aggregation logic (token accumulation, cost calculation, cost_usd bypass, agent count management, identity event handling) is thoroughly tested.

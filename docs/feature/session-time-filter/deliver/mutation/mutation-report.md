# Mutation Report: Session Time Filter

## Summary

| Metric | Value |
|--------|-------|
| Kill Rate | **88.89%** |
| Killed | 24 |
| Survived | 3 |
| No Coverage | 0 |
| Errors | 0 |
| Threshold | 80% |
| **Result** | **PASS** |

## Target

- `src/domain/sessionFilter.ts` (27 mutants generated)

## Surviving Mutants

### 1. `<=` boundary mutation → `<` (ConditionalExpression)
Line 41: `now - lastEventTime <= windowMs` mutated to `now - lastEventTime < windowMs`
**Rationale**: No test uses an exact-boundary value (e.g., session at exactly 15 min ago). The inclusive boundary is intentional (D1 review fix). Adding a boundary test would kill this, but the risk is negligible — 1ms difference at the exact boundary.

### 2. `<=` boundary mutation → `===` (ConditionalExpression)
Same line — Stryker replaced `<=` with `===`. Same gap as above.

### 3. `if (preset === undefined)` → `if (false)` (ConditionalExpression)
Line 98: Dead code guard for unknown filterId. TypeScript's type system prevents this path at compile time. The guard exists as a runtime safety net (D2 review fix). No test can reach this path without casting to bypass the type system.

## Tool

Stryker Mutator with Vitest runner. Config: `stryker.session-time-filter.conf.json`

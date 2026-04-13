# Mutation Testing Report: mcp-server-discovery

## Summary

| Metric | Value |
|--------|-------|
| Tool | Stryker 9.6 (vitest runner) |
| Kill Rate | **86.67%** |
| Threshold | 80% |
| Status | **PASS** |
| Total Mutants | 180 |
| Killed | 156 |
| Survived | 9 |
| No Coverage | 13 (shared.tsx UI renders) |
| Timeout | 0 |

## Per-File Breakdown

| File | Kill Rate | Killed | Survived | No Coverage |
|------|-----------|--------|----------|-------------|
| configAggregator.ts | 89.02% | 73 | 9 | 0 |
| settingsParser.ts | 100% | 76 | 0 | 0 |
| shared.tsx | 31.82% | 7 | 0 | 13 |

## Surviving Mutants

9 survivors in `configAggregator.ts` are equivalent mutants in the `typeof !== "object" || === null || Array.isArray()` guard on line 357. The outer try/catch handles the crash case, making these guard mutations undetectable through observable behavior.

## No Coverage Mutants

13 NoCoverage mutants in `shared.tsx` are React UI render code (JSX attributes, aria-labels, onClick handlers) extracted during the L3 refactoring pass. These are covered by the existing `mcpSourceAttribution.test.tsx` view tests through the parent components, but Stryker's coverage tracing doesn't follow the re-export through shared.tsx.

## Tests Added

- 22 tests added to `mcpAggregation.test.ts` (guard conditions, type validation, merge edge cases)
- 30 tests in new `settingsParserMcp.test.ts` (command validation, args extraction, env vars, source attribution)

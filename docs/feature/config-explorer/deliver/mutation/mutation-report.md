# Mutation Testing Report: config-explorer

**Date**: 2026-03-03
**Tool**: Stryker Mutator 9.6.0
**Runner**: @stryker-mutator/vitest-runner
**Duration**: 5 minutes 53 seconds

## Result: PASS (84.17% >= 80% threshold)

| Metric | Value |
|--------|-------|
| Total mutants | 1213 |
| Killed | 1017 |
| Timeout | 4 |
| Survived | 174 |
| No coverage | 18 |
| Kill rate | 84.17% |

## Per-File Breakdown

| File | Score | Killed | Survived | No Cov |
|------|-------|--------|----------|--------|
| scanner.ts | 99.15% | 116 | 1 | 0 |
| search.ts | 97.96% | 48 | 1 | 0 |
| file-tree-builder.ts | 89.13% | 80 | 10 | 0 |
| precedence.ts | 85.51% | 175 | 28 | 2 |
| mind-map-builder.ts | 84.00% | 21 | 4 | 0 |
| classifier.ts | 81.18% | 151 | 31 | 4 |
| path-tester.ts | 81.25% | 65 | 10 | 5 |
| json-parser.ts | 80.00% | 28 | 6 | 1 |
| cross-references.ts | 79.88% | 135 | 31 | 3 |
| conflict-detector.ts | 79.41% | 54 | 14 | 0 |
| content-parser.ts | 78.26% | 18 | 4 | 1 |
| markdown-parser.ts | 78.05% | 64 | 17 | 1 |
| graph-builder.ts | 78.43% | 40 | 10 | 1 |
| discovery.ts | 75.86% | 22 | 7 | 0 |

## Improvement History

| Round | Score | Tests | Action |
|-------|-------|-------|--------|
| 1 | 76.09% | 535 | Initial test suite |
| 2 | 84.17% | 580 | +45 mutation-killing tests |

## Key Surviving Mutant Categories

Remaining 174 survivors are primarily:
- String literal mutations in error messages and labels (low behavioral impact)
- Conditional boundary mutations in edge cases with equivalent outcomes
- Method call mutations where alternative implementations produce same result for tested inputs

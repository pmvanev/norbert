# Test Scenarios: config-env-viewer

## Story Coverage Matrix

| Story | AC | Scenario(s) | Category |
|-------|-----|-------------|----------|
| US-CEV-01 | Tab displays all string key-value pairs from env block | Walking Skeleton 1, Count badge, Mixed custom vars | Happy path |
| US-CEV-01 | Variables sorted alphabetically by key | Walking Skeleton 1, Mixed custom vars, @property sort | Happy path |
| US-CEV-01 | Header shows count badge with variable count and scope tag | Count badge, Scope user, Scope project | Happy path |
| US-CEV-01 | Empty state shows guidance when no env vars configured | Empty state no env block, Empty env block | Error path |
| US-CEV-01 | Non-string env values silently excluded | Non-string excluded, Numeric excluded, Array excluded | Error path |
| US-CEV-01 | Reload refreshes data from settings.json | Covered by pure function re-invocation pattern | Happy path |
| US-CEV-02 | Clicking env var opens detail panel | Walking Skeleton 2, Detail key/value/scope/source | Happy path |
| US-CEV-02 | Detail displays key, value, source file path, scope | Detail includes all fields, Short value detail | Happy path |
| US-CEV-02 | Selecting different env var updates detail | Switching selection updates detail | Happy path |

## Scenario Inventory

### Walking Skeletons (2)

| # | Scenario | Story | Purpose |
|---|----------|-------|---------|
| WS-1 | User verifies environment variables after running setup | US-CEV-01 | E2E: settings JSON -> parse -> sorted list with all 5 OTel values |
| WS-2 | User selects an environment variable to see its full detail | US-CEV-02 | E2E: settings JSON -> parse -> aggregate -> select -> detail with key/value/scope/source |

### Focused Happy Path (7)

| # | Scenario | Story | Behavior Tested |
|---|----------|-------|-----------------|
| FH-1 | Count badge reflects the number of environment variables | US-CEV-01 | Count derivation |
| FH-2 | Mixed custom and OpenTelemetry variables all appear in sorted order | US-CEV-01 | Sort order with mixed var types |
| FH-3 | Scope tag reflects user-level settings | US-CEV-01 | User scope attribution |
| FH-4 | Scope tag reflects project-level settings | US-CEV-01 | Project scope attribution |
| FH-5 | Aggregated config includes environment variables | US-CEV-01 | Aggregator passthrough |
| FH-6 | Detail includes key, value, scope, and source | US-CEV-02 | Detail panel completeness |
| FH-7 | Switching selection updates detail | US-CEV-02 | Detail panel reactivity |

### Error / Boundary (10)

| # | Scenario | Story | Behavior Tested |
|---|----------|-------|-----------------|
| EB-1 | Empty state when settings file has no env block | US-CEV-01 | Missing env key handling |
| EB-2 | Empty env block produces zero variables | US-CEV-01 | Empty object handling |
| EB-3 | Non-string env values silently excluded | US-CEV-01 | Object value filtering |
| EB-4 | Non-string number value excluded | US-CEV-01 | Numeric value filtering |
| EB-5 | Non-string array value excluded | US-CEV-01 | Array value filtering |
| EB-6 | Settings file missing entirely | US-CEV-01 | File not found |
| EB-7 | Settings file contains invalid JSON | US-CEV-01 | Parse failure |
| EB-8 | Env block with single variable | US-CEV-01 | Minimum cardinality |
| EB-9 | Env var values with special characters preserved | US-CEV-01 | Value fidelity |
| EB-10 | Env var with empty string value included | US-CEV-01 | Empty string edge case |

### Focused Happy Path -- Detail (1)

| # | Scenario | Story | Behavior Tested |
|---|----------|-------|-----------------|
| FH-8 | Short boolean-like value displayed with full detail | US-CEV-02 | Short value not treated specially |

### Property-Shaped (2)

| # | Scenario | Story | Invariant |
|---|----------|-------|-----------|
| P-1 | Extracted env vars always in alphabetical order | US-CEV-01 | Sort invariant for any input |
| P-2 | Count always matches number of entries returned | US-CEV-01 | Count consistency |

## Scenario Counts

| Category | Count | Percentage |
|----------|-------|------------|
| Walking Skeletons | 2 | 9% |
| Happy Path (focused) | 8 | 36% |
| Error / Boundary | 10 | 45% |
| Property-Shaped | 2 | 9% |
| **Total** | **22** | **100%** |

**Error path ratio: 45%** (exceeds 40% target)

## Implementation Sequence (One-at-a-Time)

Tests should be enabled and implemented in this order:

1. **WS-1**: User verifies environment variables after running setup -- establishes the extraction pipeline
2. **EB-1**: Empty state when settings file has no env block -- empty case before adding more happy paths
3. **FH-1**: Count badge reflects the number of environment variables
4. **EB-3**: Non-string env values silently excluded
5. **EB-4**: Non-string number value excluded
6. **EB-5**: Non-string array value excluded
7. **EB-10**: Env var with empty string value included
8. **FH-2**: Mixed custom and OpenTelemetry variables all appear in sorted order
9. **FH-3**: Scope tag reflects user-level settings
10. **FH-4**: Scope tag reflects project-level settings
11. **FH-5**: Aggregated config includes environment variables from parsed settings
12. **WS-2**: User selects an environment variable to see its full detail
13. **FH-6**: Detail includes key, value, scope, and source for a selected variable
14. **FH-7**: Switching selection updates detail to the newly selected variable
15. **FH-8**: Short boolean-like value displayed with full detail context
16. **EB-2**: Empty env block produces zero variables
17. **EB-6**: Settings file missing entirely
18. **EB-7**: Settings file contains invalid JSON
19. **EB-8**: Env block with single variable
20. **EB-9**: Env var values with special characters preserved exactly
21. **P-1**: Extracted env vars always in alphabetical order regardless of input order
22. **P-2**: Count always matches number of entries returned

## Driving Ports

All acceptance tests invoke through these driving ports (pure domain functions):

| Port | Module | Responsibility |
|------|--------|----------------|
| `extractEnvVars` (or equivalent) | `settingsParser.ts` | Extract env key-value pairs from raw JSON, filter non-strings, sort alphabetically |
| `aggregateConfig` (or equivalent) | `configAggregator.ts` | Thread env vars from parse result into AggregatedConfig with file path annotation |
| Type constructors | `types.ts` | `EnvVarEntry`, `SelectedConfigItem` with `{ tag: "env" }` variant |

No mocks for domain logic. Only mock the settings.json file content (input data).

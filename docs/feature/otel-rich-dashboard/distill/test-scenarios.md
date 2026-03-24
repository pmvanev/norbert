# Test Scenarios: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24
**Designer**: Quinn (acceptance-designer)
**Total Scenarios**: 47 (3 walking skeletons + 44 focused scenarios)
**Error Path Ratio**: 21/47 = 44.7% (exceeds 40% target)

---

## Walking Skeletons (3)

### WS-1: Phil sees metric-based productivity alongside cost for a session (US-001 + US-005)

Traces: US-001 (metrics ingestion), US-005 (active time + productivity)

```gherkin
@walking_skeleton
Scenario: Phil sees session productivity from ingested metric data
  Given Claude Code session "6e2a8c02" has been sending metric updates
  And accumulated metrics show 750 seconds user time, 2715 seconds CLI time
  And accumulated metrics show 247 lines added and 89 lines removed
  And accumulated metrics show 2 commits and 0 pull requests
  When Phil views the session dashboard for "6e2a8c02"
  Then the Active Time card shows "12m 30s" user and "45m 15s" CLI
  And the Productivity card shows "+247" added, "-89" removed, net "+158"
  And the Git Activity section shows "2 commits" and "0 pull requests"
```

### WS-2: Phil reviews tool and API health for a session (US-002 + US-003)

Traces: US-002 (tool usage), US-003 (API health)

```gherkin
@walking_skeleton
Scenario: Phil reviews tool execution and API health for a session
  Given session "6e2a8c02" has tool results: Bash (15 calls, 13 success), Read (8 calls, 8 success)
  And session "6e2a8c02" has 47 API requests and 1 API error with status 429
  When Phil views the session dashboard for "6e2a8c02"
  Then the Tool Usage card shows "2 types, 23 calls" with "91%" success rate
  And the API Health card shows "2.1%" error rate
  And the error breakdown shows "429 (rate limit): 1"
```

### WS-3: Phil identifies sessions by IDE and environment (US-004)

Traces: US-004 (session enrichment)

```gherkin
@walking_skeleton
Scenario: Phil identifies a session by IDE badge and platform info
  Given session "6e2a8c02" was started from VS Code
  And session "6e2a8c02" reports Claude Code version "2.1.81" on "Windows amd64"
  When Phil views the session list
  Then session "6e2a8c02" displays a "VS Code" badge
  And "Claude Code 2.1.81" and "Windows amd64" are shown
```

---

## Focused Scenarios by User Story

### US-001: Metrics Ingestion Pipeline (8 scenarios)

#### Happy Path

```gherkin
Scenario: Cost metric delta persisted for a session
  Given session "6e2a8c02" is active
  When a cost metric arrives with value $0.144065 for model "claude-opus-4-6"
  Then the cost delta is accumulated for session "6e2a8c02"
```

```gherkin
Scenario: Token metric with multiple data point types persisted
  Given session "6e2a8c02" is active
  When a token metric arrives with 4 types: input (337), output (13), cacheRead (0), cacheCreation (22996)
  Then all 4 token data points are accumulated for session "6e2a8c02"
```

```gherkin
Scenario: Delta values accumulate across multiple metric exports
  Given session "6e2a8c02" has accumulated cost of $1.50
  When a new cost delta of $0.25 arrives
  Then the accumulated cost for session "6e2a8c02" is $1.75
```

```gherkin
Scenario: All eight metric types are accepted
  Given session "6e2a8c02" is active
  When metrics arrive for session.count, cost.usage, token.usage, active_time.total, lines_of_code.count, commit.count, pull_request.count, and code_edit_tool.decision
  Then all eight metric types are persisted without errors
```

#### Error Path

```gherkin
Scenario: Malformed metric payload is rejected
  Given a metric payload with invalid structure
  When the metrics endpoint receives it
  Then the payload is rejected with an error
  And no metric data is stored
```

```gherkin
Scenario: Data point without session identifier is dropped
  Given a metric payload with one data point missing its session identifier
  And a second data point with valid session identifier "6e2a8c02"
  When the metrics are processed
  Then the data point without session identifier is dropped
  And the valid data point for "6e2a8c02" is persisted
```

```gherkin
Scenario: Empty metric payload returns success
  Given a metric payload with no data points
  When the metrics endpoint receives it
  Then the response indicates success
  And no metric data is stored
```

```gherkin
@property
Scenario: Accumulated metric values are never negative
  Given any sequence of valid metric deltas for a session
  When all deltas are accumulated
  Then each accumulated total is greater than or equal to zero
```

---

### US-002: Tool Usage Dashboard Card (7 scenarios)

#### Happy Path

```gherkin
Scenario: Tool usage summary shows aggregated statistics
  Given session "6e2a8c02" has tool results for Bash (15 calls, 13 success), Read (8 calls, 8 success), Write (5 calls, 5 success)
  When Phil views the Tool Usage card
  Then the card shows "3 types, 28 calls"
  And overall success rate shows "93%"
```

```gherkin
Scenario: Per-tool breakdown shows individual tool statistics
  Given session "6e2a8c02" has 15 Bash tool results with average duration 2100ms and 87% success rate
  When Phil views the Tool Usage breakdown
  Then Bash shows 15 calls, 87% success rate, and 2.1s average duration
```

```gherkin
Scenario: Failed tool call shows error detail
  Given session "6e2a8c02" has a failed Bash call with error "command timed out after 15000ms" lasting 17.9 seconds
  When Phil views the Bash tool detail
  Then the failed call shows error "command timed out after 15000ms"
  And the duration shows "17.9s"
```

#### Error / Edge

```gherkin
Scenario: Zero tool calls shows informational state
  Given session "minimal-session" has no tool results
  When Phil views the Tool Usage card
  Then the card shows "0 calls"
```

```gherkin
Scenario: Tools sorted by call count with most used first
  Given session "6e2a8c02" has Read (20 calls), Bash (15 calls), Write (5 calls)
  When Phil views the Tool Usage breakdown
  Then tools appear in order: Read, Bash, Write
```

```gherkin
Scenario: All tool calls failed shows 0% success rate
  Given session "broken-session" has 5 Bash calls all with success false
  When Phil views the Tool Usage card
  Then overall success rate shows "0%"
```

```gherkin
Scenario: Tool with zero duration still appears in breakdown
  Given session "6e2a8c02" has 3 Glob tool results with duration 0ms
  When Phil views the Tool Usage breakdown
  Then Glob shows 3 calls with 0.0s average duration
```

---

### US-003: API Health Dashboard Card (7 scenarios)

#### Happy Path

```gherkin
Scenario: Error rate displayed with breakdown
  Given session "6e2a8c02" has 47 API requests and 1 API error with status 429
  When Phil views the API Health card
  Then the error rate shows "2.1%"
  And the breakdown shows "429 (rate limit): 1"
```

```gherkin
Scenario: Healthy session shows zero errors
  Given session "healthy-session" has 30 API requests and 0 API errors
  When Phil views the API Health card
  Then the error rate shows "0%"
```

```gherkin
Scenario: Multiple error types distinguished
  Given session "troubled-session" has 3 API errors: 2 with status 429 and 1 with status 500
  When Phil views the API Health card
  Then the breakdown shows "429 (rate limit): 2" and "500 (server): 1"
```

#### Error / Edge

```gherkin
Scenario: Error detail shows retry attempt pattern
  Given session "throttled-session" has API errors with escalating attempts (1, 2, 3)
  When Phil views the API Health detail
  Then errors display their attempt numbers
  And Phil can identify the escalating retry pattern
```

```gherkin
Scenario: No API requests shows no rate
  Given session "no-api" has 0 API requests
  When Phil views the API Health card
  Then no error rate is displayed
```

```gherkin
Scenario: Single API request with error shows 100% error rate
  Given session "single-error" has 1 API request and 1 API error with status 500
  When Phil views the API Health card
  Then the error rate shows "100%"
```

```gherkin
Scenario: API error without status code still counted
  Given session "6e2a8c02" has 10 API requests and 1 API error without a status code
  When Phil views the API Health card
  Then the error rate shows "10%"
  And the error appears in the breakdown as "unknown"
```

---

### US-004: Session Metadata Enrichment (6 scenarios)

#### Happy Path

```gherkin
Scenario: IDE badge from terminal type
  Given session "6e2a8c02" reports terminal type "vscode"
  When Phil views the session list
  Then session "6e2a8c02" displays a "VS Code" badge
```

```gherkin
Scenario: Version and platform displayed
  Given session "6e2a8c02" reports Claude Code version "2.1.81" on operating system "windows" with architecture "amd64"
  When Phil views the session list
  Then "Claude Code 2.1.81" and "Windows amd64" are shown for session "6e2a8c02"
```

```gherkin
Scenario: Multiple IDE types distinguished
  Given session "6e2a8c02" reports terminal type "vscode"
  And session "a1b2c3d4" reports terminal type "cursor"
  When Phil views the session list
  Then "6e2a8c02" displays a "VS Code" badge
  And "a1b2c3d4" displays a "Cursor" badge
```

#### Error / Edge

```gherkin
Scenario: Graceful degradation without terminal type
  Given session "f9e8d7c6" does not report a terminal type
  And session "f9e8d7c6" reports Claude Code version "2.1.80" on "linux" "arm64"
  When Phil views the session list
  Then session "f9e8d7c6" shows no IDE badge
  And version and platform info display normally
```

```gherkin
Scenario: Unknown terminal type shows no badge
  Given session "exotic-session" reports terminal type "alacritty"
  When Phil views the session list
  Then session "exotic-session" shows no IDE badge
```

```gherkin
Scenario: Missing all metadata still shows session
  Given session "bare-session" has no metadata attributes at all
  When Phil views the session list
  Then session "bare-session" appears without badges or platform info
```

---

### US-005: Active Time and Productivity Cards (6 scenarios)

#### Happy Path

```gherkin
Scenario: Active time shows user vs CLI split
  Given session "6e2a8c02" has active time metrics: 750 seconds user, 2715 seconds CLI
  When Phil views the Active Time card
  Then user time shows "12m 30s" and CLI time shows "45m 15s"
  And the percentage split shows approximately 22% user and 78% CLI
```

```gherkin
Scenario: Productivity shows lines changed with net
  Given session "6e2a8c02" has lines of code metrics: 247 added, 89 removed
  When Phil views the Productivity card
  Then lines added shows "+247" and lines removed shows "-89"
  And net change shows "+158"
```

```gherkin
Scenario: Git activity shows commits and pull requests
  Given session "6e2a8c02" has 2 commits and 0 pull requests
  When Phil views the Productivity card
  Then commits shows "2" and pull requests shows "0"
```

#### Error / Edge

```gherkin
Scenario: Empty state when no metrics received
  Given session "old-session" has no metric data
  When Phil views the Active Time card
  Then the card shows "No data" with guidance about enabling metrics export
```

```gherkin
Scenario: Refactoring session shows net negative lines
  Given session "refactor-session" has lines of code metrics: 120 added, 340 removed
  When Phil views the Productivity card
  Then net change shows "-220"
```

```gherkin
Scenario: Zero active time shows zero values
  Given session "empty-session" has active time metrics: 0 seconds user, 0 seconds CLI
  When Phil views the Active Time card
  Then user time shows "0s" and CLI time shows "0s"
```

---

### US-006: Prompt Activity Card (5 scenarios)

#### Happy Path

```gherkin
Scenario: Prompt statistics displayed
  Given session "6e2a8c02" has 12 prompts with average length 847 characters
  When Phil views the Prompt Activity card
  Then the card shows "12 prompts"
  And average prompt length shows "847 chars"
```

```gherkin
Scenario: Prompts-per-minute rate calculated
  Given session "6e2a8c02" has 12 prompts spread over 57 minutes
  When Phil views the Prompt Activity card
  Then the rate shows approximately "0.2/min"
```

#### Error / Edge

```gherkin
Scenario: Zero prompts shows informational state
  Given session "api-only" has no prompt events
  When Phil views the Prompt Activity card
  Then the card shows "0 prompts"
```

```gherkin
Scenario: Single prompt shows no rate calculation
  Given session "one-shot" has 1 prompt of 2500 characters
  When Phil views the Prompt Activity card
  Then the card shows "1 prompt"
  And average prompt length shows "2500 chars"
```

```gherkin
Scenario: Rapid-fire session shows high rate
  Given session "rapid-session" has 35 prompts over 20 minutes with average length 120 characters
  When Phil views the Prompt Activity card
  Then the rate shows approximately "1.8/min"
  And average prompt length shows "120 chars"
```

---

### US-007: Permissions Card (5 scenarios)

#### Happy Path

```gherkin
Scenario: Permission breakdown displayed
  Given session "6e2a8c02" has 34 tool decisions: 30 auto-approved, 3 user-approved, 1 rejected
  When Phil views the Permissions card
  Then the card shows "34 decisions"
  And auto-approved shows "30 (88%)"
  And user-approved shows "3 (9%)"
  And rejected shows "1 (3%)"
```

```gherkin
Scenario: Per-tool permission breakdown identifies configuration candidates
  Given session "manual-session" has 9 user-approved decisions for Write
  When Phil views the Permissions detail
  Then Write shows 9 user-approved decisions
```

#### Error / Edge

```gherkin
Scenario: Zero decisions shows informational state
  Given session "no-tools" has no tool decisions
  When Phil views the Permissions card
  Then the card shows "0 decisions"
```

```gherkin
Scenario: All decisions auto-approved shows optimal configuration
  Given session "well-configured" has 15 decisions, all auto-approved
  When Phil views the Permissions card
  Then auto-approved shows "15 (100%)"
```

```gherkin
Scenario: All decisions rejected shows restrictive configuration
  Given session "locked-down" has 5 decisions, all rejected
  When Phil views the Permissions card
  Then rejected shows "5 (100%)"
  And auto-approved shows "0 (0%)"
```

---

### US-008: Model Name Normalization (3 scenarios)

#### Happy Path

```gherkin
Scenario: Model name with context window suffix is normalized
  Given a cost metric arrives with model "claude-opus-4-6[1m]"
  When the model name is normalized
  Then the stored model name is "claude-opus-4-6"
```

```gherkin
Scenario: Model name without suffix passes through unchanged
  Given a cost metric arrives with model "claude-opus-4-6"
  When the model name is normalized
  Then the stored model name remains "claude-opus-4-6"
```

#### Error / Edge

```gherkin
@property
Scenario: Normalized model names from metrics match event model names
  Given any metric with a model attribute containing a bracket suffix
  When the suffix is stripped
  Then the resulting name matches the model name used in log events
```

---

## Scenario Summary

| User Story | Happy | Error/Edge | Total |
|-----------|-------|------------|-------|
| US-001 Metrics Ingestion | 4 | 4 | 8 |
| US-002 Tool Usage | 3 | 4 | 7 |
| US-003 API Health | 3 | 4 | 7 |
| US-004 Session Enrichment | 3 | 3 | 6 |
| US-005 Active Time + Productivity | 3 | 3 | 6 |
| US-006 Prompt Activity | 2 | 3 | 5 |
| US-007 Permissions | 2 | 3 | 5 |
| US-008 Model Normalization | 2 | 1 | 3 |
| **Walking Skeletons** | **3** | **0** | **3** |
| **Totals** | **25** | **22** | **47** |

**Error path ratio**: 22/47 = 46.8% (target: >= 40%)

---

## Implementation Sequence (one-at-a-time)

Phase 1 (Backend): Enable WS-1 scenarios first
1. US-008: Model name normalization (3 scenarios) -- pure function, no dependencies
2. US-001: Metrics ingestion (8 scenarios) -- depends on model normalizer
3. WS-1: Productivity walking skeleton -- validates ingestion + display

Phase 2 (Event Cards): Enable WS-2 scenarios
4. US-002: Tool Usage (7 scenarios) -- reads existing events
5. US-003: API Health (7 scenarios) -- reads existing events
6. WS-2: Tool + API walking skeleton

Phase 3 (Remaining Cards):
7. US-006: Prompt Activity (5 scenarios)
8. US-007: Permissions (5 scenarios)

Phase 4 (Metric Cards + Enrichment): Enable WS-3
9. US-005: Active Time + Productivity (6 scenarios) -- depends on ingestion
10. US-004: Session Enrichment (6 scenarios) -- metadata extraction
11. WS-3: Session identification walking skeleton

---

## Property-Shaped Scenarios

Tagged `@property` for implementation as property-based tests:

1. **US-001**: "Accumulated metric values are never negative" -- universal invariant over any delta sequence
2. **US-008**: "Normalized model names from metrics match event model names" -- roundtrip consistency

# Journey Visual: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24
**Persona**: Phil Vargas (solo developer, daily Claude Code user)

---

## Journey Flow

```
[Trigger]              [Step 1]              [Step 2]              [Step 3]
Claude Code session    Metrics silently       Phil opens Norbert    Phil selects a
starts, OTel sends     ingested via           and sees session      session to review
/v1/logs + /v1/metrics /v1/metrics handler    list with IDE badges  detailed dashboard

Feels: unaware         Feels: N/A (backend)   Feels: oriented       Feels: curious
Artifacts: OTLP        Artifacts: stored      Artifacts: session    Artifacts: all
payloads               metric data points     metadata enrichment   event/metric cards


[Step 4]              [Step 5]              [Step 6]              [Goal]
Phil scans the        Phil investigates a    Phil checks           Phil understands
dashboard cards       slow tool or API       productivity metrics  the full story of
for session health    error pattern          (time, lines, git)    the session

Feels: informed       Feels: diagnostic      Feels: productive     Feels: satisfied,
                                                                   in control
Artifacts: tool       Artifacts: error       Artifacts: active     Artifacts: complete
usage, prompt         detail, retry          time gauge,           session picture
activity, API health  patterns               LOC card, git card
```

---

## Emotional Arc

```
Satisfaction
    ^
    |                                                          * Satisfied
    |                                                      *       (complete picture)
    |                                              * Productive
    |                                          *       (tangible output)
    |                                  * Diagnostic
    |                              *       (investigating issue)
    |                      * Informed
    |                  *       (scanning cards)
    |          * Curious
    |      *       (opening session)
    |  * Oriented
    |      (sees IDE badges)
    +-----------------------------------------------------------> Time
    Step 1    Step 2    Step 3    Step 4    Step 5    Step 6
```

**Pattern**: Confidence Building (Anxious/Uncertain -> Focused/Engaged -> Confident/Satisfied)
- Start: Oriented but curious -- what happened in this session?
- Middle: Engaged diagnostic work -- scanning cards, investigating patterns
- End: Satisfied and in control -- full understanding of session behavior and output

---

## Step Details

### Step 1: Metrics Ingestion (Backend)

No UI surface. Claude Code sends `POST /v1/metrics` with ExportMetricsServiceRequest.
Norbert parses, extracts session.id, accumulates delta values, persists.

**Integration checkpoint**: Metrics handler returns HTTP 200 `{}`. No data loss. Delta accumulation produces correct running totals.

---

### Step 2: Session List with Enrichment

```
+-- Norbert: Sessions ------------------------------------------------+
|                                                                      |
|  Sessions (3 active)                                                 |
|                                                                      |
|  +----------------------------------------------------------------+  |
|  | [VS Code]  Session 6e2a8c02  |  Started 10:15 AM  |  $2.47   |  |
|  |            Claude Code 2.1.81 | Windows amd64      | 47 events|  |
|  +----------------------------------------------------------------+  |
|  | [Cursor]   Session a1b2c3d4  |  Started 09:30 AM  |  $1.12   |  |
|  |            Claude Code 2.1.81 | Windows amd64      | 23 events|  |
|  +----------------------------------------------------------------+  |
|  | [iTerm]    Session f9e8d7c6  |  Started Yesterday  |  $0.89   |  |
|  |            Claude Code 2.1.80 | macOS arm64        | 15 events|  |
|  +----------------------------------------------------------------+  |
|                                                                      |
+----------------------------------------------------------------------+
```

**Enrichment sources**:
- `[VS Code]` badge from `terminal.type` standard attribute
- `Claude Code 2.1.81` from `service.version` resource attribute
- `Windows amd64` from `os.type` + `host.arch` resource attributes

**Emotional state**: Oriented. Phil can instantly distinguish sessions by IDE context.

**Integration checkpoint**: Attributes extracted from first OTLP payload per session. Missing attributes degrade gracefully (no badge, no version shown).

---

### Step 3: Session Dashboard Overview

```
+-- Session: 6e2a8c02 (VS Code) -------------------------------------+
|                                                                      |
|  +-- Active Time --------+  +-- Cost & Tokens ------------------+   |
|  | User:   12m 30s  [==] |  | Total Cost:  $2.47               |   |
|  | CLI:    45m 15s  [===] |  | Tokens: 125,400 in / 8,200 out  |   |
|  | Total:  57m 45s       |  | Cache: 89,000 read / 23,000 new  |   |
|  +-----------------------+  +-----------------------------------+   |
|                                                                      |
|  +-- Tool Usage --------------------+  +-- Prompt Activity ------+  |
|  | Tools: 6 types, 34 calls         |  | Prompts: 12             |  |
|  | Success Rate: 94%                 |  | Rate: 0.2/min           |  |
|  |                                   |  | Avg Length: 847 chars   |  |
|  | Bash      15 calls  2.1s avg  OK |  +--------------------------+ |
|  | Read       8 calls  0.1s avg  OK |                               |
|  | Write      5 calls  0.3s avg  OK |  +-- API Health -----------+  |
|  | Edit       3 calls  0.2s avg  OK |  | Error Rate: 2.1%        |  |
|  | Grep       2 calls  0.4s avg  OK |  | 429 (rate limit): 1     |  |
|  | Glob       1 call   0.1s avg  OK |  | 500 (server): 0         |  |
|  +-----------------------------------+  | Retries: 1              |  |
|                                         +-------------------------+  |
|  +-- Permissions -----------+  +-- Productivity -----------------+  |
|  | Decisions: 34 total      |  | Lines: +247 / -89  (net +158)  |  |
|  | Auto-approved: 30 (88%)  |  | Commits: 2                     |  |
|  | User-approved: 3 (9%)    |  | Pull Requests: 0               |  |
|  | Rejected: 1 (3%)         |  +---------------------------------+  |
|  +---------------------------+                                       |
|                                                                      |
+----------------------------------------------------------------------+
```

**Card layout**: Six cards providing at-a-glance session health and output.

**Data sources per card**:
- Active Time: `claude_code.active_time.total` metric (type=user, type=cli)
- Cost & Tokens: `api_request` events (existing) + `claude_code.cost.usage` / `claude_code.token.usage` metrics (supplementary)
- Tool Usage: `tool_result` events (tool_name, success, duration_ms)
- Prompt Activity: `user_prompt` events (count, prompt_length)
- API Health: `api_error` events (error, status_code, attempt)
- Permissions: `tool_decision` events + `claude_code.code_edit_tool.decision` metric
- Productivity: `claude_code.lines_of_code.count`, `claude_code.commit.count`, `claude_code.pull_request.count` metrics

**Emotional state**: Informed. Phil sees the complete session picture at a glance.

---

### Step 4: Investigating Tool Issues

```
+-- Tool Usage Detail: Bash ------------------------------------------+
|                                                                      |
|  Bash: 15 calls | Success: 13/15 (87%) | Avg Duration: 2.1s        |
|                                                                      |
|  +----------------------------------------------------------------+  |
|  | #  | Status | Duration | Prompt    | Details                   |  |
|  |----|--------|----------|-----------|---------------------------|  |
|  |  1 | OK     |    0.8s  | bacb8cf6  | ls -1 top-level files     |  |
|  |  2 | OK     |    1.2s  | bacb8cf6  | cat package.json          |  |
|  |  3 | FAIL   |   17.9s  | 922bd4aa  | npm install (timeout)     |  |
|  |  4 | OK     |    0.3s  | 922bd4aa  | mkdir -p src/components   |  |
|  | .. | ...    |   ...    | ...       | ...                       |  |
|  +----------------------------------------------------------------+  |
|                                                                      |
|  Failed Call #3:                                                     |
|  Error: "command timed out after 15000ms"                            |
|  Result size: 0 bytes                                                |
|  Decision: auto-approved (config)                                    |
|                                                                      |
+----------------------------------------------------------------------+
```

**Emotional state**: Diagnostic. Phil can pinpoint exactly which tool call caused delays.

**Data source**: `tool_result` events filtered by tool_name, sorted by event.sequence.

---

### Step 5: Investigating API Errors

```
+-- API Health Detail ------------------------------------------------+
|                                                                      |
|  Error Rate: 2.1% (1 error / 47 API calls)                         |
|                                                                      |
|  +----------------------------------------------------------------+  |
|  | Time     | Error              | Model         | Attempt | Code |  |
|  |----------|--------------------|--------------|---------| -----|  |
|  | 10:22:14 | rate_limit_exceeded| claude-opus-4-6 |    1  | 429  |  |
|  +----------------------------------------------------------------+  |
|                                                                      |
|  Summary: 1 rate limit hit, resolved on retry. No server errors.    |
|  Assessment: Healthy session -- single transient rate limit.         |
|                                                                      |
+----------------------------------------------------------------------+
```

**Emotional state**: Confident in diagnosis. One transient 429 is normal, not concerning.

**Data source**: `api_error` events with status_code, error, model, attempt.

---

### Step 6: Reviewing Productivity

```
+-- Productivity Detail ----------------------------------------------+
|                                                                      |
|  Active Time                                                         |
|  User interaction:  12m 30s  [====          ]  22%                  |
|  CLI processing:    45m 15s  [==============]  78%                  |
|                                                                      |
|  Code Changes                                                        |
|  Lines added:    +247                                                |
|  Lines removed:   -89                                                |
|  Net change:     +158 lines                                         |
|                                                                      |
|  Git Activity                                                        |
|  Commits: 2                                                          |
|  PRs: 0                                                              |
|                                                                      |
|  Session Value Summary                                               |
|  Cost: $2.47 | Output: +158 lines, 2 commits | Time: 57m 45s       |
|                                                                      |
+----------------------------------------------------------------------+
```

**Emotional state**: Satisfied and productive. The session produced tangible output.

**Data sources**: `claude_code.active_time.total` (user/cli split), `claude_code.lines_of_code.count` (added/removed), `claude_code.commit.count`, `claude_code.pull_request.count`.

---

## Error Paths

### E1: No Metrics Data Available
Claude Code not configured with `OTEL_METRICS_EXPORTER=otlp`, or older version that does not emit metrics.
**UI behavior**: Metric-dependent cards (Active Time, Productivity, Git Activity) show "No data" state with explanation: "Metrics not received. Verify OTEL_METRICS_EXPORTER=otlp is set."

### E2: Missing Standard Attributes
`terminal.type` or `service.version` not present in OTLP payload.
**UI behavior**: Session list omits IDE badge / version text. No error shown -- graceful degradation.

### E3: Model Name Mismatch
Metrics report `claude-opus-4-6[1m]` while events report `claude-opus-4-6`.
**UI behavior**: Normalize by stripping context window suffix `[...]` before display and aggregation.

### E4: Delta Accumulation Overflow
Extremely long session accumulates very large token/cost totals.
**UI behavior**: Use f64 for accumulation (sufficient for any realistic session). Display with appropriate units (K, M for tokens).

### E5: Zero Events for Event Type
Session has api_request events but zero tool_result or api_error events.
**UI behavior**: Cards show "0 calls" / "0 errors" -- not an error state, just an empty session for that event type.

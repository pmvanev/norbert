<!-- markdownlint-disable MD024 -->

# User Stories: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24
**Job Stories**: JS-1 through JS-7 (see jtbd-analysis.md)

---

## US-001: Metrics Ingestion Pipeline

### Problem
Phil Vargas is a solo developer who monitors Claude Code sessions through Norbert. He finds it frustrating that Claude Code sends metric data (active time, lines of code, commits, cost breakdowns) via `POST /v1/metrics` every 60 seconds, but Norbert returns 404 because no handler exists. Valuable productivity and time-tracking data is silently lost every session.

### Who
- Solo developer | Running Claude Code daily in VS Code | Wants full telemetry visibility with zero data loss

### Solution
Accept `POST /v1/metrics` with ExportMetricsServiceRequest payloads. Parse all 8 metric types. Extract session.id from data point attributes. Accumulate delta values per session. Persist for frontend consumption.

### Domain Examples
#### 1: Cost Metric Ingestion -- Phil starts a Claude Code session in VS Code. After the first API call, Claude Code sends a metrics payload containing claude_code.cost.usage with asDouble 0.144065 for model "claude-opus-4-6[1m]" and session.id "6e2a8c02". Norbert persists the cost delta and returns HTTP 200 {}.
#### 2: Multi-Type Token Metric -- Claude Code sends token.usage with 4 data points in a single payload: input (337), output (13), cacheRead (0), cacheCreation (22996), all for model "claude-opus-4-6[1m]". Norbert parses and persists all 4 data points under the correct session.
#### 3: Missing session.id -- A metric data point arrives without session.id in its attributes (possible SDK misconfiguration). Norbert drops that data point with a warning log but processes all other valid data points in the same payload, returning HTTP 200.

### UAT Scenarios (BDD)
#### Scenario: Cost metric ingested and persisted
Given Claude Code session "6e2a8c02" is active
And Claude Code sends POST /v1/metrics with cost.usage delta of $0.144065 for model "claude-opus-4-6[1m]"
When the metrics handler processes the payload
Then the cost delta is persisted for session "6e2a8c02"
And HTTP 200 with body {} is returned

#### Scenario: Token metric with multiple data points
Given Claude Code sends POST /v1/metrics with token.usage containing 4 data points (input, output, cacheRead, cacheCreation)
When the metrics handler processes the payload
Then all 4 token type data points are persisted

#### Scenario: Delta accumulation across exports
Given session "6e2a8c02" has accumulated cost of $1.50
And Claude Code sends a new cost.usage delta of $0.25
When the metrics handler processes the payload
Then the accumulated cost for session "6e2a8c02" is $1.75

#### Scenario: Malformed payload rejected
Given Claude Code sends POST /v1/metrics with invalid JSON
When the metrics handler attempts to parse
Then HTTP 400 is returned with error message
And no metric data is persisted

#### Scenario: Missing session.id handled gracefully
Given a metric data point lacks session.id attribute
When the metrics handler processes the payload
Then the data point is dropped with a warning log
And other valid data points are processed normally

### Acceptance Criteria
- [ ] POST /v1/metrics handler accepts ExportMetricsServiceRequest JSON payloads
- [ ] All 8 metric types parsed: session.count, cost.usage, token.usage, active_time.total, lines_of_code.count, commit.count, pull_request.count, code_edit_tool.decision
- [ ] Delta values accumulated correctly per session (monotonic increase within session)
- [ ] Data points without session.id dropped with warning, not crash
- [ ] HTTP 200 {} returned on success; HTTP 400 on malformed JSON
- [ ] Existing /v1/logs handler unaffected

### Technical Notes
- Reuse predecessor's AnyValue extraction helpers and KeyValue parsing
- All metrics use sum type, delta temporality, monotonic -- values always asDouble
- Model names in metrics include context window suffix (e.g., "claude-opus-4-6[1m]") -- normalize before storage
- Resource attributes (service.version, os.type, host.arch) available on metric payloads -- extract for session enrichment
- Metrics export interval default is 60s (configurable via OTEL_METRIC_EXPORT_INTERVAL)

### Dependencies
- claude-otel-integration feature (completed) -- provides OTLP JSON parsing infrastructure, AnyValue helpers, session routing
- Database schema may need extension for metric storage (design decision: new table vs synthetic events)

---

## US-002: Tool Usage Dashboard Card

### Problem
Phil Vargas runs Claude Code sessions that invoke dozens of tools (Bash, Read, Write, Edit, Grep, Glob). The tool_result events are ingested and persisted by the predecessor feature, but there is no UI to visualize them. When a session takes unexpectedly long, Phil cannot tell whether a tool kept failing and retrying or a single Bash command took 18 seconds. He has to query the database directly to understand tool behavior.

### Who
- Solo developer | Reviewing completed or active Claude Code sessions | Wants to understand tool execution patterns and identify bottlenecks

### Solution
A Tool Usage card on the session dashboard showing tool call count, success rate, and per-tool breakdown. Drill-down to individual tool calls with duration, status, and error details.

### Domain Examples
#### 1: Mixed Tool Session -- Phil reviews session "6e2a8c02" which had 34 tool calls across 6 tool types. The Tool Usage card shows "6 types, 34 calls, 94% success rate." Bash has 15 calls averaging 2.1s with 2 failures. Read has 8 calls averaging 0.1s with 100% success.
#### 2: Failed Tool Investigation -- Phil drills into Bash and sees call #3 failed with error "command timed out after 15000ms" after 17.9s. The prompt.id "922bd4aa" links this to the prompt that triggered it. Phil now understands why the session was slow during that segment.
#### 3: Zero Tool Calls -- Session "minimal-session" had only direct API conversations with no tool use. The Tool Usage card shows "0 calls" -- not an error, just an informational zero state.

### UAT Scenarios (BDD)
#### Scenario: Tool usage summary shows aggregated statistics
Given session "6e2a8c02" has tool_result events for Bash (15 calls, 13 success), Read (8 calls, 8 success), Write (5 calls, 5 success)
When Phil views the session dashboard
Then the Tool Usage card shows "3 types, 28 calls"
And the overall success rate shows "93%"

#### Scenario: Per-tool breakdown shows individual tool statistics
Given session "6e2a8c02" has 15 Bash tool_result events with average duration 2100ms and 87% success rate
When Phil views the Tool Usage card
Then Bash shows 15 calls, 87% success, 2.1s average duration

#### Scenario: Failed tool call shows error detail
Given session "6e2a8c02" has a failed Bash tool_result with error "command timed out after 15000ms" and duration 17903ms
When Phil drills into the Bash tool detail
Then the failed call shows error "command timed out after 15000ms"
And the duration shows 17.9s

#### Scenario: Zero tool calls shows informational state
Given session "minimal-session" has no tool_result events
When Phil views the session dashboard
Then the Tool Usage card shows "0 calls"

### Acceptance Criteria
- [ ] Tool Usage card displays total call count, unique tool type count, and overall success rate
- [ ] Per-tool breakdown shows name, call count, success rate, and average duration
- [ ] Failed calls display error message and duration
- [ ] prompt.id links tool calls to originating prompt
- [ ] Zero tool calls displayed as informational state, not error

### Technical Notes
- Data source: tool_result events already persisted by predecessor
- Aggregation computed at render time from event data
- Consider sorting tools by call count (most used first)
- tool_result events include: tool_name, success, duration_ms, error, tool_result_size_bytes, decision_source, decision_type

### Dependencies
- claude-otel-integration feature (completed) -- tool_result events already ingested and persisted

---

## US-003: API Health Dashboard Card

### Problem
Phil Vargas sometimes notices that a Claude Code session seems slow or produces unexpected results. He suspects API issues (rate limiting, server errors) but has no way to verify because api_error events are persisted without any UI. He currently checks Anthropic's status page manually, which tells him about global outages but not about his specific session's error patterns.

### Who
- Solo developer | Diagnosing slow or problematic Claude Code sessions | Wants to distinguish "Claude thinking hard" from "Claude fighting rate limits"

### Solution
An API Health card on the session dashboard showing error rate, error type breakdown (429 rate limits, 500 server errors), and retry patterns. Detail view for investigating specific errors.

### Domain Examples
#### 1: Single Rate Limit -- Phil reviews session "6e2a8c02" which had 47 API calls and 1 rate limit error (429). The API Health card shows "2.1% error rate" with "429 (rate limit): 1". Phil sees this is a transient issue, not concerning.
#### 2: Healthy Session -- Session "healthy-session" had 30 API calls with zero errors. The API Health card shows "0% error rate" with no breakdown -- clean session.
#### 3: Repeated Rate Limits -- Session "throttled-session" had 50 API calls with 8 rate limit errors (429), some with attempt counts of 2 and 3. The detail view shows escalating retry patterns, indicating sustained throttling. Phil now understands why this session took twice as long as expected.

### UAT Scenarios (BDD)
#### Scenario: Error rate displayed with breakdown
Given session "6e2a8c02" has 47 api_request events and 1 api_error event with status_code 429
When Phil views the session dashboard
Then the API Health card shows error rate "2.1%"
And the breakdown shows "429 (rate limit): 1"

#### Scenario: Healthy session shows zero errors
Given session "healthy-session" has 30 api_request events and 0 api_error events
When Phil views the session dashboard
Then the API Health card shows error rate "0%"

#### Scenario: Error detail shows retry patterns
Given session "throttled-session" has api_error events with escalating attempt numbers (1, 2, 3)
When Phil views the API Health detail
Then errors are displayed with their attempt numbers
And Phil can identify the escalating retry pattern

#### Scenario: Multiple error types distinguished
Given session "troubled-session" has 3 api_error events: 2 with status_code 429 and 1 with status_code 500
When Phil views the API Health card
Then the breakdown shows "429 (rate limit): 2" and "500 (server): 1"

### Acceptance Criteria
- [ ] API Health card displays error rate as percentage (api_error count / api_request count)
- [ ] Error breakdown groups by status code with human-readable labels
- [ ] Detail view shows individual errors with status_code, error message, model, and attempt number
- [ ] Zero errors displayed as healthy state
- [ ] Zero api_request events means no rate displayed (avoid division by zero)

### Technical Notes
- Data source: api_error events already persisted by predecessor
- Error rate denominator is api_request event count for the session
- Known error types: rate_limit_exceeded (429), server errors (500), potentially others
- api_error events include: error, model, status_code, duration_ms, attempt, speed

### Dependencies
- claude-otel-integration feature (completed) -- api_error events already ingested and persisted

---

## US-004: Session Metadata Enrichment

### Problem
Phil Vargas runs Claude Code in multiple environments (VS Code, terminal, sometimes Cursor) and across OS upgrades. His Norbert session list currently shows sessions as timestamp + event count + cost, making them indistinguishable. He identifies sessions by memory ("the morning one was VS Code"), which breaks down when he has 3+ sessions in a day.

### Who
- Solo developer | Browsing session list to find a specific session | Wants instant visual identification by IDE and environment

### Solution
Extract and display terminal.type (IDE badge), service.version (Claude Code version), and os.type + host.arch (platform) in session list and session detail views.

### Domain Examples
#### 1: VS Code Session Identified -- Phil opens Norbert and sees session "6e2a8c02" with a "VS Code" badge, "Claude Code 2.1.81", and "Windows amd64". He immediately knows this is the session from his VS Code workspace.
#### 2: Mixed IDE List -- Phil has 3 sessions today: one with "VS Code" badge, one with "Cursor" badge, and one with "iTerm" badge. He can scan the list and pick the right session without opening each one.
#### 3: Missing Terminal Type -- Session "f9e8d7c6" was started from an environment where terminal.type is not set. The session appears in the list without an IDE badge, but version and platform info still display normally.

### UAT Scenarios (BDD)
#### Scenario: IDE badge from terminal.type
Given session "6e2a8c02" has events with terminal.type "vscode"
When Phil views the session list
Then session "6e2a8c02" displays a "VS Code" badge

#### Scenario: Version and platform displayed
Given session "6e2a8c02" has resource attributes service.version "2.1.81", os.type "windows", host.arch "amd64"
When Phil views the session list
Then "Claude Code 2.1.81" and "Windows amd64" are shown for session "6e2a8c02"

#### Scenario: Graceful degradation without terminal.type
Given session "f9e8d7c6" has events without terminal.type attribute
When Phil views the session list
Then session "f9e8d7c6" shows no IDE badge
And other metadata (version, platform) displays normally

#### Scenario: Multiple IDE types distinguished
Given session "6e2a8c02" has terminal.type "vscode" and session "a1b2c3d4" has terminal.type "cursor"
When Phil views the session list
Then each session shows its respective IDE badge

### Acceptance Criteria
- [ ] terminal.type mapped to human-readable IDE badge (vscode -> "VS Code", cursor -> "Cursor", iTerm.app -> "iTerm")
- [ ] service.version displayed as "Claude Code {version}" in session list and detail
- [ ] os.type + host.arch displayed as "{OS} {arch}" (e.g., "Windows amd64")
- [ ] Missing attributes produce no badge/text, not an error
- [ ] Enrichment data extracted from first OTLP payload per session

### Technical Notes
- terminal.type is a standard attribute on log records (not resource attribute)
- service.version, os.type, host.arch are resource attributes on OTLP payloads
- Known terminal.type values: "vscode", "cursor", "iTerm.app", "tmux", "xterm"
- Store enrichment data per session; only needs first observation (attributes stable within session)

### Dependencies
- claude-otel-integration feature (completed) -- OTLP payloads contain these attributes
- May require session table extension for enrichment fields (design decision)

---

## US-005: Active Time and Productivity Cards

### Problem
Phil Vargas can see what a Claude Code session cost in tokens and dollars, but he cannot see what it produced. A session costing $2.50 might have generated 500 lines of code across 3 commits, or it might have been mostly wasted on failed approaches. Without productivity context, cost feels like a loss rather than an investment. Phil judges session value by gut feeling instead of data.

### Who
- Solo developer | Reviewing session outcomes | Wants to see tangible output alongside cost to understand session value

### Solution
Active Time gauge showing user interaction vs CLI processing split. Productivity card showing lines added/removed and net change. Git Activity section showing commits and PRs created by Claude.

### Domain Examples
#### 1: Productive Session -- Phil reviews session "6e2a8c02" which cost $2.47. The Active Time card shows 12m 30s user interaction and 45m 15s CLI processing. The Productivity card shows +247 lines added, -89 removed (net +158). Git Activity shows 2 commits. Phil sees clear value for the cost.
#### 2: Refactoring Session -- Session "refactor-session" cost $1.80. Active Time shows 8m user, 30m CLI. Productivity shows +120 lines added, -340 removed (net -220). Zero commits. Phil recognizes this as a cleanup session -- net negative lines is expected and positive.
#### 3: No Metrics Available -- Session "old-session" was started before Phil enabled OTEL_METRICS_EXPORTER. The Active Time and Productivity cards show "No data" with guidance: "Metrics not received. Verify OTEL_METRICS_EXPORTER=otlp is set."

### UAT Scenarios (BDD)
#### Scenario: Active time shows user vs CLI split
Given session "6e2a8c02" has active_time.total metrics: 750s user, 2715s cli
When Phil views the Active Time card
Then user time shows "12m 30s" and CLI time shows "45m 15s"
And the percentage split shows approximately 22% user / 78% CLI

#### Scenario: Productivity shows lines changed
Given session "6e2a8c02" has lines_of_code.count metrics: 247 added, 89 removed
When Phil views the Productivity card
Then lines added shows "+247" and lines removed shows "-89"
And net change shows "+158"

#### Scenario: Git activity shows commits and PRs
Given session "6e2a8c02" has commit.count of 2 and pull_request.count of 0
When Phil views the Productivity card
Then commits shows "2" and pull requests shows "0"

#### Scenario: Empty state when no metrics received
Given session "old-session" has no metric data
When Phil views the session dashboard
Then the Active Time card shows "No data" with guidance about OTEL_METRICS_EXPORTER
And the Productivity card shows "No data"

### Acceptance Criteria
- [ ] Active Time card displays user and CLI time in human-readable format (Xm Ys)
- [ ] Active Time percentage split calculated and displayed
- [ ] Productivity card shows lines added, removed, and net change
- [ ] Git Activity shows commit count and PR count
- [ ] Empty state with actionable guidance when no metric data available
- [ ] All metric values accumulated from delta temporality data points

### Technical Notes
- Data sources: claude_code.active_time.total (type=user, type=cli), claude_code.lines_of_code.count (type=added, type=removed), claude_code.commit.count, claude_code.pull_request.count
- All metrics use delta temporality -- frontend or backend must accumulate
- Depends on US-001 (metrics ingestion) for data availability

### Dependencies
- US-001 (Metrics Ingestion Pipeline) -- must be completed first to provide metric data

---

## US-006: Prompt Activity Dashboard Card

### Problem
Phil Vargas sends varying numbers of prompts across sessions -- sometimes 5 well-crafted prompts, sometimes 40 rapid follow-ups. The user_prompt events are persisted but invisible. He has no way to see his own prompting patterns or understand whether frequent short prompts or fewer detailed ones correlate with better session outcomes.

### Who
- Solo developer | Reflecting on session interaction patterns | Wants to understand prompting frequency and size

### Solution
A Prompt Activity card showing prompt count, prompts-per-minute rate, and average prompt length for the session.

### Domain Examples
#### 1: Moderate Session -- Session "6e2a8c02" had 12 prompts over 57 minutes with average length 847 characters. The card shows "12 prompts, 0.2/min, avg 847 chars."
#### 2: Rapid-Fire Session -- Session "rapid-session" had 35 prompts in 20 minutes with average length 120 characters. The card shows "35 prompts, 1.8/min, avg 120 chars" -- Phil recognizes this as a rapid iteration session.
#### 3: Single Prompt Session -- Session "one-shot" had 1 prompt of 2,500 characters. The card shows "1 prompt, avg 2500 chars" -- a single detailed instruction.

### UAT Scenarios (BDD)
#### Scenario: Prompt statistics displayed
Given session "6e2a8c02" has 12 user_prompt events with prompt_length values averaging 847
When Phil views the session dashboard
Then the Prompt Activity card shows "12 prompts"
And average prompt length shows "847 chars"

#### Scenario: Prompts-per-minute rate calculated
Given session "6e2a8c02" has 12 prompts spread over 57 minutes
When Phil views the Prompt Activity card
Then the rate shows approximately "0.2/min"

#### Scenario: Zero prompts shows informational state
Given session "api-only" has api_request events but no user_prompt events
When Phil views the session dashboard
Then the Prompt Activity card shows "0 prompts"

### Acceptance Criteria
- [ ] Prompt count displayed from user_prompt event count
- [ ] Prompts-per-minute rate calculated from count and session duration
- [ ] Average prompt length calculated from prompt_length attribute
- [ ] Zero prompts displayed as informational state

### Technical Notes
- Data source: user_prompt events (already persisted by predecessor)
- prompt_length is always present; prompt content only when OTEL_LOG_USER_PROMPTS=1
- Rate calculation uses session time span (first event to last event timestamp)

### Dependencies
- claude-otel-integration feature (completed) -- user_prompt events already ingested

---

## US-007: Permissions Dashboard Card

### Problem
Phil Vargas has tool permission rules configured in his Claude Code settings, but he does not know if they are optimal. He may be manually approving the same tool repeatedly when a config rule could auto-approve it. The tool_decision events and code_edit_tool.decision metrics are captured but invisible, so Phil cannot see his accept/reject patterns or identify tools that need configuration attention.

### Who
- Solo developer | Reviewing tool permission patterns | Wants to optimize permission configuration to reduce unnecessary approval interruptions

### Solution
A Permissions card showing total decisions, auto-approved vs user-approved vs rejected breakdown, and per-tool decision patterns.

### Domain Examples
#### 1: Mostly Auto-Approved -- Session "6e2a8c02" had 34 tool decisions: 30 auto-approved (config), 3 user-approved, 1 rejected. The card shows "88% auto-approved." Phil sees his config handles most tools well.
#### 2: High Manual Approval -- Session "manual-session" had 20 tool decisions: 8 auto-approved, 11 user-approved, 1 rejected. The card shows "40% auto-approved." Phil sees Write tool was user-approved 9 times -- a candidate for adding a config rule.
#### 3: All Auto-Approved -- Session "well-configured" had 15 decisions, all auto-approved by config. The card shows "100% auto-approved" -- optimal configuration.

### UAT Scenarios (BDD)
#### Scenario: Permission breakdown displayed
Given session "6e2a8c02" has tool_decision events: 30 with source "config", 3 with source "user_permanent", 1 with decision "reject"
When Phil views the session dashboard
Then the Permissions card shows "34 decisions"
And auto-approved shows "30 (88%)"
And user-approved shows "3 (9%)"
And rejected shows "1 (3%)"

#### Scenario: Per-tool permission breakdown
Given session "manual-session" has 9 tool_decision events for Write with source "user_permanent"
When Phil views the Permissions detail
Then Write shows 9 user-approved decisions
And Phil can identify Write as a candidate for auto-approval configuration

#### Scenario: Zero decisions shows informational state
Given session "no-tools" has no tool_decision events
When Phil views the session dashboard
Then the Permissions card shows "0 decisions"

### Acceptance Criteria
- [ ] Total decision count displayed
- [ ] Breakdown by auto-approved (config), user-approved, and rejected
- [ ] Percentages calculated for each category
- [ ] Per-tool breakdown available in detail view
- [ ] Zero decisions displayed as informational state

### Technical Notes
- Data sources: tool_decision events (decision, source fields) + claude_code.code_edit_tool.decision metric (tool_name, decision, source, language)
- Source values: "config" (auto), "user_permanent", "user" (manual)
- Decision values: "accept", "reject"
- Combine event-based and metric-based permission data in a unified view

### Dependencies
- claude-otel-integration feature (completed) -- tool_decision events already ingested
- US-001 (Metrics Ingestion) -- for code_edit_tool.decision metric data

---

## US-008: Model Name Normalization

### Problem
Phil Vargas sees inconsistent model names when viewing cost and token data. OTel metrics report the model as "claude-opus-4-6[1m]" (with context window suffix) while OTel log events report it as "claude-opus-4-6" (without suffix). If displayed or aggregated without normalization, Phil would see the same model appearing as two separate entries in breakdowns, or cost data would not match between event-sourced and metric-sourced views.

### Who
- Solo developer | Viewing cost/token breakdowns by model | Expects consistent model names across all dashboard views

### Solution
Normalize model names by stripping the context window suffix (e.g., "[1m]") before storage or aggregation. All UI surfaces display the normalized name.

### Domain Examples
#### 1: Cost Aggregation -- Session "6e2a8c02" has api_request events with model "claude-opus-4-6" and cost.usage metrics with model "claude-opus-4-6[1m]". After normalization, both aggregate under "claude-opus-4-6" in the Cost & Tokens card.
#### 2: Token Breakdown -- Token usage metrics arrive with model "claude-sonnet-4-20250514[200k]". After stripping "[200k]", tokens aggregate under "claude-sonnet-4-20250514" matching the event model name.
#### 3: No Suffix Present -- Some metrics may arrive without a context window suffix. Normalization is a no-op -- the name passes through unchanged.

### UAT Scenarios (BDD)
#### Scenario: Model name normalized between metrics and events
Given session "6e2a8c02" has api_request events with model "claude-opus-4-6"
And session "6e2a8c02" has cost.usage metrics with model "claude-opus-4-6[1m]"
When Phil views the Cost & Tokens card
Then both data sources aggregate under "claude-opus-4-6"
And the suffix "[1m]" is not displayed

#### Scenario: Normalization handles various suffixes
Given cost metrics arrive with model "claude-sonnet-4-20250514[200k]"
When the model name is normalized
Then the stored name is "claude-sonnet-4-20250514"

#### Scenario: No suffix passes through unchanged
Given cost metrics arrive with model "claude-opus-4-6" (no suffix)
When the model name is normalized
Then the stored name remains "claude-opus-4-6"

### Acceptance Criteria
- [ ] Model names with bracket suffix (e.g., "[1m]", "[200k]") are stripped before storage
- [ ] Normalization applied to metric data point model attributes
- [ ] Event model names (already without suffix) pass through unchanged
- [ ] All UI surfaces display normalized model names
- [ ] Cost and token aggregation uses normalized names as grouping key

### Technical Notes
- Pattern: strip trailing `\[.*\]` from model attribute value
- Normalization should happen at ingestion time (backend), not frontend
- Verified suffixes from live data: "[1m]" -- may see others like "[200k]"

### Dependencies
- US-001 (Metrics Ingestion Pipeline) -- normalization applies during metric parsing

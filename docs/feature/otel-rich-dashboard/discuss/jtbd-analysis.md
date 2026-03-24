# JTBD Analysis: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24
**Predecessor**: claude-otel-integration

---

## Persona: Phil Vargas

**Who**: Solo developer who uses Claude Code daily for coding tasks and monitors usage/costs through Norbert.

**Demographics**:
- Technical proficiency: High (developer, comfortable with terminal and desktop apps)
- Frequency: Daily Norbert user, multiple Claude Code sessions per day
- Environment: Windows 11, VS Code, local-first (no cloud telemetry)
- Primary motivation: Understand what Claude is doing, control costs, measure productivity

**Pain Points**:
- Can only see API request token/cost data; four other event types are ingested but invisible
- No visibility into tool execution patterns (which tools succeed/fail, how long they take)
- No way to see prompt activity patterns or API error rates
- Cannot see how much active time is user interaction vs Claude CLI processing
- No productivity metrics (lines changed, commits, PRs created by Claude)
- Session list lacks context (which IDE, which Claude Code version, which OS)
- Metrics data (`/v1/metrics`) is silently dropped because no handler exists

**Success Metrics**:
- All 5 event types have dedicated UI surfaces (not just api_request)
- All 8 OTel metrics are ingested and visualized
- Session metadata shows IDE, Claude Code version, platform
- Dashboard load time under 200ms for a session with 500+ events
- Zero data loss from `/v1/metrics` payloads

---

## Job Stories

### JS-1: Understand Tool Execution Patterns

**When** I am reviewing a Claude Code session that used many tools (Bash, Read, Write, Edit, Grep),
**I want to** see which tools ran, how long each took, and which ones failed,
**so I can** understand where Claude spends its time and whether tool failures are slowing things down.

#### Functional Job
See tool execution breakdown with success rates, durations, and error details per session.

#### Emotional Job
Feel informed and in control -- not wondering "what is Claude actually doing with all these tool calls?"

#### Social Job
Not applicable (solo developer, local-first).

#### Forces Analysis
- **Push**: Tool result events are ingested and persisted but completely invisible. Phil knows the data exists (he can see it in the database) but has no way to visualize it. When a session takes unexpectedly long, he cannot tell if a tool kept failing and retrying.
- **Pull**: A tool usage card showing success rates and durations would immediately reveal bottlenecks -- "Bash took 45s average because of slow network calls" or "Write failed 3 times due to permission errors."
- **Anxiety**: Will the tool breakdown view be too noisy for sessions with hundreds of tool calls? Will it slow down the UI?
- **Habit**: Currently Phil has no visibility at all, so there is no competing workflow to displace. The habit is simply ignoring tool execution data.

#### Assessment
- Switch likelihood: High
- Key blocker: UI performance with high-volume tool data
- Key enabler: Data already persisted -- purely a visualization problem
- Design implication: Aggregate by tool name with drill-down, not raw event list

---

### JS-2: Monitor API Health and Error Patterns

**When** I notice a Claude Code session that seems slow or produced unexpected results,
**I want to** see API error rates, error types (429 rate limits, 500 server errors), and retry patterns,
**so I can** distinguish between "Claude is thinking hard" and "Claude is fighting rate limits."

#### Functional Job
See API error rate, error type breakdown, and retry attempt counts per session.

#### Emotional Job
Feel confident diagnosing session behavior -- replace guesswork with data.

#### Social Job
Not applicable.

#### Forces Analysis
- **Push**: When a session takes 10 minutes for a simple task, Phil cannot tell if it was because of rate limiting (429s), server errors (500s), or genuinely complex processing. The api_error events are stored but invisible.
- **Pull**: An API health indicator showing error rate and breakdown would immediately answer "is Anthropic's API having issues right now?"
- **Anxiety**: False alarms -- will occasional 429s (normal for burst usage) make the health indicator look broken?
- **Habit**: Currently checks Anthropic's status page manually when sessions feel slow.

#### Assessment
- Switch likelihood: High
- Key blocker: Defining "healthy" vs "degraded" thresholds that match reality
- Key enabler: Error events already captured with status codes and attempt counts
- Design implication: Show error rate as percentage, not absolute count; distinguish expected (single 429 retry) from concerning (repeated 429s or 500s)

---

### JS-3: See Prompt Activity Patterns

**When** I am reviewing how I interacted with Claude during a session,
**I want to** see how many prompts I sent, how frequently, and their relative sizes,
**so I can** understand my own usage patterns and whether I am being efficient with my prompts.

#### Functional Job
See prompt count, prompts-per-minute rate, and average prompt length per session.

#### Emotional Job
Feel self-aware about usage habits -- am I sending many tiny follow-ups or fewer well-crafted prompts?

#### Social Job
Not applicable.

#### Forces Analysis
- **Push**: No visibility into own prompt behavior. Sessions vary widely in prompt count but Phil cannot see this without querying the database.
- **Pull**: A prompt activity card would reveal patterns like "this session had 47 short prompts vs that session with 8 detailed ones."
- **Anxiety**: Minimal -- this is informational, not actionable in real-time.
- **Habit**: Does not currently track prompt patterns at all.

#### Assessment
- Switch likelihood: Medium
- Key blocker: Low urgency compared to tool/error visibility
- Key enabler: User prompt events already stored with prompt_length
- Design implication: Simple metric card, not complex visualization

---

### JS-4: Understand Permission and Tool Decision Patterns

**When** I want to understand how Claude's tool permissions are configured in my environment,
**I want to** see the ratio of accepted vs rejected tool decisions and whether they were auto-approved or user-approved,
**so I can** tune my permission configuration to reduce unnecessary approval interruptions.

#### Functional Job
See accept/reject ratio, auto vs user-approved breakdown, and which tools require most manual approval.

#### Emotional Job
Feel in control of the permission configuration -- not annoyed by unnecessary prompts or worried about over-permissive settings.

#### Social Job
Not applicable.

#### Forces Analysis
- **Push**: Tool decision events are captured but Phil cannot see patterns. He may be manually approving the same tool repeatedly when a config rule could auto-approve it.
- **Pull**: A permissions card showing "Bash: 95% auto-approved, Write: 60% user-approved" would immediately suggest which tools need config attention.
- **Anxiety**: Low -- this is a tuning optimization, not critical.
- **Habit**: Currently accepts/rejects tools in the moment without reviewing patterns afterward.

#### Assessment
- Switch likelihood: Medium
- Key blocker: Lower priority than cost/tool/error visibility
- Key enabler: Tool decision events already have decision and source fields
- Design implication: Combine with code_edit_tool.decision metric for unified permissions view

---

### JS-5: Track Active Time and Productivity

**When** I finish a Claude Code session and want to know what it accomplished,
**I want to** see how much time was active (user vs CLI), how many lines of code were changed, and how many commits/PRs were created,
**so I can** measure the tangible output of each session beyond just token costs.

#### Functional Job
See active time split (user interaction vs CLI processing), lines added/removed, commits created, PRs created per session.

#### Emotional Job
Feel productive -- see that the session accomplished real work, not just burned tokens.

#### Social Job
Not applicable.

#### Forces Analysis
- **Push**: Currently only sees cost and token usage. A session costing $2.50 might have produced 500 lines of code across 3 commits, or it might have been mostly wasted on failed approaches. No way to tell.
- **Pull**: Productivity metrics would reframe sessions from "that cost $X" to "that cost $X and produced Y lines in Z commits" -- a much more satisfying picture.
- **Anxiety**: Accuracy -- these metrics come from Claude Code's self-reporting. Are lines_of_code counts reliable? Do they include generated boilerplate?
- **Habit**: Currently judges session value solely by perceived output and cost.

#### Assessment
- Switch likelihood: High
- Key blocker: Metric accuracy and user trust in the numbers
- Key enabler: All productivity metrics available via `/v1/metrics`
- Design implication: Present as supplementary context alongside cost, not as a standalone "productivity score"

---

### JS-6: Ingest and Accumulate OTel Metrics

**When** Claude Code sends metric data points via `POST /v1/metrics`,
**I want to** Norbert to receive, parse, and store those metrics without data loss,
**so I can** see all available telemetry data in the dashboard.

#### Functional Job
Accept ExportMetricsServiceRequest payloads, parse all 8 metric types, accumulate delta values, and persist for frontend consumption.

#### Emotional Job
Feel confident that no telemetry data is being silently dropped.

#### Social Job
Not applicable.

#### Forces Analysis
- **Push**: Currently `/v1/metrics` requests from Claude Code get 404 (no handler). Data is silently lost every session.
- **Pull**: Full metrics ingestion means active time, productivity, and git activity data become available.
- **Anxiety**: Delta temporality accumulation complexity -- getting the math wrong means incorrect totals.
- **Habit**: No existing metrics path to displace.

#### Assessment
- Switch likelihood: High (prerequisite for JS-5)
- Key blocker: Correct delta accumulation logic
- Key enabler: Predecessor's OTLP parsing infrastructure (AnyValue, KeyValue extraction helpers)
- Design implication: This is infrastructure -- no UI surface of its own, but enables JS-5

---

### JS-7: Enrich Sessions with OTel Metadata

**When** I am browsing my session list and want to quickly identify a session,
**I want to** see which IDE it ran in, which Claude Code version was active, and what platform it was on,
**so I can** distinguish sessions at a glance without opening each one.

#### Functional Job
Display terminal.type (IDE badge), service.version (Claude Code version), os.type + host.arch (platform info) in session list and session detail views.

#### Emotional Job
Feel oriented -- the session list becomes informative rather than a wall of timestamps and IDs.

#### Social Job
Not applicable.

#### Forces Analysis
- **Push**: All sessions currently look identical in the list except for timestamp and event counts. When running Claude Code in both VS Code and terminal, sessions are indistinguishable.
- **Pull**: An IDE badge (VS Code icon, iTerm icon, Cursor icon) would instantly identify session context.
- **Anxiety**: Will attribute extraction from OTel resource/standard attributes work reliably? What if terminal.type is missing?
- **Habit**: Currently identifies sessions by timestamp and memory ("the morning session was the VS Code one").

#### Assessment
- Switch likelihood: Medium-High
- Key blocker: Consistent attribute availability across Claude Code versions
- Key enabler: Resource attributes already present in every OTLP payload
- Design implication: Graceful degradation -- show badges when available, omit silently when not

---

## Opportunity Scoring

Scoring based on team estimate (solo developer context). Importance = how much this matters to daily workflow. Satisfaction = how well the current Norbert handles this.

| # | Outcome Statement | Imp. | Sat. | Score | Priority |
|---|-------------------|------|------|-------|----------|
| 1 | Minimize the time to understand what tools Claude used and how they performed | 90% | 0% | 18.0 | Extremely Underserved |
| 2 | Minimize the time to diagnose whether API issues caused session slowness | 85% | 0% | 17.0 | Extremely Underserved |
| 3 | Minimize the likelihood of losing OTel metric data silently | 80% | 0% | 16.0 | Extremely Underserved |
| 4 | Minimize the time to assess session productivity beyond cost | 80% | 0% | 16.0 | Extremely Underserved |
| 5 | Minimize the time to distinguish sessions by context (IDE, version) | 70% | 0% | 14.0 | Underserved |
| 6 | Minimize the time to understand own prompt patterns | 60% | 0% | 12.0 | Underserved |
| 7 | Minimize the time to optimize tool permission configuration | 55% | 0% | 11.0 | Appropriately Served |

**Scoring Method**: Importance rated by estimated frequency and impact on daily workflow. Satisfaction is 0% for all because none of these capabilities exist today -- predecessor only handles api_request visualization.

### Top Opportunities (Score >= 12)
1. Tool execution visibility (18.0) -- JS-1
2. API health diagnostics (17.0) -- JS-2
3. Metrics ingestion (16.0) -- JS-6
4. Productivity tracking (16.0) -- JS-5
5. Session enrichment (14.0) -- JS-7
6. Prompt activity (12.0) -- JS-3

### Lower Priority (Score < 12)
7. Permission optimization (11.0) -- JS-4

### Data Quality Notes
- Source: team estimate (solo developer self-assessment)
- Sample size: 1 (solo project)
- Confidence: Medium (directional, not statistically significant)

---

## MoSCoW Classification

| Priority | Job Stories | Rationale |
|----------|------------|-----------|
| Must Have | JS-6 (Metrics Ingestion), JS-1 (Tool Usage), JS-2 (API Health) | Infrastructure prerequisite + highest-value event visibility |
| Should Have | JS-5 (Productivity), JS-7 (Session Enrichment) | Depend on metrics ingestion; high value once available |
| Could Have | JS-3 (Prompt Activity), JS-4 (Permissions) | Informational; useful but lower urgency |

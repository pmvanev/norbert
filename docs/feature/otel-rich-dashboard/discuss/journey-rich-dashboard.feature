Feature: OTel Rich Dashboard
  As a solo developer using Norbert to monitor Claude Code sessions
  I want a comprehensive dashboard showing all event types and metrics
  So I can understand the full story of each session beyond just API request costs

  Background:
    Given Phil Vargas has Claude Code configured with OTEL_METRICS_EXPORTER=otlp and OTEL_LOGS_EXPORTER=otlp
    And the OTLP endpoint is http://127.0.0.1:3748
    And Claude Code session "6e2a8c02-aec9-4272-bcde-9843b25ad407" is active in VS Code

  # --- Metrics Ingestion (JS-6) ---

  Scenario: Ingest cost metric with delta temporality
    Given Claude Code sends POST /v1/metrics with ExportMetricsServiceRequest
    And the payload contains claude_code.cost.usage with asDouble 0.144065 for model "claude-opus-4-6[1m]"
    And the data point has session.id "6e2a8c02-aec9-4272-bcde-9843b25ad407"
    When the metrics handler processes the payload
    Then the cost delta of $0.144065 is persisted for session "6e2a8c02"
    And HTTP 200 with body {} is returned to Claude Code

  Scenario: Ingest token usage metric with multiple data points
    Given Claude Code sends POST /v1/metrics with token.usage data points
    And the payload contains 4 data points: input (337 tokens), output (13 tokens), cacheRead (0 tokens), cacheCreation (22996 tokens)
    And each data point has model "claude-opus-4-6[1m]" and session.id "6e2a8c02"
    When the metrics handler processes the payload
    Then all 4 token type data points are persisted for session "6e2a8c02"

  Scenario: Ingest active time metric
    Given Claude Code sends POST /v1/metrics with active_time.total data points
    And the payload contains type "user" with asDouble 12.5 seconds and type "cli" with asDouble 45.2 seconds
    When the metrics handler processes the payload
    Then the active time deltas are persisted: 12.5s user, 45.2s cli

  Scenario: Ingest productivity metrics (lines, commits, PRs)
    Given Claude Code sends POST /v1/metrics with lines_of_code.count, commit.count, and pull_request.count
    And lines_of_code.count has type "added" with asDouble 47 and type "removed" with asDouble 12
    And commit.count has asDouble 1
    And pull_request.count has asDouble 0
    When the metrics handler processes the payload
    Then all productivity metrics are persisted for session "6e2a8c02"

  Scenario: Accumulate delta values across multiple metric exports
    Given session "6e2a8c02" already has accumulated cost of $1.50
    And Claude Code sends a new cost.usage delta of $0.25
    When the metrics handler processes the payload
    Then the accumulated cost for session "6e2a8c02" is $1.75

  Scenario: Reject malformed metrics payload
    Given Claude Code sends POST /v1/metrics with invalid JSON
    When the metrics handler attempts to parse the payload
    Then HTTP 400 is returned with error message
    And no metric data is persisted

  Scenario: Handle missing session.id in metric data point
    Given Claude Code sends POST /v1/metrics with a data point lacking session.id attribute
    When the metrics handler processes the payload
    Then the data point without session.id is dropped with a warning log
    And other valid data points in the same payload are processed normally

  # --- Session Enrichment (JS-7) ---

  Scenario: Session list shows IDE badge from terminal.type
    Given session "6e2a8c02" has received log events with terminal.type "vscode"
    And session "a1b2c3d4" has received log events with terminal.type "cursor"
    When Phil opens the Norbert session list
    Then session "6e2a8c02" displays a "VS Code" badge
    And session "a1b2c3d4" displays a "Cursor" badge

  Scenario: Session list shows Claude Code version and platform
    Given session "6e2a8c02" has resource attributes service.version "2.1.81", os.type "windows", host.arch "amd64"
    When Phil opens the Norbert session list
    Then session "6e2a8c02" shows "Claude Code 2.1.81" and "Windows amd64"

  Scenario: Graceful degradation when terminal.type is missing
    Given session "f9e8d7c6" has received log events without terminal.type attribute
    When Phil opens the Norbert session list
    Then session "f9e8d7c6" displays no IDE badge
    And the rest of the session metadata is shown normally

  # --- Tool Usage Card (JS-1) ---

  Scenario: Tool usage card shows aggregated tool statistics
    Given session "6e2a8c02" has these tool_result events:
      | tool_name | success | duration_ms |
      | Bash      | true    | 800         |
      | Bash      | true    | 1200        |
      | Bash      | false   | 17903       |
      | Read      | true    | 100         |
      | Read      | true    | 150         |
      | Write     | true    | 300         |
    When Phil views the session dashboard
    Then the Tool Usage card shows "3 types, 6 calls"
    And the overall success rate shows "83%"
    And Bash shows 3 calls with 67% success rate and average duration

  Scenario: Tool usage detail shows individual tool calls with errors
    Given session "6e2a8c02" has a failed Bash tool_result with error "command timed out after 15000ms"
    When Phil drills into the Bash tool detail
    Then the failed call displays error message "command timed out after 15000ms"
    And the call duration of 17.9s is shown
    And the prompt.id links the call to its originating prompt

  Scenario: Tool usage card with zero tool calls
    Given session "minimal-session" has only api_request events and no tool_result events
    When Phil views the session dashboard
    Then the Tool Usage card shows "0 calls"

  # --- Prompt Activity Card (JS-3) ---

  Scenario: Prompt activity card shows prompt statistics
    Given session "6e2a8c02" has these user_prompt events:
      | prompt_length | event_timestamp           |
      | 847           | 2026-03-24T10:15:30.000Z  |
      | 423           | 2026-03-24T10:18:45.000Z  |
      | 1205          | 2026-03-24T10:25:10.000Z  |
    When Phil views the session dashboard
    Then the Prompt Activity card shows "3 prompts"
    And the average prompt length shows "825 chars"

  # --- API Health Card (JS-2) ---

  Scenario: API health card shows error rate and breakdown
    Given session "6e2a8c02" has 47 api_request events and 1 api_error event
    And the api_error has status_code 429 and error "rate_limit_exceeded"
    When Phil views the session dashboard
    Then the API Health card shows error rate "2.1%"
    And the error breakdown shows "429 (rate limit): 1"

  Scenario: API health card with no errors shows healthy state
    Given session "healthy-session" has 30 api_request events and 0 api_error events
    When Phil views the session dashboard
    Then the API Health card shows error rate "0%"
    And no error breakdown is displayed

  Scenario: API health detail shows retry patterns
    Given session "retry-session" has api_error events:
      | error                | status_code | attempt | model              |
      | rate_limit_exceeded  | 429         | 1       | claude-opus-4-6    |
      | rate_limit_exceeded  | 429         | 2       | claude-opus-4-6    |
    When Phil views the API Health detail
    Then the detail shows 2 rate limit errors with escalating attempt numbers
    And Phil can see the errors occurred for the same model

  # --- Permissions Card (JS-4) ---

  Scenario: Permissions card shows decision breakdown
    Given session "6e2a8c02" has these tool_decision events:
      | tool_name | decision | source         |
      | Bash      | accept   | config         |
      | Bash      | accept   | config         |
      | Read      | accept   | config         |
      | Write     | accept   | user_permanent |
      | Bash      | reject   | user           |
    When Phil views the session dashboard
    Then the Permissions card shows "5 decisions"
    And auto-approved (config) shows "3 (60%)"
    And user-approved shows "1 (20%)"
    And rejected shows "1 (20%)"

  # --- Productivity Cards (JS-5) ---

  Scenario: Active time gauge shows user vs CLI split
    Given session "6e2a8c02" has accumulated active_time.total metrics: 750s user, 2715s cli
    When Phil views the Active Time card
    Then the user time shows "12m 30s"
    And the CLI time shows "45m 15s"
    And the total shows "57m 45s"
    And the percentage split shows approximately 22% user / 78% CLI

  Scenario: Productivity card shows lines of code changes
    Given session "6e2a8c02" has accumulated lines_of_code.count metrics: 247 added, 89 removed
    When Phil views the Productivity card
    Then lines added shows "+247"
    And lines removed shows "-89"
    And net change shows "+158"

  Scenario: Git activity shows commits and PRs
    Given session "6e2a8c02" has accumulated commit.count of 2 and pull_request.count of 0
    When Phil views the Productivity card
    Then commits shows "2"
    And pull requests shows "0"

  Scenario: Productivity cards show empty state when no metrics received
    Given session "no-metrics" has only log events and no metric data
    When Phil views the session dashboard
    Then the Active Time card shows "No data" with guidance about OTEL_METRICS_EXPORTER
    And the Productivity card shows "No data"

  # --- Model Name Normalization ---

  Scenario: Model names normalized between metrics and events
    Given session "6e2a8c02" has api_request events with model "claude-opus-4-6"
    And session "6e2a8c02" has cost.usage metrics with model "claude-opus-4-6[1m]"
    When Phil views the Cost & Tokens card
    Then both data sources are aggregated under "claude-opus-4-6"
    And the context window suffix "[1m]" is not displayed

  # --- Cross-Event Correlation ---

  Scenario: Events within same prompt are linkable via prompt.id
    Given session "6e2a8c02" has a user_prompt event with prompt.id "bacb8cf6"
    And session "6e2a8c02" has 2 api_request events with prompt.id "bacb8cf6"
    And session "6e2a8c02" has 3 tool_result events with prompt.id "bacb8cf6"
    When Phil views the session timeline
    Then the prompt, API calls, and tool results with prompt.id "bacb8cf6" are grouped together

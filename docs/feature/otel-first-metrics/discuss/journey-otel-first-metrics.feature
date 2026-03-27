Feature: OTel-First Metrics Pipeline
  As a Norbert user with OTel configured,
  session metrics should use OTel as the primary data source
  so that costs, tool stats, and health indicators are accurate.

  Background:
    Given Kai Nakamura has an active Claude Code session "norbert-refactor"
    And the session has OTel configured via Claude Code telemetry

  # ---- Step 1: Cost Single Source of Truth ----

  Scenario: OTel cost_usd used as single source when OTel active
    Given the session has received 3 api_request events with cost_usd values of $0.42, $1.15, and $0.83
    And the session has received 2 prompt_submit events with token usage data
    And the session has received 1 tool_call_end event with token usage data
    When the metrics aggregator processes all events
    Then sessionCost equals $2.40
    And the prompt_submit and tool_call_end token data is not added to sessionCost

  Scenario: Hook cost still works when OTel is not active
    Given a session "legacy-hooks" has no api_request events
    And the session has received a prompt_submit event with 1500 input tokens and 800 output tokens on model "claude-sonnet-4-20250514"
    When the metrics aggregator processes the event
    Then sessionCost is calculated via the pricing model
    And totalTokens equals 2300

  Scenario: OTel api_request without cost_usd falls back to pricing model
    Given the session has received an api_request event with 2000 input tokens and 1000 output tokens on model "claude-sonnet-4-20250514"
    And the api_request payload does not contain cost_usd
    When the metrics aggregator processes the event
    Then sessionCost is calculated via the pricing model as fallback
    And totalTokens equals 3000

  Scenario: Mixed session suppresses hook cost but keeps hook structure events
    Given the session is OTel-active (has received at least one api_request)
    And a session_start hook event arrives
    And an agent_complete hook event arrives with token usage data
    When the metrics aggregator processes both events
    Then activeAgentCount reflects the session_start and agent_complete
    But the agent_complete token usage data is not added to sessionCost

  Scenario: Mid-session OTel activation preserves pre-OTel cost
    Given Kai's session starts as hook-only
    And prompt_submit events have contributed $1.20 to sessionCost
    And the first api_request event arrives with cost_usd $0.55
    When subsequent prompt_submit events with token data arrive
    Then sessionCost equals $1.75 ($1.20 pre-OTel + $0.55 from api_request)
    And the subsequent prompt_submit token data is not added to sessionCost

  # ---- Step 2: Rich Tool Tracking ----

  Scenario: Tool call count from tool_result when OTel active
    Given the session has received 5 tool_result events
    And the tool_result events include: Read(success, 120ms), Write(success, 340ms), Bash(failure, 5200ms), Read(success, 95ms), Grep(success, 210ms)
    When the metrics aggregator processes all events
    Then toolCallCount equals 5
    And the tool usage summary shows 4 successes and 1 failure
    And the per-tool breakdown includes Bash with avgDurationMs of 5200 and successRate of 0

  Scenario: Tool call count from tool_call_start when hooks-only
    Given a session "hooks-only" has no api_request events
    And the session has received 3 tool_call_start events
    When the metrics aggregator processes all events
    Then toolCallCount equals 3

  Scenario: OTel active suppresses tool_call_start counting
    Given the session is OTel-active
    And the session has received 2 tool_result events and 2 tool_call_start events
    When the metrics aggregator processes all events
    Then toolCallCount equals 2
    And the count comes from tool_result events only

  # ---- Step 3: Error Visibility ----

  Scenario: API errors tracked when OTel provides api_error events
    Given the session has received 8 api_request events and 3 api_error events
    When the metrics aggregator processes all events
    Then apiErrorCount equals 3
    And apiErrorRate is approximately 0.27

  Scenario: No errors in a healthy session
    Given the session has received 12 api_request events and 0 api_error events
    When the metrics aggregator processes all events
    Then apiErrorCount equals 0
    And apiErrorRate equals 0

  Scenario: Error burst explains cost spike
    Given Kai's session "budget-check" has accumulated $3.20 in cost from 6 api_request events
    And 4 of those api_request events were retries following api_error events
    When Kai views the session metrics
    Then apiErrorCount shows 4 errors
    And the cost of $3.20 is explained by 6 total API calls including 4 retries

  # ---- Step 4: Source-Agnostic Data Health ----

  Scenario: Data health shows healthy when OTel events flowing
    Given the session has received 42 events (all via OTel: api_request, tool_result, api_error)
    And the most recent event arrived 5 seconds ago
    When the gauge cluster computes warning data
    Then dataHealth shows "healthy"
    And the health detail indicates "OTel active, 42 events"

  Scenario: Data health shows healthy when hook events flowing
    Given a session "hooks-session" has received 28 hook events
    And no api_request events exist (not OTel-active)
    And the most recent event arrived 10 seconds ago
    When the gauge cluster computes warning data
    Then dataHealth shows "healthy"

  Scenario: Data health shows degraded when events are stale
    Given the session has received 15 events
    And the most recent event arrived 90 seconds ago
    When the gauge cluster computes warning data
    Then dataHealth shows "degraded"

  Scenario: Data health shows no-data when no events received
    Given a new session "fresh-start" has just been created
    And no events have been received yet
    When the gauge cluster computes warning data
    Then dataHealth shows "no-data"

  # ---- Step 5: Transcript Legacy Path ----

  Scenario: Transcript polling skipped for OTel-active sessions
    Given the session is OTel-active
    And a transcript_path is available from the first hook event
    When the transcript polling interval fires
    Then no transcript usage request is made
    And session metrics come exclusively from OTel events

  Scenario: Transcript polling active for hook-only sessions
    Given a session "hooks-only" is not OTel-active
    And a transcript_path is available
    When the transcript polling interval fires
    Then transcript usage is fetched and fed as synthetic tool_call_end events

  # ---- Step 6: Session Timing ----

  Scenario: Session start time from first api_request when OTel active
    Given the session receives a session_start hook event at "2026-03-27T10:00:05Z"
    And the session receives its first api_request event at "2026-03-27T10:00:02Z"
    When the metrics aggregator processes both events
    Then sessionStartedAt equals "2026-03-27T10:00:02Z"

  Scenario: Session start time from session_start when hooks-only
    Given a session "hooks-only" receives a session_start event at "2026-03-27T10:00:05Z"
    And no api_request events arrive
    When the metrics aggregator processes the event
    Then sessionStartedAt equals "2026-03-27T10:00:05Z"

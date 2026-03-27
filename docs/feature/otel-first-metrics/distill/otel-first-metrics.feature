Feature: OTel-First Metrics Pipeline
  As a Norbert operator monitoring Claude Code sessions,
  when OTel telemetry is active the dashboard should use OTel as the
  primary data source so that costs, tool stats, error visibility,
  and data health indicators are accurate and trustworthy.

  # ===========================================================================
  # Walking Skeletons -- thin E2E slices proving user value
  # ===========================================================================

  @walking_skeleton
  Scenario: Operator sees accurate session cost when OTel is active
    Given a session has accumulated $1.20 from hook events before OTel activated
    And 3 API request events arrive with costs of $0.42, $1.15, and $0.83
    And 2 prompt submit events arrive with token usage data
    When the session metrics are computed
    Then the session cost is $3.60
    And the prompt submit token data does not contribute to the cost

  @walking_skeleton
  Scenario: Operator sees per-tool breakdown when OTel provides tool results
    Given a session is receiving OTel data
    And tool result events arrive for Read (success, 120ms), Bash (failure, 5200ms), and Grep (success, 210ms)
    When the session metrics are computed
    Then the tool call count is 3
    And the tool usage summary shows 2 successes out of 3 calls
    And the Bash tool shows a 0% success rate with average duration of 5200ms

  @walking_skeleton
  Scenario: Operator sees healthy data pipeline regardless of data source
    Given a session has received 42 events from OTel
    And the most recent event arrived 5 seconds ago
    When the data health indicator is computed
    Then the data health status is "healthy"

  # ===========================================================================
  # US-OFM-01: Cost Single Source of Truth
  # ===========================================================================

  Rule: When OTel is active, only API request cost_usd contributes to session cost

    Scenario: API request cost_usd values are summed as session cost
      Given a session is receiving OTel data
      And 3 API request events arrive with costs of $0.42, $1.15, and $0.83
      When the session metrics are computed
      Then the session cost is $2.40

    Scenario: Hook token events do not contribute to cost when OTel is active
      Given a session is receiving OTel data with a current cost of $1.00
      And a prompt submit event arrives with 1500 input and 800 output tokens
      When the session metrics are computed
      Then the session cost remains $1.00
      And the total tokens are not increased by the prompt submit data

    Scenario: Agent complete updates agent count but not cost when OTel is active
      Given a session is receiving OTel data with 1 active agent
      And an agent complete event arrives with 500 input and 200 output tokens
      When the session metrics are computed
      Then the active agent count is 0
      And the session cost is unchanged from the agent complete token data

    Scenario: Tool call end does not contribute to cost when OTel is active
      Given a session is receiving OTel data with a current cost of $2.50
      And a tool call end event arrives with token usage data
      When the session metrics are computed
      Then the session cost remains $2.50

  Rule: When OTel is not active, hook events contribute to cost as before

    Scenario: Hook-only session calculates cost via pricing model
      Given a session has no API request events
      And a prompt submit event arrives with 1500 input and 800 output tokens on "claude-sonnet-4-20250514"
      When the session metrics are computed
      Then the session cost is calculated from the pricing model
      And the total tokens equal 2300

    Scenario: Hook-only session counts tools from tool call start events
      Given a session has no API request events
      And 3 tool call start events arrive
      When the session metrics are computed
      Then the tool call count is 3

  Rule: API request without cost_usd falls back to pricing model

    Scenario: Missing cost_usd triggers pricing model fallback
      Given a session is receiving OTel data
      And an API request event arrives with 2000 input and 1000 output tokens on "claude-sonnet-4-20250514" without cost_usd
      When the session metrics are computed
      Then the session cost is calculated from the pricing model as fallback
      And the total tokens equal 3000

    Scenario: cost_usd of zero is treated as valid zero cost
      Given a session is receiving OTel data
      And an API request event arrives with 500 input and 100 output tokens with cost_usd of $0.00
      When the session metrics are computed
      Then the session cost is $0.00
      And the total tokens equal 600

  Rule: Mid-session OTel activation preserves pre-OTel accumulated cost

    Scenario: Pre-OTel cost preserved when first API request arrives
      Given a session has accumulated $1.20 from hook events
      And the first API request event arrives with cost_usd of $0.55
      When subsequent prompt submit events with token data arrive
      Then the session cost is $1.75
      And subsequent hook token data is not added to the cost

  @property
  Scenario: Session cost is never negative regardless of event sequence
    Given any valid sequence of hook and OTel events
    When the session metrics are computed after processing all events
    Then the session cost is greater than or equal to zero

  @property
  Scenario: OTel session cost equals sum of API request cost_usd values
    Given any OTel-active session with API request events containing cost_usd
    When the session metrics are computed
    Then the session cost equals the sum of all cost_usd values within $0.001 tolerance

  # ===========================================================================
  # US-OFM-02: Rich Tool Tracking from OTel
  # ===========================================================================

  Rule: When OTel is active, tool_result events are the source for tool counts

    Scenario: Tool result events increment tool call count
      Given a session is receiving OTel data
      And 5 tool result events arrive for Read, Write, Bash, Read, and Grep
      When the session metrics are computed
      Then the tool call count is 5

    Scenario: Tool call start events are ignored when OTel is active
      Given a session is receiving OTel data
      And 2 tool result events and 2 tool call start events arrive
      When the session metrics are computed
      Then the tool call count is 2

    Scenario: Per-tool breakdown includes success rate and average duration
      Given a session is receiving OTel data
      And tool result events arrive for Read (success, 120ms), Write (success, 340ms), Bash (failure, 5200ms), Read (success, 95ms), Grep (success, 210ms)
      When the session metrics are computed
      Then the per-tool breakdown shows Read with 2 calls and 100% success rate
      And the per-tool breakdown shows Bash with 1 call, 0% success rate, and 5200ms average duration

  Rule: When OTel is not active, tool_call_start is the source for tool counts

    Scenario: Tool call start events increment tool count in hook-only session
      Given a session has no API request events
      And 4 tool call start events arrive
      When the session metrics are computed
      Then the tool call count is 4

  @property
  Scenario: Tool call count matches the number of tool result events when OTel active
    Given any OTel-active session with tool result events
    When the session metrics are computed
    Then the tool call count equals the number of tool result events processed

  # ===========================================================================
  # US-OFM-03: API Error Visibility
  # ===========================================================================

  Rule: API error events are tracked for error visibility

    Scenario: API errors increment error count
      Given a session has received 8 API request events
      And 3 API error events arrive
      When the session metrics are computed
      Then the API error count is 3
      And the API error rate is approximately 0.27

    Scenario: Healthy session shows zero errors
      Given a session has received 12 API request events
      And no API error events arrive
      When the session metrics are computed
      Then the API error count is 0
      And the API error rate is 0

  Rule: Error rate handles edge cases gracefully

    Scenario: Error rate is zero when no API interactions have occurred
      Given a new session with no events
      When the session metrics are computed
      Then the API error count is 0
      And the API error rate is 0

    Scenario: API error events update common tracking fields
      Given a session has received 5 events
      And an API error event arrives at "2026-03-27T10:05:00Z"
      When the session metrics are computed
      Then the total event count is 6
      And the last event timestamp is "2026-03-27T10:05:00Z"

  @property
  Scenario: API error rate is always between 0 and 1 when requests exceed errors
    Given any session where API request count exceeds API error count
    When the API error rate is calculated
    Then the rate is between 0.0 and 1.0 inclusive

  # ===========================================================================
  # US-OFM-04: Source-Agnostic Data Health Indicator
  # ===========================================================================

  Rule: Data health considers total event count and recency regardless of source

    Scenario: Healthy when hook events are flowing
      Given a hook-only session has received 28 events
      And the most recent event arrived 10 seconds ago
      When the data health indicator is computed
      Then the data health status is "healthy"

    Scenario: Degraded when events are stale
      Given a session has received 15 events
      And the most recent event arrived 90 seconds ago
      When the data health indicator is computed
      Then the data health status is "degraded"

    Scenario: No data when no events have been received
      Given a new session has been created with no events
      When the data health indicator is computed
      Then the data health status is "no-data"

  Rule: Staleness threshold determines healthy vs degraded boundary

    Scenario: Events arriving just within threshold show healthy
      Given a session has received 10 events
      And the most recent event arrived 59 seconds ago
      When the data health indicator is computed with a 60-second threshold
      Then the data health status is "healthy"

    Scenario: Events arriving just beyond threshold show degraded
      Given a session has received 10 events
      And the most recent event arrived 61 seconds ago
      When the data health indicator is computed with a 60-second threshold
      Then the data health status is "degraded"

  # ===========================================================================
  # US-OFM-05: OTel Session Timing Preference
  # ===========================================================================

  Rule: When OTel is active, first API request timestamp sets session start

    Scenario: First API request sets session start time
      Given a session receives a session start event at "2026-03-27T10:00:05Z"
      And then receives its first API request event at "2026-03-27T10:00:02Z"
      When the session metrics are computed
      Then the session started at "2026-03-27T10:00:02Z"

    Scenario: API request arriving before session start preserves earlier timestamp
      Given a session receives an API request event at "2026-03-27T10:00:02Z"
      And then receives a session start event at "2026-03-27T10:00:05Z"
      When the session metrics are computed
      Then the session started at "2026-03-27T10:00:02Z"

  Rule: When OTel is not active, session start hook sets the timestamp

    Scenario: Hook-only session uses session start timestamp
      Given a session receives a session start event at "2026-03-27T10:00:05Z"
      And no API request events arrive
      When the session metrics are computed
      Then the session started at "2026-03-27T10:00:05Z"

    Scenario: Second session start does not overwrite the first timestamp
      Given a session receives a session start event at "2026-03-27T10:00:05Z"
      And then receives another session start event at "2026-03-27T10:00:15Z"
      When the session metrics are computed
      Then the session started at "2026-03-27T10:00:05Z"

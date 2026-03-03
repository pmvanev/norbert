@skip @US-002 @JS-2 @JS-3
Feature: Event Capture Pipeline -- All Hook Types with MCP Attribution

  As a Claude Code power user running multi-agent workflows with MCP servers,
  I want all relevant event types captured with full attribution,
  so downstream features like trace graphs, cost waterfalls, and MCP health can function.

  Background:
    Given Norbert is initialized and the server is running

  # ===================================================================
  # Walking Skeleton: Complete multi-agent session capture
  # ===================================================================

  @walking_skeleton
  Scenario: Multi-agent session with MCP calls fully captured
    Given Rafael runs an 8-agent workflow with MCP tool calls to github and sentry
    When the session completes
    Then Norbert has captured session start and stop events
    And Norbert has captured subagent start and stop events for all 8 agents
    And Norbert has captured tool call events for both built-in and MCP tools
    And each event includes a session identifier and timestamp

  # ===================================================================
  # Happy Path: Hook type coverage
  # ===================================================================

  Scenario: All seven hook event types are captured from a session
    Given a session produces all seven event types
    When Norbert processes the events
    Then session start and stop events are stored
    And tool call start, success, and failure events are stored
    And subagent start and stop events are stored
    And each event has the correct event type classification

  Scenario: MCP tool calls include server and tool attribution
    Given a session includes tool calls to the github MCP server
    And the github server provides tools named "get_file" and "search_code"
    When Norbert captures the tool call events
    Then each MCP tool call event includes the MCP server name "github"
    And each MCP tool call event includes the specific tool name

  Scenario: Built-in tool calls stored without MCP attribution
    Given a session uses the built-in Read tool to access a local file
    When the tool call event is captured
    Then the event is stored with the tool name "Read"
    And the MCP server field is empty
    And all other fields including timestamp and session are populated

  # ===================================================================
  # Agent Relationships
  # ===================================================================

  Scenario: Parent-child agent relationships captured for trace construction
    Given main-orchestrator spawns code-analyzer as a subagent
    And code-analyzer spawns validation-helper as a nested subagent
    When Norbert captures the subagent lifecycle events
    Then code-analyzer's start event references main-orchestrator as parent
    And validation-helper's start event references code-analyzer as parent
    And the parent-child chain is queryable for trace graph construction

  Scenario: Single-agent session stores root agent without parent reference
    Given a simple session with only one agent and no subagents
    When the session events are captured
    Then the root agent has no parent reference
    And tool call events are correctly attributed to the single agent

  # ===================================================================
  # Token and Cost Data
  # ===================================================================

  Scenario: Token usage data extracted from completed tool calls
    Given a tool call completes with 1,250 input tokens and 340 output tokens
    When the tool call completion event is captured
    Then the event stores 1,250 as the input token count
    And the event stores 340 as the output token count

  Scenario: Session aggregates update incrementally with each event
    Given a session has accumulated 10,000 tokens across 5 events
    When a 6th event arrives with 2,500 additional tokens
    Then the session total tokens reflects 12,500
    And the session event count reflects 6

  # ===================================================================
  # Error and Resilience Scenarios
  # ===================================================================

  @error
  Scenario: Events during server downtime are lost without corruption
    Given events are being captured from an active session
    When the Norbert server restarts and 3 events fire while unreachable
    Then those 3 events are not stored
    And events captured after server recovery are stored correctly
    And the database remains consistent with no corrupted entries

  @error
  Scenario: Malformed event payloads are rejected gracefully
    Given a hook sends an event with missing required fields
    When the event arrives at the server
    Then the malformed event is rejected
    And previously stored events are unaffected
    And the server continues accepting valid events

  @error
  Scenario: Unknown event fields are preserved for forward compatibility
    Given a hook sends an event with a new field "context_tokens" not in the current schema
    When the event is captured
    Then the known fields are stored in structured columns
    And the complete original payload including "context_tokens" is preserved

  @property
  Scenario: Event ordering in storage matches timestamp ordering
    Given any sequence of events arriving at the server
    When the events are stored
    Then retrieving events by storage order matches their timestamp order

@skip @US-006 @JS-1
Feature: Token Cost Waterfall -- Per-Agent and Per-Tool Cost Attribution

  As a Claude Code power user who just ran an expensive session,
  I want to see exactly which agent and tool call consumed the most tokens,
  so I can identify waste points and restructure my workflow to reduce costs.

  Background:
    Given Norbert is running with session cost data captured

  # ===================================================================
  # Walking Skeleton: Cost waterfall identifies the expensive agent
  # ===================================================================

  @walking_skeleton
  Scenario: Cost waterfall reveals the most expensive agent in a session
    Given session 4 had 4 agents totaling 67,234 tokens and $2.02
    And file-migrator consumed 42,100 input tokens and 8,200 output tokens costing $1.08
    When Rafael views the token cost waterfall for session 4
    Then agents are listed in descending cost order
    And file-migrator appears first with $1.08 and 53% of session cost
    And the waterfall shows both input and output token counts per agent

  # ===================================================================
  # Per-Tool-Call Detail
  # ===================================================================

  Scenario: Expanding an agent shows per-tool-call token breakdown
    Given file-migrator made 14 Read calls and 6 Write calls
    When Rafael expands the file-migrator entry in the waterfall
    Then he sees individual tool calls with tool name, target, and token count
    And the 14 Read calls to the same file are grouped with a total

  Scenario: Tool calls sorted by token consumption within agent
    Given file-migrator's Read calls consumed 28,000 tokens and Write calls consumed 14,100 tokens
    When Rafael expands file-migrator's tool call detail
    Then Read calls appear first as the highest cost tool type
    And the total for each tool type is visible

  # ===================================================================
  # MCP Attribution
  # ===================================================================

  Scenario: MCP tool calls attributed to their originating server
    Given Priya's session includes github:get_file called 23 times and sentry:get_issues called 8 times
    When Priya views the cost waterfall
    Then MCP tool calls display in "server:tool_name" format
    And github tool calls show an aggregate cost of $0.34
    And sentry tool calls show an aggregate cost of $0.12

  Scenario: Built-in and MCP tool costs distinguished in waterfall
    Given an agent made both built-in Read calls and MCP github:get_file calls
    When viewing the agent's tool call breakdown
    Then built-in tools show without server prefix
    And MCP tools show with their server name prefix
    And both types contribute to the agent's total cost

  # ===================================================================
  # Cost Estimation
  # ===================================================================

  Scenario: Cost estimation footnote manages expectations
    Given the waterfall displays estimated costs based on published model pricing
    When Rafael views the waterfall
    Then a footnote explains the cost estimation methodology
    And states that actual billing may differ due to caching and rate changes

  @property
  Scenario: Agent costs sum to approximately session total
    Given any session with multiple agents and token usage data
    When the cost waterfall is computed
    Then the sum of all agent costs is within 5% of the session total cost

  # ===================================================================
  # Error and Edge Cases
  # ===================================================================

  @error
  Scenario: Session with no token data shows informative message
    Given a session where token counts were not available in hook events
    When Rafael views the cost waterfall
    Then a message explains that token data is unavailable for this session
    And suggests checking that the hook configuration captures token fields

  @edge
  Scenario: Single-agent session shows direct cost breakdown
    Given a session with only one agent and 12 tool calls
    When Rafael views the cost waterfall
    Then the single agent shows 100% of session cost
    And tool calls are listed directly without needing to expand

  # ===================================================================
  # CLI Parity
  # ===================================================================

  Scenario: CLI cost output matches dashboard waterfall data
    Given session 4 has a known cost breakdown
    When Rafael views costs via command line
    And Rafael views costs via the dashboard waterfall
    Then both show the same agent ordering and cost values
    And both show the same total session cost

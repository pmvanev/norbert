@skip @US-004 @JS-2
Feature: Execution Trace Graph -- Visual Agent Topology per Session

  As a framework developer debugging a multi-agent workflow failure,
  I want to see a visual execution graph showing which agents ran and where the chain broke,
  so I can trace the root cause to a specific agent without re-running the entire workflow.

  Background:
    Given Norbert is running with captured multi-agent session data

  # ===================================================================
  # Walking Skeleton: Trace graph renders agent topology
  # ===================================================================

  @walking_skeleton
  Scenario: Execution graph shows multi-agent delegation chain
    Given session 4 had main-orchestrator delegating to code-analyzer, file-migrator, and test-runner
    When Priya opens the session 4 detail page
    Then the execution graph shows main-orchestrator as the root node
    And code-analyzer, file-migrator, and test-runner appear as child nodes
    And each node displays agent name, token cost, and tool call count

  # ===================================================================
  # Node Detail and Expansion
  # ===================================================================

  Scenario: Expanding an agent node reveals individual tool calls
    Given file-migrator made 14 Read calls and 6 Write calls in session 4
    When Priya expands the file-migrator node
    Then she sees a list of 20 tool calls with tool name, target file, and timestamp
    And the 14 Read calls to the same file are grouped with a count indicator

  Scenario: Nested subagent relationships rendered correctly
    Given file-migrator spawned a validation-helper subagent
    And validation-helper made 3 tool calls
    When Priya views the execution graph
    Then validation-helper appears as a child of file-migrator
    And expanding validation-helper shows its 3 tool calls

  # ===================================================================
  # Simplified Views
  # ===================================================================

  @edge
  Scenario: Single-agent session shows simplified clean view
    Given session 5 had only a single agent with 12 tool calls
    When Rafael opens the session 5 detail page
    Then the execution graph shows a single node with no children
    And tool calls are listed directly without needing to expand
    And the layout adapts cleanly to the simple structure

  # ===================================================================
  # Error Indicators
  # ===================================================================

  @error
  Scenario: Failed agent shows error indicator with impact details
    Given test-runner failed at the 4th tool call in session 4
    And 3 tool calls succeeded before the failure
    When Priya views the execution graph
    Then test-runner node shows a failure indicator
    And expanding the node shows 3 successful calls and 1 failed call with error output
    And no downstream agents were spawned after the failure

  @error
  Scenario: MCP tool call failure visible within agent node
    Given code-analyzer made an MCP call to sentry that timed out
    When Priya expands the code-analyzer node
    Then the failed sentry tool call shows a timeout indicator
    And the MCP server name "sentry" is visible on the failed call

  # ===================================================================
  # Performance and Scale
  # ===================================================================

  @edge
  Scenario: Execution graph renders within performance target for complex sessions
    Given a session with 20 agents and 200 tool calls
    When the execution graph loads
    Then the graph renders completely in under 3 seconds

  # ===================================================================
  # CLI Parity
  # ===================================================================

  Scenario: CLI trace output matches dashboard execution graph structure
    Given session 4 has a known agent topology
    When Priya views the trace via command line
    And Priya views the trace via the dashboard
    Then both show the same root agent and child relationships
    And both show the same tool call counts per agent

  # ===================================================================
  # Redundancy Detection
  # ===================================================================

  Scenario: Repeated tool calls to same target show redundancy indicator
    Given file-migrator read src/models/user.ts 14 times in session 4
    When Priya views file-migrator's tool calls
    Then the 14 Read calls to the same file are grouped together
    And a redundancy indicator highlights the repetition
    And the cost impact of the redundant calls is displayed

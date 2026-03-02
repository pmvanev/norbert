Feature: Norbert Observatory -- Observe, Understand, and Optimize Agentic Claude Code Workflows

  As a Claude Code power user running multi-agent workflows with MCP servers,
  I want an observatory that captures, visualizes, and helps me diagnose my workflow behavior,
  so I can optimize costs, debug failures, and maintain healthy MCP connections.

  Background:
    Given Norbert v0.1.0 is installed via "npm install -g norbert"
    And Claude Code is configured in the current project

  # ===================================================================
  # Step 1: Install and Configure
  # Job Story: Walking Skeleton Validation (JS-7)
  # ===================================================================

  @walking-skeleton @setup
  Scenario: First-time initialization creates complete capture pipeline
    Given Rafael Oliveira has not previously configured Norbert
    When Rafael runs "norbert init"
    Then Norbert adds 7 hook entries to .claude/settings.json
    And Norbert creates a SQLite database at ~/.norbert/norbert.db
    And Norbert starts a background server on localhost:7890
    And Rafael sees a "Ready" message with quick-start commands
    And the entire initialization completes in under 30 seconds

  @walking-skeleton @setup
  Scenario: Initialization does not disrupt existing Claude Code hooks
    Given Rafael has 3 existing custom hooks in .claude/settings.json
    When Rafael runs "norbert init"
    Then Norbert appends its hooks without modifying existing hook entries
    And Rafael's 3 custom hooks remain unchanged
    And both Norbert hooks and custom hooks can fire independently

  @setup @error
  Scenario: Initialization fails gracefully when server port is occupied
    Given another process is already listening on port 7890
    When Rafael runs "norbert init"
    Then Norbert reports "Port 7890 is in use"
    And suggests "Try: norbert init --port 7891"
    And does not partially configure hooks without a running server

  # ===================================================================
  # Step 2: Verify First Event Capture
  # Job Story: Walking Skeleton Validation (JS-7)
  # ===================================================================

  @walking-skeleton @verification
  Scenario: First captured event confirms end-to-end pipeline
    Given Rafael has initialized Norbert
    And Rafael runs a Claude Code command that triggers a tool call
    When Rafael runs "norbert status"
    Then "Events captured" shows a number greater than 0
    And "Sessions observed" shows at least 1
    And "Last event" shows the tool name and time elapsed
    And all hook types show "active" status

  @verification @error
  Scenario: Zero events guides user to troubleshooting
    Given Rafael has initialized Norbert
    But no Claude Code commands have been run since initialization
    When Rafael runs "norbert status"
    Then "Events captured" shows 0
    And Norbert displays "No events captured yet"
    And suggests "Run any Claude Code command, then check again"
    And does not show an error or failure state

  # ===================================================================
  # Step 3: Dashboard Overview
  # Job Story: Session History (JS-6), Context Pressure (JS-5), MCP Health (JS-3)
  # ===================================================================

  @dashboard @overview
  Scenario: Dashboard overview shows today's summary with all key metrics
    Given Rafael has completed 6 Claude Code sessions today totaling 142,847 tokens
    And 4 MCP servers are connected (github, sentry, postgres, omni-search)
    When Rafael opens the Norbert dashboard at http://localhost:7890
    Then he sees "Sessions: 6" and "Total Tokens: 142,847"
    And he sees an estimated cost of approximately $4.28
    And he sees all 4 MCP servers listed with connection status
    And the dashboard loads in under 2 seconds

  @dashboard @context-pressure
  Scenario: Context window pressure gauge shows composition breakdown
    Given the current Claude Code session has consumed 144,000 of 200,000 context tokens
    And the breakdown is system: 24,000 | CLAUDE.md: 16,000 | MCP tools: 36,000 | history: 68,000
    When Rafael views the context pressure gauge on the dashboard
    Then the gauge shows 72% utilization with composition bands
    And the system band shows 12%, CLAUDE.md shows 8%, MCP tools shows 18%, history shows 34%
    And the gauge displays "MODERATE" status (warning threshold at 85%)

  @dashboard @context-pressure @property
  Scenario: Context pressure gauge updates as session progresses
    Given Rafael has an active Claude Code session
    Then the context pressure gauge reflects current utilization within 5 seconds of each tool call
    And the gauge color transitions from green (<70%) to amber (70-85%) to red (>85%)

  @dashboard @mcp-health
  Scenario: MCP server health table shows per-server token overhead
    Given Rafael has 4 MCP servers connected
    And omni-search has 20 tools consuming 14,214 tokens of tool description overhead
    When Rafael views the MCP Server Health table
    Then each server shows connection status, call count, error count, and token overhead
    And omni-search is highlighted with "(!) " indicating high overhead
    And the total MCP token overhead is displayed as "24,314 tokens (12% of context)"

  @dashboard @empty-state
  Scenario: Dashboard shows helpful empty state on first visit with no data
    Given Rafael has just initialized Norbert but has not run any Claude Code commands
    When Rafael opens the dashboard
    Then he sees "No sessions captured yet"
    And a guide explains "Run any Claude Code command and data will appear here"
    And the MCP health section shows "Waiting for first MCP server event..."

  # ===================================================================
  # Step 4: Diagnose -- Session Detail
  # Job Story: Cost Spike Diagnosis (JS-1), Agent Trace Debugging (JS-2), MCP Health (JS-3)
  # ===================================================================

  @diagnosis @cost
  Scenario: Token cost waterfall identifies the most expensive agent
    Given session #4 ran 8 agents totaling 67,234 tokens and $2.02
    And file-migrator consumed 42,100 input tokens and 8,200 output tokens ($1.08)
    When Rafael opens the session #4 detail page
    Then the token cost waterfall lists agents sorted by cost descending
    And file-migrator appears first with $1.08 (53% of session cost)
    And the waterfall shows input and output token breakdown per agent

  @diagnosis @trace
  Scenario: Execution trace graph shows agent delegation chain
    Given session #4 had main-orchestrator delegating to code-analyzer, file-migrator, and test-runner
    And file-migrator made 14 Read calls to src/models/user.ts
    When Rafael views the execution graph for session #4
    Then the DAG shows main-orchestrator as root with 3 child agents
    And file-migrator node shows "14x Read -- src/models/user.ts" with a redundancy indicator
    And each node displays its token cost and tool call count

  @diagnosis @mcp-error
  Scenario: MCP error timeline shows progressive latency degradation
    Given sentry MCP server in session #4 showed latencies of 1.2s, 3.8s, then timeout at 30s
    And the timeout occurred at 12:04:02
    And 3 subsequent sentry tool calls were skipped after the failure
    When Rafael clicks on the sentry error in the MCP error timeline
    Then he sees the chronological event list with timestamps and latencies
    And the latency trend visualization shows 1.2s --> 3.8s --> TIMEOUT
    And the impact note states "3 subsequent tool calls to sentry skipped"
    And a recommendation suggests checking server process health

  @diagnosis @mcp-token
  Scenario: MCP token overhead analyzer attributes cost per server
    Given Priya Chakraborty has 7 MCP servers connected
    And mcp-omnisearch consumes 14,214 tokens with 20 tool descriptions
    And the total MCP overhead is 67,000+ tokens across all servers
    When Priya opens the MCP token overhead analyzer
    Then servers are ranked by token overhead descending
    And mcp-omnisearch appears first with 14,214 tokens and 20 tools
    And the analyzer shows both raw overhead and Tool Search-optimized overhead
    And a recommendation suggests reducing tool count on high-overhead servers

  @diagnosis @insight
  Scenario: Dashboard surfaces actionable insights from session data
    Given file-migrator read the same file 14 times in session #4
    When the session detail page loads
    Then an insight callout states "file-migrator read src/models/user.ts 14 times"
    And the insight explains "This single file accounted for 53% of session cost"
    And a suggestion says "Consider restructuring the prompt to cache file contents"

  # ===================================================================
  # Step 5: Act -- Validate Optimization
  # Job Story: Cost Spike Diagnosis (JS-1)
  # ===================================================================

  @optimization @comparison
  Scenario: Cost comparison validates workflow optimization
    Given Rafael restructured his file-migrator prompt to reduce redundant reads
    And session #4 (before) had: 67,234 tokens, $2.02 cost, 14 file reads, 1 MCP error
    And session #7 (after) had: 31,200 tokens, $0.94 cost, 3 file reads, 0 MCP errors
    When Rafael runs "norbert cost --last --compare"
    Then he sees total tokens decreased by 54%
    And total cost decreased by 53% (from $2.02 to $0.94)
    And file-migrator tokens decreased by 71%
    And projected monthly savings are approximately $97

  @optimization @comparison @cli
  Scenario: CLI trace comparison shows structural changes
    Given Rafael runs "norbert trace --last --compare"
    Then the output shows agent topology differences between the two sessions
    And highlights reduced tool call count for file-migrator (14 --> 3)

  # ===================================================================
  # Step 6: Review -- Historical Analysis
  # Job Story: Session History (JS-6)
  # ===================================================================

  @review @history
  Scenario: Weekly review shows cost trends and baselines
    Given Rafael has used Norbert for 7 days with 42 sessions
    And total weekly cost is $28.40 with a daily average of $4.06
    When Rafael opens the weekly review page
    Then he sees a daily cost trend chart for the past 7 days
    And the chart shows a spike on Tuesday ($6.20) and steady decline after optimization
    And established baselines show average session cost of $0.68 and P95 of $2.10

  @review @mcp
  Scenario: MCP health summary reveals recurring server issues
    Given sentry MCP server had 3 errors across the week with 94.2% uptime
    And all other servers had 99%+ uptime
    When Rafael views the MCP health summary
    Then sentry is highlighted as the least reliable server
    And the error pattern shows intermittent timeouts during peak hours
    And a suggestion recommends investigating sentry server resource allocation

  @review @team
  Scenario: Team lead exports usage data for budget planning
    Given Marcus Chen has 4 weeks of Norbert data across 4 developers
    When Marcus clicks "Export CSV" on the monthly review page
    Then a CSV file downloads with columns: date, developer, session_count, total_tokens, cost
    And the data matches what is displayed in the dashboard tables

  # ===================================================================
  # Cross-Cutting: Error Handling and Resilience
  # ===================================================================

  @error @resilience
  Scenario: Norbert server crash does not affect Claude Code
    Given Norbert background server crashes unexpectedly
    When Rafael continues working in Claude Code
    Then Claude Code continues operating normally
    And hook scripts fail silently (non-blocking)
    And no data is captured until Norbert is restarted
    And Rafael can restart with "norbert serve" without data loss

  @error @resilience
  Scenario: Database corruption triggers recovery
    Given the Norbert SQLite database becomes corrupted
    When Rafael runs "norbert status"
    Then Norbert detects the corruption
    And suggests "norbert db repair" or "norbert db reset"
    And existing data is backed up before any repair attempt

  # ===================================================================
  # Cross-Cutting: CLI Output Modes
  # ===================================================================

  @cli @output
  Scenario: JSON output mode for scripting
    Given Rafael wants to pipe Norbert data to jq
    When Rafael runs "norbert cost --last --json"
    Then output is valid JSON matching the documented schema
    And the JSON includes all fields shown in the human-readable output
    And the JSON schema is treated as a versioned API contract

  @cli @accessibility
  Scenario: No-color mode for accessibility
    Given Rafael sets the NO_COLOR environment variable
    When Rafael runs any Norbert CLI command
    Then all output is rendered without ANSI color codes
    And information previously conveyed by color is conveyed by text labels or symbols

  # ===================================================================
  # Properties (Ongoing Qualities)
  # ===================================================================

  @property @performance
  Scenario: Hook processing does not add latency to Claude Code
    Given Norbert hooks are configured as async HTTP POST
    Then each hook fires and returns within 50ms
    And Claude Code tool execution is not blocked waiting for Norbert
    And hook failures do not cause Claude Code tool call failures

  @property @data-integrity
  Scenario: All captured events are persisted without loss
    Given Norbert server is running and receiving hook events
    Then every hook event received is written to SQLite within 1 second
    And no events are dropped under normal operation (< 100 events/minute)
    And event ordering in the database matches event timestamp ordering

  @property @storage
  Scenario: Database growth remains manageable
    Given Norbert captures approximately 50 events per session
    And Rafael runs 10 sessions per day
    Then database growth is approximately 500 KB per day
    And 30 days of data occupies less than 20 MB
    And the default retention policy purges data older than 30 days (free tier)

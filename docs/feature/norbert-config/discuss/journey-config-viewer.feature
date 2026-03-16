Feature: Configuration Viewer
  As a Claude Code user who has agents, hooks, skills, rules, MCP servers,
  plugins, and CLAUDE.md files configured in .claude/,
  I want to see all my configuration in one organized viewer
  so I can understand, verify, and discover my Claude Code setup.

  Background:
    Given Ravi Patel has Norbert open with the norbert-config plugin loaded
    And the .claude/ directory exists in the user's home directory

  # --- Step 1: Navigation ---

  Scenario: Navigate to Configuration tab
    When Ravi clicks the Config tab in the sidebar
    Then the Configuration Viewer appears in the main content area
    And 7 sub-tabs are visible: Agents, Hooks, Skills, Rules, MCP, Plugins, Docs
    And the Agents tab is selected by default

  Scenario: Configuration tab loads without active Claude Code session
    Given no Claude Code session is currently running
    When Ravi clicks the Config tab
    Then the Configuration Viewer loads successfully
    And all tabs display configuration data from the filesystem

  # --- Step 2: Agents Tab ---

  Scenario: Agents tab lists configured agents with key metadata
    Given Ravi has 3 agent definitions in .claude/agents/:
      | filename                              | model   | tools |
      | nw-functional-software-crafter.md     | opus-4  | 12    |
      | nw-product-owner.md                   | opus-4  | 8     |
      | nw-solution-architect.md              | opus-4  | 10    |
    When Ravi views the Agents tab
    Then 3 agent cards appear
    And the "nw-functional-software-crafter" card shows model "opus-4" and 12 tools
    And each card includes a description preview from the agent file

  Scenario: Agent card expands to show full details
    Given Ravi sees the agent card for "nw-product-owner"
    When Ravi clicks the card
    Then the card expands to show the full agent definition
    And the system prompt is shown with a preview and expand control
    And the source file path ".claude/agents/nw-product-owner.md" is displayed

  # --- Step 3: Hooks Tab ---

  Scenario: Hooks tab shows hook event bindings from settings.json
    Given Ravi has hooks configured in .claude/settings.json:
      | event        | command                          | matchers              |
      | PreToolUse   | /usr/local/bin/norbert-hook      | Bash, Write, Edit     |
      | PostToolUse  | /usr/local/bin/norbert-hook      | Bash, Write, Edit     |
      | Notification | /usr/local/bin/norbert-hook      | (none)                |
    When Ravi views the Hooks tab
    Then 3 hook cards appear
    And the "PreToolUse" card shows command "/usr/local/bin/norbert-hook"
    And the "PreToolUse" card shows matchers "Bash, Write, Edit"
    And the "Notification" card shows no matchers

  # --- Step 4: Skills Tab ---

  Scenario: Skills tab lists available commands
    Given Ravi has skill files in .claude/commands/:
      | filename           | description                     |
      | deploy.md          | Deploy application to staging   |
      | review-pr.md       | Review a pull request           |
    When Ravi views the Skills tab
    Then 2 skill entries appear
    And the "deploy" entry shows description "Deploy application to staging"

  # --- Step 5: Rules Tab ---

  Scenario: Rules tab aggregates rules from multiple sources
    Given Ravi has 3 rules in .claude/settings.json
    And CLAUDE.md contains 2 additional rules
    When Ravi views the Rules tab
    Then 5 rule entries appear
    And each entry shows the rule text and its source file

  # --- Step 6: MCP Servers Tab ---

  Scenario: MCP tab shows server connection details
    Given Ravi has MCP servers configured in .claude/settings.json:
      | name              | type   | command                         |
      | filesystem-server | stdio  | npx @anthropic/mcp-filesystem   |
      | github-server     | stdio  | npx @anthropic/mcp-github       |
    When Ravi views the MCP Servers tab
    Then 2 server cards appear
    And the "filesystem-server" card shows type "stdio" and the command
    And the "github-server" card shows environment variables with values masked

  Scenario: MCP server env var values revealed on click
    Given Ravi sees the "github-server" card with GITHUB_TOKEN masked as "****"
    When Ravi clicks the masked value
    Then the full environment variable value is revealed
    And clicking again re-masks the value

  # --- Step 7: Plugins Tab ---

  Scenario: Plugins tab lists installed Claude Code plugins
    Given Ravi has 2 Claude Code plugins installed
    When Ravi views the Plugins tab
    Then 2 plugin entries appear with name and version

  # --- Step 8: Docs Tab ---

  Scenario: Docs tab renders CLAUDE.md with Markdown formatting
    Given a CLAUDE.md file exists at the project root with heading "# Norbert"
    And a .claude/CLAUDE.md file exists with heading "# Memory Index"
    When Ravi views the Docs tab
    Then 2 content panels appear
    And the first panel shows "./CLAUDE.md" content with formatted headings
    And the second panel shows ".claude/CLAUDE.md" content with formatted headings

  # --- Error Paths ---

  Scenario: No .claude/ directory found
    Given the .claude/ directory does not exist
    When Ravi opens the Configuration Viewer
    Then an empty state message explains that no .claude/ directory was found
    And the message includes guidance on how to create one

  Scenario: Empty tab shows helpful explanation
    Given Ravi has no agent definitions in .claude/agents/
    When Ravi views the Agents tab
    Then an empty state explains what agents are
    And the message describes where to create agent definition files

  Scenario: Malformed settings.json shows parse error
    Given .claude/settings.json contains invalid JSON
    When Ravi views the Hooks tab
    Then a parse error message appears explaining the JSON is invalid
    And the error indicates the location of the problem

  Scenario: Individual file read error does not break the tab
    Given Ravi has 3 agent files but one has unreadable permissions
    When Ravi views the Agents tab
    Then 2 agent cards appear for the readable files
    And an error indicator appears for the unreadable file
    And the error shows the file path and describes the problem

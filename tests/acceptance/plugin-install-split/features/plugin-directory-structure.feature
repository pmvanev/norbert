Feature: Plugin directory structure for Claude marketplace
  As a Claude Code user who wants to connect Norbert,
  I want the plugin directory to contain valid, correctly structured files,
  so that Claude's plugin framework can discover and install the Norbert integration.

  # --- Walking Skeleton ---

  @walking_skeleton
  Scenario: Plugin package contains all required files for marketplace discovery
    Given the Norbert plugin directory exists in the repository
    When a marketplace consumer inspects the plugin package
    Then the plugin manifest is present with the name "norbert"
    And hook definitions are present for all 6 event types
    And the MCP server definition is present for "norbert"

  # --- Plugin Manifest ---

  Scenario: Plugin manifest contains required metadata
    Given the plugin manifest file exists
    When its content is inspected
    Then the plugin name is "norbert"
    And the plugin description is "Local-first observability for Claude Code sessions"
    And the plugin version is present and non-empty

  Scenario: Plugin manifest version matches the app version
    Given the plugin manifest declares a version
    And the app declares a version in its package configuration
    When the two versions are compared
    Then they are identical

  # --- Hook Definitions ---

  Scenario: Hook definitions specify exactly 6 event types
    Given the hooks definition file exists
    When the hook entries are counted
    Then there are exactly 6 hook entries

  Scenario: Each hook entry is configured for non-blocking delivery
    Given the hooks definition file exists
    When each hook entry is inspected
    Then every hook is marked as asynchronous
    And every hook type is "http"

  Scenario: Hook URLs point to the correct receiver port
    Given the hooks definition file exists
    And the app receiver listens on port 3748
    When each hook URL is inspected
    Then every hook URL targets localhost on port 3748

  Scenario: Hook event names match the app's recognized event types
    Given the hooks definition file lists event type names
    And the app recognizes event types PreToolUse, PostToolUse, SubagentStop, Stop, SessionStart, and UserPromptSubmit
    When the two lists are compared
    Then they contain exactly the same 6 event names

  @property
  Scenario: Every hook URL is parseable back to a recognized event type
    Given any hook entry from the hooks definition file
    When the event name is extracted from its URL path
    Then the extracted name is recognized as a valid event type by the app

  # --- MCP Server ---

  Scenario: MCP configuration defines the norbert server
    Given the MCP configuration file exists
    When its content is inspected
    Then a server named "norbert" is defined
    And its transport type is "stdio"
    And its command is "norbert-cc" with arguments ["mcp"]

  # --- Error/Edge Cases ---

  Scenario: Hook definition file rejects unknown event type names
    Given the app recognizes exactly 6 event types
    When a hook URL contains an unrecognized event name like "UnknownEvent"
    Then the app would not route that event to any handler

  Scenario: Plugin files contain no dynamic or templated values
    Given the plugin manifest, hooks definition, and MCP configuration files exist
    When their contents are inspected
    Then all values are static literals with no placeholder tokens or environment variables

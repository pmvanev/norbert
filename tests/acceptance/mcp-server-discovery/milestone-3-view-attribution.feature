Feature: Milestone 3 -- View displays source origin in MCP server cards
  The MCP tab renders source attribution on each server card so users can
  identify which configuration file defines each server, and the empty state
  message references all configuration locations.

  Background:
    Given the user has the Configuration Viewer open on the MCP tab

  # --- Happy path scenarios ---

  @skip
  Scenario: Server card displays source file origin
    Given "memory-server" is configured in .claude.json
    When the user views the MCP server card for "memory-server"
    Then the card shows source origin ".claude.json"

  @skip
  Scenario: Server card displays plugin name as source for plugin servers
    Given "discord-bot" is configured by the "discord" plugin
    When the user views the MCP server card for "discord-bot"
    Then the card shows source origin "discord"
    And the card shows scope "plugin"

  @skip
  Scenario: All source types render without layout issues
    Given servers exist from settings.json, .claude.json, .mcp.json, and a plugin
    When the MCP tab renders all server cards
    Then each card displays its source origin clearly
    And no cards overflow or clip the source attribution text

  @skip
  Scenario: Server card shows scope alongside source
    Given "local-db" is configured in .mcp.json with project scope
    When the user views the MCP server card for "local-db"
    Then the card shows scope "project"
    And the card shows source origin ".mcp.json"

  # --- Error path scenarios ---

  @skip
  Scenario: Server with warnings still shows source attribution
    Given "broken-server" from .mcp.json has a warning about missing command
    When the user views the MCP server card for "broken-server"
    Then the card shows the warning about the missing field
    And the card still shows source origin ".mcp.json"
    And the card still shows scope "project"

  @skip
  Scenario: Env var masking works on servers from non-settings sources
    Given "api-server" from .claude.json has env var "API_KEY"
    When the user views the MCP server card for "api-server"
    Then "API_KEY" value is masked as "****"
    And clicking the masked value reveals the full value
    And the card shows source origin ".claude.json"

  # --- Edge case scenarios ---

  @skip
  Scenario: Empty state message references all configuration locations
    Given no MCP servers are configured in any source
    When the MCP tab shows the empty state
    Then the empty state message mentions settings.json
    And the empty state message mentions .claude.json
    And the empty state message mentions .mcp.json
    And the empty state message mentions plugin configurations

  @skip
  Scenario: Duplicate server names from different sources distinguishable by source
    Given "my-server" exists in both settings.json and .mcp.json
    When the user views the MCP tab
    Then 2 cards appear for "my-server"
    And one card shows source "settings.json" with scope "user"
    And the other card shows source ".mcp.json" with scope "project"

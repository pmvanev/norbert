Feature: Milestone 2 -- Domain aggregates MCP servers from all sources
  The TypeScript domain layer parses MCP server definitions from all config file
  entries, annotates each with scope and source attribution, and merges them
  into the unified configuration alongside existing settings.json servers.

  Background:
    Given the configuration aggregator is available

  # --- Happy path scenarios ---

  @skip
  Scenario: MCP servers from .claude.json aggregated with source attribution
    Given .claude.json contains MCP server "memory-server" of type "stdio"
    And .claude.json has scope "user" and source ".claude.json"
    When the configuration is aggregated
    Then "memory-server" appears in the MCP server list
    And "memory-server" has scope "user" and source ".claude.json"
    And "memory-server" has type "stdio"

  @skip
  Scenario: MCP servers from project .mcp.json aggregated with source attribution
    Given .mcp.json contains MCP server "local-db" with command "npx db-server"
    And .mcp.json has scope "project" and source ".mcp.json"
    When the configuration is aggregated
    Then "local-db" appears in the MCP server list
    And "local-db" has scope "project" and source ".mcp.json"
    And "local-db" has command "npx db-server"

  @skip
  Scenario: MCP servers from plugin .mcp.json aggregated with plugin name as source
    Given plugin "discord" .mcp.json contains MCP server "discord-bot"
    And the plugin entry has scope "plugin" and source "discord"
    When the configuration is aggregated
    Then "discord-bot" appears in the MCP server list
    And "discord-bot" has scope "plugin" and source "discord"

  @skip
  Scenario: Servers from all sources merged into single list
    Given settings.json contains MCP server "filesystem-server"
    And .claude.json contains MCP server "memory-server"
    And .mcp.json contains MCP server "git-server"
    And plugin "slack" .mcp.json contains MCP server "slack-bot"
    When the configuration is aggregated
    Then the MCP server list contains 4 servers
    And each server retains its original scope and source

  @skip
  Scenario: Existing settings.json MCP servers still parsed correctly
    Given settings.json contains MCP server "filesystem-server" of type "stdio"
    And "filesystem-server" has command "npx @anthropic/mcp-filesystem"
    And "filesystem-server" has args "/home/user/projects"
    When the configuration is aggregated
    Then "filesystem-server" appears with type "stdio"
    And "filesystem-server" has command "npx @anthropic/mcp-filesystem"
    And "filesystem-server" has args containing "/home/user/projects"

  @skip
  Scenario: Env var masking works for servers from all sources
    Given settings.json MCP server "github-server" has env var "GITHUB_TOKEN" with value "ghp_secret123"
    And .claude.json MCP server "api-server" has env var "API_KEY" with value "sk-secret456"
    When the configuration is aggregated
    Then "github-server" has env var "GITHUB_TOKEN" with the original value preserved
    And "api-server" has env var "API_KEY" with the original value preserved

  # --- Error path scenarios ---

  @skip
  Scenario: Malformed JSON in one MCP file does not break other sources
    Given settings.json contains MCP server "filesystem-server"
    And .claude.json contains invalid JSON
    And .mcp.json contains MCP server "git-server"
    When the configuration is aggregated
    Then "filesystem-server" and "git-server" appear in the MCP server list
    And no servers are returned from .claude.json
    And no crash or unhandled error occurs

  @skip
  Scenario: MCP file entry with no mcpServers key produces zero servers
    Given .claude.json contains valid JSON with permissions but no mcpServers
    When the configuration is aggregated
    Then no MCP servers are produced from .claude.json
    And servers from other sources are unaffected

  @skip
  Scenario: MCP server with missing required command field shows warning
    Given .mcp.json contains MCP server "broken-server" with no command field
    When the configuration is aggregated
    Then "broken-server" appears in the MCP server list
    And "broken-server" has a warning about the missing command field

  @skip
  Scenario: MCP server with invalid configuration produces a warning
    Given .claude.json contains an MCP server entry that is not a valid object
    When the configuration is aggregated
    Then the invalid entry appears with a warning about invalid configuration
    And other valid servers from .claude.json are still parsed

  # --- Edge case scenarios ---

  @skip
  Scenario: Duplicate server names across sources are all shown
    Given settings.json contains MCP server "my-server" with command "cmd-a"
    And .mcp.json contains MCP server "my-server" with command "cmd-b"
    When the configuration is aggregated
    Then 2 servers named "my-server" appear in the MCP server list
    And one "my-server" has source "settings.json" and command "cmd-a"
    And the other "my-server" has source ".mcp.json" and command "cmd-b"

  @skip
  Scenario: Empty MCP files from all sources produce empty server list
    Given settings.json has no mcpServers section
    And .claude.json has no mcpServers section
    And .mcp.json has no mcpServers section
    And no plugins have .mcp.json files
    When the configuration is aggregated
    Then the MCP server list is empty

  @skip
  @property
  Scenario: Source attribution is always present for any MCP server
    Given any valid MCP server from any configuration source
    When the configuration is aggregated
    Then every MCP server has a non-empty scope value
    And every MCP server has a non-empty source value
    And every MCP server has a non-empty file path

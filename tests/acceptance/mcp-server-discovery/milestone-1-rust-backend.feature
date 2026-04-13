Feature: Milestone 1 -- Backend reads additional MCP config files
  The Rust backend extends the config reader to discover MCP server definitions
  from .claude.json, project .mcp.json, and plugin .mcp.json files,
  returning them alongside the existing settings.json data.

  Background:
    Given the configuration reader is available

  # --- Happy path scenarios ---

  @skip
  Scenario: Global .claude.json MCP servers included in config response
    Given the user has a .claude.json file containing 2 MCP servers
    When the configuration is read for user scope
    Then the response includes 2 MCP file entries from .claude.json
    And each entry has scope "user" and source ".claude.json"

  @skip
  Scenario: Project .mcp.json MCP servers included in config response
    Given the project root contains an .mcp.json file with 3 MCP servers
    When the configuration is read for project scope
    Then the response includes 3 MCP file entries from .mcp.json
    And each entry has scope "project" and source ".mcp.json"

  @skip
  Scenario: Plugin .mcp.json files discovered during plugin scan
    Given plugin "discord" version "1.0" has an .mcp.json with 1 MCP server
    And plugin "github" version "2.1" has an .mcp.json with 2 MCP servers
    When the configuration is read for user scope
    Then the response includes 3 MCP file entries from plugins
    And the "discord" plugin entry has source "discord"
    And the "github" plugin entries have source "github"

  @skip
  Scenario: Both scopes merged when reading all configuration
    Given settings.json contains 1 MCP server at user scope
    And .claude.json contains 1 MCP server at user scope
    And .mcp.json contains 1 MCP server at project scope
    When the configuration is read for both scopes
    Then the response includes MCP file entries from all 3 sources
    And existing settings.json data is unchanged

  # --- Error path scenarios ---

  @skip
  Scenario: Missing .claude.json produces empty result
    Given no .claude.json file exists in the home directory
    When the configuration is read for user scope
    Then the response contains no MCP file entries for .claude.json
    And no errors are reported for the missing file

  @skip
  Scenario: Missing project .mcp.json produces empty result
    Given no .mcp.json file exists in the project root
    When the configuration is read for project scope
    Then the response contains no MCP file entries for .mcp.json
    And no errors are reported for the missing file

  @skip
  Scenario: Plugin directory with no .mcp.json is silently skipped
    Given plugin "analytics" version "1.0" has no .mcp.json file
    When the configuration is read for user scope
    Then no MCP file entries appear for the "analytics" plugin
    And no errors are reported for the missing plugin config

  @skip
  Scenario: Unreadable .claude.json reports error without blocking other sources
    Given .claude.json exists but has unreadable permissions
    And .mcp.json contains 2 MCP servers
    When the configuration is read for both scopes
    Then a read error is reported for .claude.json
    And .mcp.json entries are still returned successfully

  @skip
  Scenario: Malformed JSON in .mcp.json captured as error
    Given .mcp.json contains invalid JSON syntax
    When the configuration is read for project scope
    Then a parse error is reported for .mcp.json with error details
    And no MCP file entries are returned for .mcp.json

  # --- Edge case scenarios ---

  @skip
  Scenario: Empty .claude.json file produces no servers
    Given .claude.json exists but contains an empty JSON object
    When the configuration is read for user scope
    Then the response contains the .claude.json file entry with empty content
    And no errors are reported

  @skip
  Scenario: .claude.json with no mcpServers section produces no servers
    Given .claude.json contains settings but no mcpServers section
    When the configuration is read for user scope
    Then the .claude.json file entry is included in the response
    And parsing the entry yields zero MCP servers

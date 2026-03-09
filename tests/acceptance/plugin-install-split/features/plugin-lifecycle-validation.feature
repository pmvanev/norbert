Feature: Plugin lifecycle validation
  As a Claude Code user managing the Norbert plugin,
  I want the plugin install and uninstall to work cleanly through Claude's framework,
  so that I can connect and disconnect Norbert without manual configuration editing.

  Note: Claude's plugin framework handles install/uninstall operations.
  These scenarios validate that Norbert's artifacts support that lifecycle correctly
  and that the app responds appropriately to the resulting state changes.

  # --- Plugin Install Support ---

  Scenario: Plugin files enable Claude to register 6 hooks on install
    Given the plugin hooks definition contains 6 entries
    And each entry specifies an async HTTP hook to localhost:3748
    When Claude's framework processes the plugin package
    Then all 6 hooks can be registered without ambiguity or conflict

  Scenario: Plugin files enable Claude to register MCP server on install
    Given the plugin MCP configuration defines server "norbert"
    And the server uses stdio transport with command "norbert-cc"
    When Claude's framework processes the plugin package
    Then the MCP server can be registered as a valid stdio server

  # --- App Responds to Plugin State ---

  Scenario: App detects connection when first event arrives after plugin install
    Given the app is in "No plugin connected" state
    And the user installs the plugin via Claude's framework
    When the user starts a Claude Code session and the first event arrives
    Then the app transitions to "Active session"
    And session count becomes 1

  Scenario: App preserves all historical data when plugin is removed
    Given the app has 14 stored sessions and 847 events
    When the user removes the plugin via Claude's framework
    And no new events arrive
    Then all 14 sessions and 847 events remain accessible
    And the status reflects that historical data exists

  Scenario: App does not crash when events stop arriving mid-session
    Given the app is receiving events from an active Claude Code session
    When the plugin is removed and events stop arriving
    Then the app continues running without errors
    And the current session remains in the session list

  # --- Reinstall ---

  Scenario: Plugin reinstall works cleanly after previous uninstall
    Given the user previously uninstalled the Norbert plugin
    And the app has 14 stored sessions from before uninstall
    When the user reinstalls the plugin and starts a new Claude Code session
    Then events flow to the app again
    And new sessions appear alongside the 14 historical sessions

  # --- Error/Edge Cases ---

  Scenario: Plugin install succeeds regardless of whether app is running
    Given the Norbert app is not currently running
    When the user installs the plugin via Claude's framework
    Then the plugin installs successfully based on the static plugin files
    And hooks are registered in Claude's configuration

  Scenario: Duplicate plugin install does not create duplicate registrations
    Given the Norbert plugin is already installed in Claude Code
    When the user runs the plugin install command again
    Then no duplicate hook entries are created
    And no duplicate MCP server entries are created

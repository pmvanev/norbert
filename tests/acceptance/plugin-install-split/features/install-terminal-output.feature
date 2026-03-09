Feature: Install terminal output with plugin guidance
  As a Claude Code user who just installed Norbert,
  I want the terminal to show me how to connect the plugin,
  so that I know the exact next step without reading documentation.

  Scenario: Terminal output includes plugin install command after successful install
    Given the user runs the Norbert install command
    When the install completes successfully
    Then the terminal output includes "To connect to Claude Code:"
    And the terminal output includes "/plugin install norbert@pmvanev-plugins"

  Scenario: Terminal output does not mention settings merge or restart
    Given the user runs the Norbert install command
    When the install completes successfully
    Then the terminal output does not include "settings"
    And the terminal output does not include "Restart Claude Code"

  Scenario: Terminal output does not reference settings.json
    Given the user runs the Norbert install command
    When the install completes successfully
    Then the terminal output does not include "settings.json"
    And the terminal output does not include ".claude/settings"

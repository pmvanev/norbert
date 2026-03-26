Feature: Environment Variable Viewer
  As a Claude Code power user who has configured OpenTelemetry via /norbert:setup,
  I want to see environment variables from settings.json in the Config Viewer,
  so I can verify my configuration is correct without inspecting raw JSON files.

  Background:
    Given Reiko Tanaka is a senior developer using Norbert for observability
    And Reiko has run /norbert:setup which wrote 5 env vars to ~/.claude/settings.json:
      | key                              | value                   |
      | CLAUDE_CODE_ENABLE_TELEMETRY     | 1                       |
      | OTEL_METRICS_EXPORTER            | otlp                    |
      | OTEL_LOGS_EXPORTER               | otlp                    |
      | OTEL_EXPORTER_OTLP_PROTOCOL      | http/json               |
      | OTEL_EXPORTER_OTLP_ENDPOINT      | http://127.0.0.1:3748   |

  # --- Happy Path Scenarios ---

  Scenario: Display environment variables in the Environment tab
    Given ~/.claude/settings.json contains an env block with 5 variables
    When Reiko opens Config Viewer and clicks the Environment tab
    Then 5 environment variables are displayed
    And the variables are sorted alphabetically by key
    And the header shows "Environment Variables (5)"
    And the scope tag shows "user"

  Scenario: Display key-value pairs with correct values
    Given the Environment tab is active
    Then the variable CLAUDE_CODE_ENABLE_TELEMETRY shows value "1"
    And the variable OTEL_EXPORTER_OTLP_ENDPOINT shows value "http://127.0.0.1:3748"
    And the variable OTEL_EXPORTER_OTLP_PROTOCOL shows value "http/json"
    And the variable OTEL_LOGS_EXPORTER shows value "otlp"
    And the variable OTEL_METRICS_EXPORTER shows value "otlp"

  Scenario: View environment variable detail
    Given the Environment tab is showing 5 variables
    When Reiko clicks on OTEL_EXPORTER_OTLP_PROTOCOL
    Then the detail panel opens in the secondary zone
    And it shows Key as "OTEL_EXPORTER_OTLP_PROTOCOL"
    And it shows Value as "http/json"
    And it shows Source as the path to settings.json
    And it shows Scope as "user"

  Scenario: Reload configuration reflects updated env vars
    Given the Environment tab shows 5 variables
    And Reiko has re-run /norbert:setup which changed OTEL_EXPORTER_OTLP_ENDPOINT to "http://127.0.0.1:4000"
    When Reiko clicks the reload button
    Then OTEL_EXPORTER_OTLP_ENDPOINT shows value "http://127.0.0.1:4000"

  # --- Empty State Scenarios ---

  Scenario: No env block in settings.json
    Given ~/.claude/settings.json exists but contains no env key
    When Reiko opens Config Viewer and clicks the Environment tab
    Then the header shows "Environment Variables (0)"
    And an empty state message reads "No environment variables configured."
    And guidance text reads "Run /norbert:setup to configure OpenTelemetry."

  # --- Error Scenarios ---

  Scenario: settings.json is missing
    Given ~/.claude/settings.json does not exist
    When Reiko opens Config Viewer
    Then the Environment tab shows no variables
    And the existing error indicator pattern displays the missing file

  Scenario: env block contains non-string values
    Given ~/.claude/settings.json has an env block with:
      | key                              | value                   | type    |
      | CLAUDE_CODE_ENABLE_TELEMETRY     | 1                       | string  |
      | OTEL_METRICS_EXPORTER            | otlp                    | string  |
      | INVALID_NESTED                   | {"nested": "object"}    | object  |
    When Reiko opens Config Viewer and clicks the Environment tab
    Then only 2 valid string variables are displayed
    And INVALID_NESTED is not shown
    And the header shows "Environment Variables (2)"

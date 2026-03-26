Feature: Environment Variable Viewer
  As a Claude Code power user who has configured OpenTelemetry via /norbert:setup,
  I want to see environment variables from settings.json in the Config Viewer,
  so I can verify my configuration is correct without inspecting raw JSON files.

  # ---------------------------------------------------------------------------
  # WALKING SKELETONS
  # ---------------------------------------------------------------------------

  @walking_skeleton
  Scenario: User verifies environment variables after running setup
    Given Reiko has run /norbert:setup which wrote 5 OpenTelemetry env vars to her settings file
    When the settings file is parsed for environment variables
    Then 5 environment variables are returned
    And the variables are sorted alphabetically by key
    And CLAUDE_CODE_ENABLE_TELEMETRY has value "1"
    And OTEL_EXPORTER_OTLP_ENDPOINT has value "http://127.0.0.1:3748"
    And OTEL_EXPORTER_OTLP_PROTOCOL has value "http/json"
    And OTEL_LOGS_EXPORTER has value "otlp"
    And OTEL_METRICS_EXPORTER has value "otlp"

  @walking_skeleton
  Scenario: User selects an environment variable to see its full detail
    Given the settings file contains 5 OpenTelemetry env vars from the user scope
    When the environment variables are parsed and aggregated
    And the user selects OTEL_EXPORTER_OTLP_ENDPOINT
    Then the detail shows key "OTEL_EXPORTER_OTLP_ENDPOINT"
    And the detail shows value "http://127.0.0.1:3748"
    And the detail shows scope "user"
    And the detail shows the source file path

  # ---------------------------------------------------------------------------
  # FOCUSED SCENARIOS: Env Block Extraction (US-CEV-01)
  # ---------------------------------------------------------------------------

  Scenario: Count badge reflects the number of environment variables
    Given the settings file contains an env block with 5 string key-value pairs
    When the environment variables are extracted
    Then the count is 5

  Scenario: Mixed custom and OpenTelemetry variables all appear in sorted order
    Given the settings file contains 6 env vars including CUSTOM_LOG_LEVEL alongside 5 OpenTelemetry vars
    When the environment variables are extracted
    Then 6 environment variables are returned
    And CUSTOM_LOG_LEVEL appears before OTEL_EXPORTER_OTLP_ENDPOINT in the sorted list

  Scenario: Scope tag reflects user-level settings
    Given the settings file is the user-level settings at ~/.claude/settings.json
    When the environment variables are extracted with scope attribution
    Then each env var entry has scope "user"

  Scenario: Scope tag reflects project-level settings
    Given the settings file is the project-level settings at .claude/settings.json
    When the environment variables are extracted with scope attribution
    Then each env var entry has scope "project"

  Scenario: Aggregated config includes environment variables from parsed settings
    Given the settings parser extracted 5 env var entries from the user-level file
    When the configuration is aggregated
    Then the aggregated config contains 5 env var entries
    And each entry includes the source file path

  # ---------------------------------------------------------------------------
  # FOCUSED SCENARIOS: Detail View (US-CEV-02)
  # ---------------------------------------------------------------------------

  Scenario: Detail includes key, value, scope, and source for a selected variable
    Given the aggregated config contains env var OTEL_METRICS_EXPORTER with value "otlp" from user scope
    When the user selects OTEL_METRICS_EXPORTER
    Then the detail shows key "OTEL_METRICS_EXPORTER"
    And the detail shows value "otlp"
    And the detail shows scope "user"
    And the detail shows the source file path

  Scenario: Switching selection updates detail to the newly selected variable
    Given the user has selected OTEL_EXPORTER_OTLP_ENDPOINT in the detail view
    When the user selects CLAUDE_CODE_ENABLE_TELEMETRY instead
    Then the detail shows key "CLAUDE_CODE_ENABLE_TELEMETRY"
    And the detail shows value "1"

  Scenario: Short boolean-like value displayed with full detail context
    Given CLAUDE_CODE_ENABLE_TELEMETRY has value "1" from user scope
    When the user selects CLAUDE_CODE_ENABLE_TELEMETRY
    Then the detail shows value "1"
    And the detail shows scope "user"

  # ---------------------------------------------------------------------------
  # ERROR / BOUNDARY SCENARIOS
  # ---------------------------------------------------------------------------

  Scenario: Empty state when settings file has no env block
    Given the settings file contains hooks and other config but no env block
    When the environment variables are extracted
    Then zero environment variables are returned
    And the empty state indicates no environment variables are configured
    And guidance suggests running /norbert:setup

  Scenario: Empty env block produces zero variables
    Given the settings file contains an env block with no key-value pairs
    When the environment variables are extracted
    Then zero environment variables are returned

  Scenario: Non-string env values are silently excluded
    Given the settings file env block contains 5 string vars and 1 nested object entry
    When the environment variables are extracted
    Then only 5 valid string variables are returned
    And the nested object entry is excluded

  Scenario: Non-string number value is excluded from results
    Given the settings file env block contains a key with a numeric value instead of a string
    When the environment variables are extracted
    Then the numeric entry is excluded
    And only string entries are returned

  Scenario: Non-string array value is excluded from results
    Given the settings file env block contains a key with an array value instead of a string
    When the environment variables are extracted
    Then the array entry is excluded
    And only string entries are returned

  Scenario: Settings file is missing entirely
    Given the settings file does not exist at the expected path
    When the configuration is loaded
    Then no environment variables are available
    And the error state indicates the settings file is missing

  Scenario: Settings file contains invalid JSON
    Given the settings file contains malformed content that is not valid JSON
    When the configuration is loaded
    Then no environment variables are available
    And the error state indicates the file could not be parsed

  Scenario: Env block with a single variable
    Given the settings file env block contains exactly 1 key-value pair CUSTOM_FLAG with value "on"
    When the environment variables are extracted
    Then 1 environment variable is returned
    And it has key "CUSTOM_FLAG" and value "on"

  Scenario: Env var values with special characters preserved exactly
    Given the settings file env block contains ENDPOINT with value "http://127.0.0.1:3748/v1/traces?format=json&timeout=30"
    When the environment variables are extracted
    Then ENDPOINT has value "http://127.0.0.1:3748/v1/traces?format=json&timeout=30"

  Scenario: Env var with empty string value is included
    Given the settings file env block contains EMPTY_VAR with value ""
    When the environment variables are extracted
    Then EMPTY_VAR is included with value ""

  # ---------------------------------------------------------------------------
  # PROPERTY-SHAPED SCENARIOS
  # ---------------------------------------------------------------------------

  @property
  Scenario: Extracted env vars are always in alphabetical order regardless of input order
    Given any valid env block with string key-value pairs in any order
    When the environment variables are extracted
    Then the result is sorted alphabetically by key

  @property
  Scenario: Count always matches the number of entries returned
    Given any valid settings file with an env block
    When the environment variables are extracted
    Then the count equals the number of entries in the result

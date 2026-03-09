Feature: Settings merge code removal
  As a Norbert contributor,
  I want all dead settings merge code removed from the codebase,
  so that the code accurately reflects the plugin framework approach and reduces maintenance burden.

  # --- Walking Skeleton ---

  @walking_skeleton
  Scenario: App launches cleanly without any settings merge behavior
    Given a user runs Norbert for the first time
    When the app initializes and the window opens
    Then no settings file is read or modified
    And no backup file is created
    And no "Restart Claude Code" notification is shown
    And the app shows "No plugin connected" status

  # --- Code Removal Verification ---

  Scenario: SettingsMergeAdapter no longer exists in the codebase
    Given a contributor searches the Norbert source code
    When they search for "SettingsMergeAdapter"
    Then no source file contains that identifier
    And no test file references that identifier

  Scenario: run_settings_merge function no longer exists
    Given a contributor searches the Norbert source code
    When they search for "run_settings_merge"
    Then no source file contains that function
    And the app startup does not call any settings merge operation

  Scenario: SettingsManager port trait no longer exists
    Given a contributor searches the Norbert source code
    When they search for "SettingsManager"
    Then no port trait with that name exists
    And no test stubs implement that trait

  Scenario: Settings merge domain functions are removed
    Given a contributor searches the domain module
    When they search for merge-related functions
    Then none of these exist: merge_hooks_into_config, hooks_are_merged, build_hooks_only_config
    And none of these exist: build_hook_entry, build_hooks_object, build_merged_config, build_merged_hooks
    And the MergeOutcome type does not exist

  # --- Preserved Components ---

  Scenario: Domain constants used by the receiver are preserved
    Given a contributor inspects the domain module after code removal
    When they look for core constants and functions
    Then HOOK_EVENT_NAMES is still defined with 6 event types
    And HOOK_PORT is still defined as 3748
    And build_hook_url is still available
    And parse_event_type is still available

  # --- ADR Update ---

  Scenario: ADR-006 is marked as superseded
    Given a contributor reviews the architectural decision records
    When they read ADR-006 about settings merge strategy
    Then its status shows "Superseded"
    And it references the plugin framework as the replacement approach

  # --- Error/Edge Cases ---

  Scenario: No restart banner logic remains in the frontend
    Given a contributor searches the frontend source code
    When they search for "shouldShowRestartBanner" or "bannerWasShown"
    Then neither function nor variable exists in the codebase

  Scenario: App compiles and all remaining tests pass after removal
    Given all settings merge code has been removed
    When the project is compiled and tests are run
    Then compilation succeeds with no errors
    And all remaining tests pass

  Scenario: Settings adapter module declaration is removed
    Given the adapters module file is inspected
    When checking for the settings module declaration
    Then no "pub mod settings" declaration exists

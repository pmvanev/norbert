Feature: App functions without plugin connected
  As a Claude Code user evaluating Norbert,
  I want the app to function gracefully when no plugin is installed,
  so that I can explore the app before committing and browse historical data after disconnecting.

  # --- Walking Skeleton ---

  @walking_skeleton
  Scenario: User opens newly installed app and sees guidance to connect
    Given a user has installed Norbert but has not installed the plugin
    And no sessions or events have ever been recorded
    When the user opens the app window
    Then the status shows "No plugin connected"
    And the app displays the command to install the plugin
    And session count shows 0 and event count shows 0

  @walking_skeleton
  Scenario: App transitions to active when plugin sends first event
    Given Norbert is running and showing "No plugin connected"
    And the user installs the plugin and starts a Claude Code session
    When the first hook event arrives from Claude Code
    Then the app status transitions to "Listening" or "Active session"
    And the session count increments to 1
    And no app restart was needed

  # --- Status Derivation ---

  Scenario: Status is "No plugin connected" when no events have ever arrived
    Given the app has 0 sessions and 0 events
    When the status is derived
    Then the status is "No plugin connected"

  Scenario: Status is "Listening" when sessions exist but none are active
    Given the app has 3 sessions and 45 events
    And the most recent session has ended
    When the status is derived
    Then the status is "Listening"

  Scenario: Status is "Active session" when the latest session is ongoing
    Given the app has 2 sessions and 30 events
    And the most recent session has not ended
    When the status is derived
    Then the status is "Active session"

  Scenario: Status never returns to "No plugin connected" once events exist
    Given the app has received at least 1 event in the past
    And the plugin is now uninstalled so no new events arrive
    When the status is derived
    Then the status is "Listening" and not "No plugin connected"

  # --- Empty State UI ---

  Scenario: Empty state displays the plugin install command prominently
    Given the app is in "No plugin connected" state
    When the user views the app window
    Then the window displays "/plugin install norbert@pmvanev-plugins"

  Scenario: Empty state does not show error indicators or broken appearance
    Given the app is in "No plugin connected" state
    When the user views the app window
    Then the receiver is listening on port 3748
    And the UI does not display error messages or warning indicators

  # --- Historical Data Access ---

  Scenario: User browses historical sessions after plugin removal
    Given the app has 8 stored sessions from when the plugin was active
    And the plugin is now uninstalled
    When the user opens the session list
    Then all 8 sessions are listed
    And the user can view session details and events
    And the status shows "No plugin connected" is not displayed because data exists

  # --- Error/Edge Cases ---

  Scenario: Receiver stays ready even when no plugin is connected
    Given the app is in "No plugin connected" state
    And the receiver has been idle for 48 hours
    When a hook event arrives unexpectedly
    Then the event is received and stored successfully
    And the status transitions away from "No plugin connected"

  Scenario: App handles zero-to-one session transition correctly
    Given the app has 0 sessions and 0 events
    When a SessionStart event arrives followed by a PreToolUse event
    Then session count shows 1
    And event count shows 2
    And the status is "Active session"

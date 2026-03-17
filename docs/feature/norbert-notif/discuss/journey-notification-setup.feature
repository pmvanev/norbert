Feature: Notification Center Setup and Event Delivery
  As a Norbert user running Claude Code sessions,
  I want to configure and receive notifications for agent events
  so that I stay aware of important events without constant polling.

  Background:
    Given norbert-notif plugin is enabled and loaded
    And the notification event registry contains 14 event types

  # -----------------------------------------------------------------------
  # Step 1: Open Notification Settings
  # -----------------------------------------------------------------------

  Scenario: First-time user sees default notification settings
    Given Raj Patel has not configured any notification preferences
    When Raj opens Settings with Ctrl+, and selects Notifications
    Then the Events sub-section is displayed
    And all 14 notification events are listed
    And "Session response completed" has Toast enabled by default
    And "Session started" has all channels disabled by default
    And "Cost threshold reached" has Toast, Banner, and Badge enabled by default
    And the cost threshold input shows $5.00
    And the context window threshold input shows 75%

  Scenario: Notification settings section has proper title area
    Given Raj is viewing Norbert Settings
    When Raj navigates to the Notifications section
    Then the section displays a sec-hdr title area reading "Notifications"
    And three sub-sections are available: Events, Channels, Do Not Disturb

  # -----------------------------------------------------------------------
  # Step 2: Configure Event Routing
  # -----------------------------------------------------------------------

  Scenario: Keiko enables Banner channel for session completion
    Given Keiko Tanaka is viewing the Notifications Events settings
    And "Session response completed" has Toast enabled and Banner disabled
    When Keiko enables the Banner channel for "Session response completed"
    Then the Banner toggle for "Session response completed" shows enabled
    And the preference is persisted immediately

  Scenario: Keiko changes cost threshold to 25 dollars
    Given Keiko is viewing the Notifications Events settings
    And the cost threshold is set to $5.00
    When Keiko changes the cost threshold to $25.00
    Then the threshold input displays $25.00
    And the notification dispatch engine uses $25.00 as the trigger

  Scenario: Marcus sets context window threshold to 80 percent
    Given Marcus Chen is viewing the Notifications Events settings
    And the context window threshold is set to 75%
    When Marcus changes the context window threshold to 80%
    Then the threshold input displays 80%
    And context window alerts fire when usage exceeds 80%

  Scenario: Raj assigns custom sound to session completion
    Given Raj is viewing the Notifications Events settings
    And "Session response completed" has sound set to "phosphor-ping"
    When Raj changes the sound for "Session response completed" to "session-complete"
    Then the sound picker shows "session-complete" selected
    And a preview of the sound plays briefly

  # -----------------------------------------------------------------------
  # Step 3: Configure Channels
  # -----------------------------------------------------------------------

  Scenario: Keiko configures Slack webhook channel
    Given Keiko is viewing the Notifications Channels settings
    And the Webhook channel shows "Not configured"
    When Keiko enters webhook URL "https://hooks.slack.com/services/T01ABC/B02DEF/a1b2c3d4e5"
    And saves the channel configuration
    Then the Webhook status changes to "Configured"
    And the Test button becomes active

  Scenario: Keiko configures email channel with SMTP credentials
    Given Keiko is viewing the Notifications Channels settings
    And the Email channel shows "Not configured"
    When Keiko enters SMTP host "smtp.company.com" port 587
    And enters username "keiko@company.com" and password
    And enters from address "norbert@company.com" and to address "keiko@company.com"
    And selects TLS encryption
    And saves the channel configuration
    Then the Email status changes to "Configured"
    And the SMTP password is stored securely, not in plaintext

  Scenario: Marcus sets tray badge style to amber colored dot
    Given Marcus is viewing the Notifications Channels settings
    And the Tray Icon Badge section is displayed
    When Marcus selects "Colored dot" style
    Then the badge style is set to colored dot with amber color
    And the preference is saved

  # -----------------------------------------------------------------------
  # Step 4: Test Channel
  # -----------------------------------------------------------------------

  Scenario: Keiko tests the Slack webhook channel successfully
    Given Keiko has configured the Webhook channel with a valid Slack URL
    When Keiko clicks the Test button for the Webhook channel
    Then a progress indicator appears showing "Sending test notification..."
    And within 10 seconds the result shows "Delivered successfully"
    And the timestamp of the test is displayed
    And the Slack channel receives a message labeled "[TEST] Norbert notification test"

  Scenario: Marcus tests a webhook with an unreachable URL
    Given Marcus has configured the Webhook channel with URL "https://invalid.example.com/hook"
    When Marcus clicks the Test button for the Webhook channel
    Then the result shows "Delivery failed"
    And an error message displays "Connection refused: https://invalid.example.com/hook"
    And the error message suggests "Verify the URL is correct and the server is reachable"

  Scenario: Raj tests the Windows toast channel
    Given Raj has the Windows Notification Center channel active
    When Raj clicks the Test button for the Toast channel
    Then a Windows toast notification appears with title "Norbert Test Notification"
    And the toast body reads "This is a test. If you see this, the channel is working."
    And the settings page shows "Delivered successfully"

  Scenario: Keiko tests email channel with invalid SMTP credentials
    Given Keiko has configured the Email channel with wrong password
    When Keiko clicks the Test button for the Email channel
    Then the result shows "Delivery failed"
    And the error message displays "Authentication failed for smtp.company.com:587"

  # -----------------------------------------------------------------------
  # Step 5: Receive Real Notifications
  # -----------------------------------------------------------------------

  Scenario: Raj receives session completion notification via toast
    Given Raj has "Session response completed" enabled for Toast channel
    And Raj has sound set to "phosphor-ping" at 80% volume
    And DND is not active
    When the Claude Code session "project-alpha" completes after 4 minutes 32 seconds
    Then a Windows toast appears with title "Session Response Completed"
    And the toast body shows "project-alpha finished. Duration: 4m 32s | Cost: $5.12"
    And the "phosphor-ping" sound plays at 80% volume

  Scenario: Cost threshold triggers multi-channel notification
    Given Keiko has "Cost threshold reached" enabled for Toast, Banner, and Badge
    And Keiko has the cost threshold set to $25.00
    And Keiko has Webhook configured for Slack
    And "Cost threshold reached" is also enabled for Webhook
    When the session cost for "api-refactor" reaches $25.12
    Then a Windows toast shows "Cost Threshold Reached: $25.12 of $25.00 limit"
    And a dashboard banner appears with "Cost threshold reached - api-refactor ($25.12)"
    And the tray icon shows an amber badge
    And the Slack webhook receives a JSON payload containing cost $25.12 and threshold $25.00

  Scenario: Hook error notification with context
    Given Raj has "Hook error detected" enabled for Toast and Banner
    When the pre-write hook "lint-check" returns an error with message "ESLint process exited with code 1"
    Then a Windows toast shows "Hook Error: lint-check"
    And a dashboard banner shows "Hook error detected - lint-check: ESLint process exited with code 1"
    And the banner persists until Raj dismisses it

  Scenario: Context compaction notification
    Given Marcus has "Context compaction occurred" enabled for Toast
    And Marcus has sound set to "compaction"
    When context compaction occurs in session "client-dashboard"
    Then a Windows toast shows "Context Compacted"
    And the toast body shows "Session client-dashboard context was compacted"
    And the "compaction" sound plays

  Scenario: Credit balance low notification
    Given Marcus has "Credit balance low" enabled for Toast, Banner, and Badge
    And the credit balance threshold is set to $10.00
    When the API credit balance drops to $8.50
    Then a Windows toast shows "Credit Balance Low: $8.50 remaining"
    And a dashboard banner shows "Credit balance low - $8.50 remaining (threshold: $10.00)"
    And the tray icon shows an amber badge

  Scenario: DES enforcement block notification
    Given Raj has "DES enforcement block" enabled for Toast and Banner
    And the nWave plugin is installed and active
    When DES blocks a tool call "write_file" in session "secure-api"
    Then a Windows toast shows "DES Block: write_file denied"
    And a dashboard banner shows "DES enforcement block - write_file denied in session secure-api"

  Scenario: Notification not delivered when channel is disabled
    Given Raj has "Session started" with all channels disabled
    When a new Claude Code session "bugfix-login" starts
    Then no toast notification appears
    And no dashboard banner appears
    And no sound plays
    And the tray badge count does not change

  # -----------------------------------------------------------------------
  # Step 6: Do Not Disturb
  # -----------------------------------------------------------------------

  Scenario: Keiko enables DND via tray icon
    Given Keiko has DND disabled
    When Keiko right-clicks the Norbert tray icon
    And selects "Do Not Disturb"
    Then DND activates immediately
    And the tray icon shows a pause overlay
    And the status bar shows "DND: On"

  Scenario: DND suppresses toast and sound but queues for banner
    Given Keiko has DND active with "Queue and show count badge" behavior
    And "Cost threshold reached" is enabled for Toast, Banner, and Badge
    When the session cost reaches the threshold
    Then no Windows toast appears
    And no sound plays
    But the notification is queued
    And the tray badge count increments

  Scenario: Queued notifications delivered when DND ends
    Given Keiko has DND active
    And 3 notifications have been queued during DND
    When DND deactivates (manually or by schedule)
    Then 3 dashboard banners appear showing the queued notifications
    And a summary toast shows "3 notifications received while DND was active"
    And the tray badge shows "3"

  Scenario: Scheduled DND activates and deactivates automatically
    Given Keiko has scheduled DND for Monday 09:00-10:00
    And it is Monday 08:59
    When the system clock reaches 09:00
    Then DND activates automatically
    And the status bar shows "DND: On (until 10:00)"
    When the system clock reaches 10:00
    Then DND deactivates automatically
    And queued notifications are delivered

  Scenario: DND toggled via keyboard shortcut
    Given Keiko has DND disabled
    When Keiko presses Ctrl+Shift+D
    Then DND activates
    And the status bar shows "DND: On"
    When Keiko presses Ctrl+Shift+D again
    Then DND deactivates
    And the status bar shows "DND: Off"

  # -----------------------------------------------------------------------
  # Sound Configuration
  # -----------------------------------------------------------------------

  Scenario: Marcus assigns a custom sound file
    Given Marcus has placed "client-done.wav" in ~/.norbert/sounds/
    When Marcus opens the sound picker for "Session response completed"
    Then the picker shows built-in sounds: phosphor-ping, amber-pulse, compaction, session-complete, des-block, silence
    And the picker shows custom sounds: client-done
    When Marcus selects "client-done"
    Then "Session response completed" uses "client-done.wav" for its notification sound

  Scenario: Global volume control
    Given Marcus is on the Notifications Events settings page
    And the global notification volume is set to 100%
    When Marcus adjusts the global volume slider to 50%
    Then all notification sounds play at 50% volume
    And the volume preference is saved

  Scenario: Sound preview on selection
    Given Raj is selecting a sound for "Hook error detected"
    When Raj selects "des-block" from the sound picker
    Then a preview of "des-block" plays at the current global volume
    And Raj can confirm or change the selection

  # -----------------------------------------------------------------------
  # Edge Cases and Error Paths
  # -----------------------------------------------------------------------

  Scenario: Notification delivery when Norbert window is closed to tray
    Given Raj has Norbert minimized to the system tray
    And "Session response completed" is enabled for Toast and Badge
    When a session completes
    Then the Windows toast still fires (tray app can send toasts)
    And the tray icon badge updates
    And when Raj opens Norbert, a dashboard banner shows the event

  Scenario: Webhook delivery failure does not block other channels
    Given Keiko has "Cost threshold reached" enabled for Toast and Webhook
    And the webhook URL is temporarily unreachable
    When the cost threshold is reached
    Then the Windows toast is delivered successfully
    And the webhook delivery fails silently after timeout
    And a dashboard banner notes "Webhook delivery failed for Cost threshold reached"

  Scenario: Multiple rapid notifications are grouped in banner
    Given Raj has "Agent spawned" and "Agent completed" enabled for Banner
    When 5 sub-agents spawn and complete within 10 seconds
    Then the dashboard shows a grouped banner "5 agent events in the last 10 seconds"
    And Raj can expand the group to see individual events

  Scenario: Invalid threshold value is rejected
    Given Keiko is editing the cost threshold
    When Keiko enters a negative value "-5"
    Then the input shows a validation error "Threshold must be a positive number"
    And the previous valid threshold is preserved

  @property
  Scenario: Notification delivery latency
    Given the notification dispatch engine is processing events
    Then notifications are delivered to all enabled channels within 3 seconds of event receipt
    And no event is silently dropped without logging

  @property
  Scenario: Preference persistence across restarts
    Given a user has configured notification preferences
    When Norbert is closed and reopened
    Then all notification preferences are restored exactly as configured
    And DND state and schedule are preserved

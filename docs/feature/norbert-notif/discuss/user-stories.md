<!-- markdownlint-disable MD024 -->

## US-NOTIF-01: Event Notification Delivery

### Problem

Raj Patel is a senior developer who runs Claude Code sessions daily across multiple projects. He finds it frustrating to miss session completions because he is focused in VS Code and has to manually poll the Norbert session view every few minutes. He wastes an average of 15 minutes per day checking back on sessions that already finished.

### Who

- Daily Claude Code user | Working in another window while agent runs | Wants immediate awareness of completion without polling

### Solution

Deliver notifications for agent events through user-configured channels (OS toast, dashboard banner, tray badge) when events fire via the hook bridge.

### Domain Examples

#### 1: Session Completion Toast -- Raj finishes project-alpha

Raj has "Session response completed" enabled for Toast with sound "phosphor-ping". He is editing code in VS Code. Session "project-alpha" completes after 4 minutes 32 seconds at a cost of $5.12. A Windows toast appears: "Session Response Completed -- project-alpha finished. Duration: 4m 32s | Cost: $5.12". The phosphor-ping sound plays. Raj sees the toast in 3 seconds and switches to Norbert to review output.

#### 2: Cost Threshold Alert -- Keiko's api-refactor session

Keiko has "Cost threshold reached" enabled for Toast, Banner, and Badge with threshold set to $25.00. Session "api-refactor" accumulates to $25.12. A toast fires: "Cost Threshold Reached: $25.12 of $25.00 limit". A dashboard banner persists until dismissed. The tray icon shows an amber badge. Keiko sees the banner when she next checks Norbert and decides to investigate.

#### 3: Hook Error During Session -- Raj's lint-check hook fails

Raj has "Hook error detected" enabled for Toast and Banner. The pre-write hook "lint-check" returns error "ESLint process exited with code 1" during session "secure-api". A toast shows "Hook Error: lint-check". A banner shows "Hook error detected -- lint-check: ESLint process exited with code 1 (session: secure-api)". The banner persists until dismissed. Raj catches the error in under 10 seconds instead of discovering it 30 minutes later.

### UAT Scenarios (BDD)

#### Scenario: Session completion delivered via toast

Given Raj has "Session response completed" enabled for Toast channel
And the sound is set to "phosphor-ping" at 80% volume
And DND is not active
When the Claude Code session "project-alpha" completes after 4 minutes 32 seconds with cost $5.12
Then a Windows toast appears with title "Session Response Completed"
And the toast body shows "project-alpha finished. Duration: 4m 32s | Cost: $5.12"
And the "phosphor-ping" sound plays at 80% volume

#### Scenario: Cost threshold triggers multi-channel delivery

Given Keiko has "Cost threshold reached" enabled for Toast, Banner, and Badge
And the cost threshold is set to $25.00
When the session "api-refactor" cost reaches $25.12
Then a toast shows "Cost Threshold Reached: $25.12 of $25.00 limit"
And a dashboard banner appears with the same message
And the tray icon shows an amber badge

#### Scenario: Hook error notification includes context

Given Raj has "Hook error detected" enabled for Toast and Banner
When the hook "lint-check" returns error "ESLint process exited with code 1" in session "secure-api"
Then a toast shows "Hook Error: lint-check"
And a banner shows "Hook error detected -- lint-check: ESLint process exited with code 1 (session: secure-api)"

#### Scenario: Disabled event does not trigger notification

Given Raj has "Session started" with all channels disabled
When a new session "bugfix-login" starts
Then no toast, banner, or sound is delivered
And the badge count does not change

#### Scenario: Delivery continues when one channel fails

Given Keiko has "Cost threshold reached" enabled for Toast and Webhook
And the webhook URL is temporarily unreachable
When the cost threshold is reached
Then the toast is delivered successfully
And the webhook failure is logged
And a banner notes "Webhook delivery failed for Cost threshold reached"

### Acceptance Criteria

- [ ] Notifications delivered to all enabled channels within 3 seconds of event receipt
- [ ] Disabled events produce no notifications on any channel
- [ ] Channel delivery failure does not block other channels
- [ ] Event payload includes event-specific context (session name, cost, hook name, error message)
- [ ] Badge count reflects number of undismissed banner notifications
- [ ] Sound plays at the configured global volume for the assigned sound

### Technical Notes (Optional)

- Events arrive via hookBridge.deliverHookEvent(); norbert-notif registers processors for each event type
- Windows toast requires Tauri notification API or Windows notification SDK
- Dashboard banners are in-app UI components managed by norbert-notif
- Tray badge update requires Tauri system tray API
- Delivery to each channel is independent and failure-isolated

### Job Story Traceability

- JS-01: Aware of Agent Completion
- JS-02: Cost and Budget Awareness
- JS-03: Critical Error Visibility

---

## US-NOTIF-02: Event and Channel Configuration

### Problem

Keiko Tanaka is a tech lead who monitors team costs and quality. She finds it overwhelming when every event fires the same type of notification, and she cannot distinguish critical cost alerts from informational session-started events. She needs per-event control over which channels deliver and what sound plays.

### Who

- Tech lead managing team costs | Uses Norbert alongside Slack and email | Wants granular control to reduce noise and route critical alerts

### Solution

Provide a settings surface (Ctrl+, then Notifications then Events) with a grid of events by channels, per-event toggles, threshold inputs for threshold-based events, and per-event sound assignment.

### Domain Examples

#### 1: Toggle Banner for Session Completion -- Keiko enables banner

Keiko opens Settings Notifications Events. She sees "Session response completed" with Toast enabled (default). She enables the Banner channel for this event. The toggle updates immediately. Next time a session completes, both a toast and a banner appear.

#### 2: Set Cost Threshold -- Keiko raises threshold to $25

Keiko sees the cost threshold input showing $5.00 (default). She changes it to $25.00. The input validates the value as a positive number and saves immediately. The dispatch engine now triggers "Cost threshold reached" only when session cost exceeds $25.00.

#### 3: Custom Sound Assignment -- Marcus picks custom sound

Marcus opens the sound picker for "Session response completed". He sees built-in sounds (phosphor-ping, amber-pulse, etc.) and a custom section showing "client-done" from ~/.norbert/sounds/client-done.wav. He selects "client-done" and hears a brief preview. Future session completions play this sound.

### UAT Scenarios (BDD)

#### Scenario: Enable banner channel for an event

Given Keiko is viewing the Notifications Events settings
And "Session response completed" has Banner disabled
When Keiko enables the Banner channel for "Session response completed"
Then the Banner toggle shows enabled
And the preference is saved immediately

#### Scenario: Change cost threshold value

Given Keiko is viewing the Notifications Events settings
And the cost threshold shows $5.00
When Keiko changes the cost threshold to $25.00
Then the input displays $25.00
And the dispatch engine uses $25.00 as the new trigger

#### Scenario: Invalid threshold value rejected

Given Keiko is editing the cost threshold
When Keiko enters "-5"
Then a validation error shows "Threshold must be a positive number"
And the previous valid threshold ($5.00) is preserved

#### Scenario: Custom sound appears in picker

Given Marcus has placed "client-done.wav" in ~/.norbert/sounds/
When Marcus opens the sound picker for "Session response completed"
Then the picker shows built-in sounds and "client-done" under Custom
When Marcus selects "client-done"
Then a preview plays at the current global volume

#### Scenario: Default settings match product specification

Given Raj opens Notifications Events settings for the first time
Then "Session response completed" has Toast enabled, sound "phosphor-ping"
And "Session started" has all channels disabled, sound "silence"
And "Cost threshold reached" has Toast, Banner, Badge enabled, sound "amber-pulse"
And "Context compaction occurred" has Toast enabled, sound "compaction"
And "Hook error detected" has Toast, Banner, Badge enabled, sound "des-block"

### Acceptance Criteria

- [ ] All 14 events displayed with per-event toggles for each channel
- [ ] Threshold-based events show editable threshold input beneath the event row
- [ ] Sound picker shows built-in and custom sounds from ~/.norbert/sounds/
- [ ] Sound preview plays on selection at current global volume
- [ ] Preferences persisted immediately on change (no separate Save button)
- [ ] Default values match product specification defaults
- [ ] Invalid threshold values show inline validation error and preserve previous value

### Technical Notes (Optional)

- Settings section registered by norbert-notif via NorbertAPI.ui
- Preferences stored in norbert-notif's config directory as JSON
- Sound files discovered by scanning built-in assets and ~/.norbert/sounds/ for WAV, MP3, OGG
- Global volume slider applies as multiplier to all notification sounds

### Job Story Traceability

- JS-04: Notification Routing Control

---

## US-NOTIF-03: Channel Setup and Testing

### Problem

Marcus Chen is a freelance developer who configured a Slack webhook URL for cost alerts but mistyped the URL. He only discovered the error 2 days later when a real cost alert should have fired but never appeared in Slack. He lost trust in the notification system and wasted time debugging a non-issue.

### Who

- Power user who customizes notification channels | Uses webhook and email for remote alerting | Needs confidence that configured channels actually work

### Solution

Provide channel configuration forms with inline validation and a Test button for every channel that sends a synthetic notification through the full delivery pipeline.

### Domain Examples

#### 1: Webhook Setup and Successful Test -- Keiko configures Slack

Keiko opens Channels settings. Webhook shows "Not configured". She enters "https://hooks.slack.com/services/T01ABC/B02DEF/a1b2c3d4e5", saves, and clicks Test. A progress bar appears. Within 5 seconds, result shows "Delivered successfully" with timestamp. In Slack, a message reads "[TEST] Norbert notification test".

#### 2: Invalid Webhook URL Test -- Marcus gets connection error

Marcus enters "https://invalid.example.com/hook" and clicks Test. After a timeout, result shows "Delivery failed -- Connection refused: https://invalid.example.com/hook". The error suggests "Verify the URL is correct and the server is reachable". Marcus fixes the URL and tests again successfully.

#### 3: SMTP Configuration and Test -- Keiko sets up email

Keiko enters SMTP host "smtp.company.com", port 587, TLS, credentials, and addresses. She clicks Test. An email arrives in her inbox from "norbert@company.com" with subject "[TEST] Norbert notification test" and body describing the test. Settings show "Delivered successfully".

### UAT Scenarios (BDD)

#### Scenario: Successful webhook test

Given Keiko has configured the Webhook channel with URL "https://hooks.slack.com/services/T01ABC/B02DEF/a1b2c3d4e5"
When Keiko clicks the Test button for the Webhook channel
Then a progress indicator shows "Sending test notification..."
And within 10 seconds the result shows "Delivered successfully"
And the Slack channel receives a message labeled "[TEST] Norbert notification test"

#### Scenario: Failed webhook test with actionable error

Given Marcus has configured the Webhook channel with URL "https://invalid.example.com/hook"
When Marcus clicks the Test button
Then the result shows "Delivery failed"
And the error message shows "Connection refused: https://invalid.example.com/hook"
And a suggestion reads "Verify the URL is correct and the server is reachable"

#### Scenario: SMTP test with invalid credentials

Given Keiko has configured the Email channel with incorrect password
When Keiko clicks the Test button for the Email channel
Then the result shows "Delivery failed"
And the error message shows "Authentication failed for smtp.company.com:587"

#### Scenario: Toast channel test

Given Raj has the Windows Notification Center channel active
When Raj clicks the Test button for the Toast channel
Then a Windows toast appears with title "Norbert Test Notification"
And the settings page confirms "Delivered successfully"

#### Scenario: Test notifications clearly labeled

Given any channel is configured and a test is initiated
When the test notification is delivered
Then the notification content includes "[TEST]" prefix in all channels
And the test is distinguishable from real notifications

### Acceptance Criteria

- [ ] Every channel (Toast, Banner, Badge, Email, Webhook) has a Test button
- [ ] Test flows through the same delivery pipeline as real notifications
- [ ] Test notifications include "[TEST]" prefix in all channels
- [ ] Failed tests show specific, actionable error messages
- [ ] Test result displayed inline with timestamp
- [ ] Test does not require a real agent event to fire
- [ ] SMTP credentials stored securely (not plaintext JSON)

### Technical Notes (Optional)

- Test creates a synthetic event payload with type "test" and routes through normal dispatch
- Webhook test must handle timeouts (suggest 10-second timeout)
- SMTP password stored via OS credential manager or encrypted config
- Test button disabled while test is in progress (prevents double-send)

### Job Story Traceability

- JS-06: Notification Confidence

---

## US-NOTIF-04: Do Not Disturb

### Problem

Keiko Tanaka is a tech lead whose notification sound fired during a client demo. She had to apologize and manually mute her entire Windows audio, losing all app sounds. She needs a way to suppress Norbert notifications during meetings without affecting the rest of her system, and she needs it to re-enable automatically so she does not forget.

### Who

- Professional who has meetings and focus blocks | Needs temporary suppression without permanent loss | Wants automatic schedule to avoid forgetting

### Solution

Provide a Do Not Disturb mode with manual toggle (tray right-click, keyboard shortcut), scheduled activation, and configurable behavior for suppressed notifications (queue, discard, or banner-only).

### Domain Examples

#### 1: Manual DND Before Meeting -- Keiko mutes via tray

Keiko right-clicks the Norbert tray icon and selects "Do Not Disturb". The tray icon shows a pause overlay. Status bar shows "DND: On". During the next 45 minutes, 2 cost alerts and 1 session completion are queued. After the meeting, Keiko clicks the tray icon again to disable DND. Three banners appear summarizing the queued notifications.

#### 2: Scheduled DND -- Keiko's daily standup

Keiko schedules DND for Monday-Friday 09:00-10:00. On Tuesday at 09:00, DND activates automatically. At 09:37, a hook error fires but produces no sound or toast. At 10:00, DND deactivates and the queued hook error appears as a banner with a summary toast: "1 notification received while DND was active".

#### 3: Keyboard Shortcut Toggle -- Raj quick-toggles during pair programming

Raj is sharing his screen for pair programming. He presses Ctrl+Shift+D. DND activates instantly with status bar confirmation. After the session, he presses Ctrl+Shift+D again. DND deactivates and 1 queued notification is delivered.

### UAT Scenarios (BDD)

#### Scenario: Enable DND via tray right-click

Given Keiko has DND disabled
When Keiko right-clicks the Norbert tray icon and selects "Do Not Disturb"
Then DND activates immediately
And the tray icon shows a pause overlay
And the status bar shows "DND: On"

#### Scenario: DND suppresses toast and sound, queues notifications

Given DND is active with "Queue and show count badge" behavior
And "Cost threshold reached" is enabled for Toast and Banner
When the cost threshold is reached
Then no toast appears and no sound plays
And the notification is added to the DND queue
And the tray badge count increments

#### Scenario: Queued notifications delivered on DND end

Given DND has been active and 3 notifications are queued
When Keiko disables DND via tray icon
Then 3 dashboard banners appear for the queued notifications
And a summary toast shows "3 notifications received while DND was active"

#### Scenario: Scheduled DND activates automatically

Given Keiko has scheduled DND for Monday-Friday 09:00-10:00
When the system clock reaches Monday 09:00
Then DND activates automatically
And the status bar shows "DND: On (until 10:00)"
When the system clock reaches 10:00
Then DND deactivates and queued notifications are delivered

#### Scenario: DND keyboard shortcut toggle

Given DND is disabled
When Raj presses Ctrl+Shift+D
Then DND activates and the status bar shows "DND: On"
When Raj presses Ctrl+Shift+D again
Then DND deactivates and the status bar shows "DND: Off"

### Acceptance Criteria

- [ ] DND togglable from tray right-click menu, keyboard shortcut (Ctrl+Shift+D), and settings UI
- [ ] DND schedule supports per-day time ranges for weekdays
- [ ] Three DND behaviors available: queue with badge, discard silently, banner only
- [ ] Queued notifications delivered as batch when DND ends
- [ ] DND state visible in tray icon overlay and status bar
- [ ] DND state persisted across app restarts
- [ ] Summary toast shows count of queued notifications on DND end

### Technical Notes (Optional)

- Tray icon overlay requires Tauri system tray icon update API
- DND schedule evaluated against system local time every 60 seconds
- DND state must survive Norbert restarts (persisted in preferences)
- Keyboard shortcut registered as global hotkey via Tauri

### Job Story Traceability

- JS-05: Quiet Focus Time

---

## US-NOTIF-05: Webhook and Email Channel Delivery

### Problem

Keiko Tanaka is a tech lead who works primarily in Slack during the day. She misses Windows toast notifications because they appear on a monitor she is not looking at. She needs critical alerts like cost thresholds and anomalies routed directly to her team's Slack channel and to her email for after-hours escalation.

### Who

- Tech lead working across multiple tools | Needs alerts in Slack where she already works | Wants email fallback for off-hours critical events

### Solution

Provide Webhook (POST JSON) and Email (SMTP) delivery channels configurable per-event, routing selected notifications to external services.

### Domain Examples

#### 1: Cost Alert to Slack -- Keiko's api-refactor session

Keiko has "Cost threshold reached" enabled for Webhook with Slack URL configured. Session "api-refactor" reaches $25.12 against $25.00 threshold. Slack receives a POST with JSON body: `{"event": "cost_threshold_reached", "session": "api-refactor", "cost": 25.12, "threshold": 25.00, "timestamp": "2026-03-17T14:45:10Z"}`. The Slack channel shows a formatted message with cost details.

#### 2: Anomaly Alert to Email -- after-hours cost spike

Keiko has "Anomaly detected" enabled for Email. At 22:30, an anomaly detector fires on a cost spike in session "batch-process". An email arrives from norbert@company.com with subject "Norbert Alert: Anomaly Detected -- batch-process" and body containing anomaly details, session name, and timestamp.

#### 3: DES Block to Webhook -- security event routing

Raj has "DES enforcement block" enabled for Webhook with a security team Slack channel URL. DES blocks write_file in session "secure-api". The security channel receives the event with tool name, session, and timestamp.

### UAT Scenarios (BDD)

#### Scenario: Cost alert delivered to Slack webhook

Given Keiko has "Cost threshold reached" enabled for Webhook
And the Webhook channel is configured with Slack URL "https://hooks.slack.com/services/T01ABC/B02DEF/a1b2c3d4e5"
And the cost threshold is set to $25.00
When session "api-refactor" cost reaches $25.12
Then a POST request is sent to the Slack webhook URL
And the JSON payload contains event "cost_threshold_reached", cost 25.12, threshold 25.00
And the Slack channel displays the cost alert

#### Scenario: Anomaly alert delivered via email

Given Keiko has "Anomaly detected" enabled for Email
And the Email channel is configured with SMTP credentials
When an anomaly is detected for cost spike in session "batch-process"
Then an email is sent with subject "Norbert Alert: Anomaly Detected -- batch-process"
And the email body contains anomaly type, session name, and timestamp

#### Scenario: Webhook payload includes standard fields

Given any event is enabled for Webhook delivery
When the event fires
Then the webhook payload contains "event" (event type), "timestamp" (ISO 8601), and event-specific data
And the Content-Type header is "application/json"

#### Scenario: Webhook timeout does not block other channels

Given "Cost threshold reached" is enabled for Toast and Webhook
And the webhook endpoint is unresponsive
When the cost threshold is reached
Then the toast is delivered within 3 seconds
And the webhook request times out after 10 seconds
And the timeout is logged with the webhook URL

### Acceptance Criteria

- [ ] Webhook sends POST with JSON body containing event type, timestamp, and event-specific data
- [ ] Email sends via configured SMTP with event details in subject and body
- [ ] Webhook and Email delivery per-event togglable in Events grid
- [ ] Webhook timeout set to 10 seconds; failure does not block other channels
- [ ] Email supports TLS and STARTTLS encryption
- [ ] Webhook and Email failures logged and surfaced as dashboard banner

### Technical Notes (Optional)

- Webhook delivery must be async and non-blocking relative to other channels
- Email sending may require Tauri Rust backend for SMTP (no browser SMTP)
- Webhook payload schema should be documented for users building integrations
- Rate limiting consideration: do not flood webhook with rapid events (batch within 5-second window)

### Job Story Traceability

- JS-04: Notification Routing Control

---

## US-NOTIF-06: Notification Sound System

### Problem

Marcus Chen is a freelance developer who cannot distinguish Norbert notifications from other Windows sounds. When a notification fires, he does not know if it is a session completion, a cost alert, or an unrelated system sound. He wants distinct sounds per event type and the ability to add custom sounds that match his workflow.

### Who

- Power user who customizes everything | Needs auditory distinction between event types | Has custom sound files for personal workflow

### Solution

Provide per-event sound assignment from a library of built-in sounds and user-provided custom sounds, with global volume control, preview on selection, and DND integration.

### Domain Examples

#### 1: Built-in Sound Assignment -- Raj picks des-block for hook errors

Raj opens the sound picker for "Hook error detected". He sees: phosphor-ping, amber-pulse, compaction, session-complete, des-block, silence. He selects "des-block". A preview plays at 80% volume. He confirms. Future hook error notifications play "des-block".

#### 2: Custom Sound -- Marcus adds client notification sound

Marcus places "client-done.wav" in ~/.norbert/sounds/. He opens the sound picker for "Session response completed" and sees "client-done" under Custom. He selects it, hears the preview, and confirms. Now session completions play his custom sound.

#### 3: Global Volume -- Marcus lowers volume during evening work

Marcus is working late and lowers the global notification volume from 100% to 30%. All notification sounds now play at 30% regardless of per-event sound assignment.

### UAT Scenarios (BDD)

#### Scenario: Built-in sound assignment with preview

Given Raj is viewing the sound picker for "Hook error detected"
When Raj selects "des-block"
Then a preview of "des-block" plays at the current global volume
And the sound is assigned to "Hook error detected"

#### Scenario: Custom sound discovered from user directory

Given Marcus has placed "client-done.wav" in ~/.norbert/sounds/
When Marcus opens the sound picker for "Session response completed"
Then "client-done" appears under a "Custom" section
And Marcus can select it and hear a preview

#### Scenario: Global volume applies to all sounds

Given the global volume is set to 30%
When any notification sound plays
Then it plays at 30% of its original volume

#### Scenario: Silence option suppresses sound

Given Marcus sets the sound for "Agent spawned" to "silence"
When an agent spawned event fires with Toast enabled
Then the toast appears but no sound plays

#### Scenario: Missing custom sound file falls back to default

Given Marcus previously assigned "client-done.wav" to "Session response completed"
And Marcus has deleted "client-done.wav" from ~/.norbert/sounds/
When a session completion fires
Then the default sound "phosphor-ping" plays
And a dashboard banner warns "Custom sound 'client-done' not found; using default"

### Acceptance Criteria

- [ ] Six built-in sounds available: phosphor-ping, amber-pulse, compaction, session-complete, des-block, silence
- [ ] Custom sounds discovered from ~/.norbert/sounds/ in WAV, MP3, OGG formats
- [ ] Sound preview plays on selection at current global volume
- [ ] Global volume slider (0-100%) applies to all notification sounds
- [ ] "Silence" option suppresses sound while allowing visual notification
- [ ] Missing custom sound falls back to default with user notification

### Technical Notes (Optional)

- Sound playback via Web Audio API or Tauri audio plugin
- Custom sound directory scanned on settings page open and on notification delivery
- Sound files validated for supported format; unsupported files excluded with tooltip
- Built-in sounds bundled as app assets

### Job Story Traceability

- JS-04: Notification Routing Control (auditory channel)

---

## US-NOTIF-07: Plugin Registration and Status Bar

### Problem

Raj Patel has Norbert running on a secondary monitor and needs a quick glance indicator of notification status without opening settings. He wants to see whether DND is active and how many unread notifications are waiting, visible at all times in the status bar.

### Who

- Daily user with Norbert on secondary monitor | Needs at-a-glance status | Does not want to open settings to check notification state

### Solution

norbert-notif registers as a Norbert plugin with manifest, sidebar tab, settings section, and a status bar item showing DND state and unread count.

### Domain Examples

#### 1: Status Bar Shows DND Off with Unread Count

Raj glances at the Norbert status bar. It shows "norbert-notif | DND: Off | 2 unread". He knows two notifications are waiting but no DND is active.

#### 2: Status Bar Shows DND Active with Timer

Keiko has scheduled DND until 10:00. The status bar shows "norbert-notif | DND: On (until 10:00) | Queued: 3". She knows DND will auto-end and 3 events are waiting.

#### 3: Plugin Load and Registration

On Norbert startup, norbert-notif loads via the plugin lifecycle. It registers hook processors for all 14 events, a sidebar tab, a settings section under Notifications, and a status bar item. The sidebar shows a bell icon with "Notifications" label.

### UAT Scenarios (BDD)

#### Scenario: Status bar shows DND state and unread count

Given norbert-notif is loaded and DND is off
And 2 banner notifications are undismissed
Then the status bar item shows "DND: Off" and "2 unread"

#### Scenario: Status bar updates on DND toggle

Given the status bar shows "DND: Off"
When Raj toggles DND on
Then the status bar updates to "DND: On"
When Raj toggles DND off
Then the status bar updates to "DND: Off"

#### Scenario: Plugin registers on Norbert startup

Given Norbert starts with norbert-notif plugin enabled
When the plugin lifecycle loads norbert-notif
Then hook processors are registered for all 14 notification events
And a status bar item is registered with position "left"
And a sidebar tab is registered with bell icon and label "Notifications"

#### Scenario: Settings section has sec-hdr title

Given Raj navigates to Settings then Notifications
Then the section displays a sec-hdr title area reading "Notifications"
And sub-sections Events, Channels, and Do Not Disturb are available

### Acceptance Criteria

- [ ] norbert-notif registers as NorbertPlugin with manifest (id, name, version, norbert_api, dependencies)
- [ ] Hook processors registered for all 14 event types on load
- [ ] Status bar item shows DND state and unread notification count
- [ ] Settings section has sec-hdr title "Notifications" with three sub-sections
- [ ] Plugin loads with no dependencies (standalone, ships bundled)

### Technical Notes (Optional)

- Manifest: id "norbert-notif", version "1.0.0", norbert_api ">=1.0", dependencies {}
- Status bar item registered via NorbertAPI.ui.registerStatusItem with position "left"
- Status bar item dynamically updated via StatusItemHandle.update()
- Sidebar tab registered with order value placing it after session and usage tabs

### Job Story Traceability

- JS-01: Aware of Agent Completion (infrastructure enabling all notification delivery)

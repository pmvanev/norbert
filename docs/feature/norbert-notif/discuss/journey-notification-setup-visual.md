# Journey: Notification Setup and Event Delivery

## Journey Overview

```
[Trigger]          [Step 1]          [Step 2]           [Step 3]          [Step 4]          [Goal]
First launch    -> Open Settings  -> Configure Events -> Test Channel  -> Receive Alert -> Confident
or event missed    Ctrl+, Notif      Toggle + Route      Send test        Real event       awareness

Feels: Curious     Feels: Oriented   Feels: In control   Feels: Verified   Feels: Informed   Feels: Confident
       or anxious         clear              capable             relieved          calm              trusting
```

---

## Step 1: Open Notification Settings

### Emotional State

- Entry: Curious (first launch) or Frustrated (missed an event)
- Exit: Oriented -- "I can see all the events and channels available"

### Desktop Mockup

```
+============================================================================+
| Norbert                                                    _ [] X          |
+============================================================================+
|      |                                                                     |
| [S]  | +-- Settings ---------------------------------------------------+  |
| [U]  | | sec-hdr                                                        |  |
| [C]  | | Notifications                                                 |  |
| ---  | +----------------------------------------------------------------+  |
| [*]  | |                                                                |  |
|      | | +-- Sidebar ----------+ +-- Content -------------------------+ |  |
|      | | |                     | |                                     | |  |
|      | | |  > Events           | | Events | Channels | Do Not Disturb | |  |
|      | | |    Channels         | |                                     | |  |
|      | | |    Do Not Disturb   | | Event                     Toast  Banner  Badge  Sound       | |  |
|      | | |                     | | -------------------------------------------------------     | |  |
|      | | |                     | | Session response completed  [x]   [ ]    [ ]    phosphor-ping    | |  |
|      | | |                     | | Session started              [ ]   [ ]    [ ]    silence          | |  |
|      | | |                     | | Context compaction occurred   [x]   [ ]    [ ]    compaction       | |  |
|      | | |                     | | Token count threshold        [ ]   [ ]    [ ]    silence          | |  |
|      | | |                     | |   Threshold: [____10000___] tokens                                 | |  |
|      | | |                     | | Cost threshold reached       [x]   [x]   [x]    amber-pulse       | |  |
|      | | |                     | |   Threshold: [$___5.00____]                                        | |  |
|      | | |                     | | Context window % threshold   [x]   [ ]    [ ]    amber-pulse       | |  |
|      | | |                     | |   Threshold: [__75__]%                                             | |  |
|      | | |                     | | Hook error detected          [x]   [x]   [x]    des-block         | |  |
|      | | |                     | | Hook timeout                 [x]   [x]   [ ]    des-block         | |  |
|      | | |                     | | DES enforcement block        [x]   [x]   [x]    des-block         | |  |
|      | | |                     | | Agent spawned                [ ]   [ ]    [ ]    silence          | |  |
|      | | |                     | | Agent completed              [ ]   [ ]    [ ]    silence          | |  |
|      | | |                     | | Anomaly detected             [x]   [x]   [x]    amber-pulse       | |  |
|      | | |                     | | Session digest ready         [ ]   [ ]    [ ]    silence          | |  |
|      | | |                     | | Credit balance low           [x]   [x]   [x]    amber-pulse       | |  |
|      | | +---------------------+ +-------------------------------------+ |  |
|      | +----------------------------------------------------------------+  |
+============================================================================+
| norbert-notif | DND: Off  |  3 events active today                        |
+============================================================================+
```

### Integration Checkpoint

- Settings section registered by norbert-notif plugin via NorbertAPI.ui
- Event list populated from norbert-notif's internal event registry
- Default toggles match product spec defaults

---

## Step 2: Configure Events and Channels

### Emotional State

- Entry: Oriented -- "I see the grid"
- Exit: In control -- "I have set up exactly what I want"

### Desktop Mockup (Channel Configuration Sub-section)

```
+-- Settings / Notifications / Channels ----------------------------------+
| sec-hdr                                                                  |
| Notification Channels                                                    |
+--------------------------------------------------------------------------+
|                                                                          |
| Windows Notification Center (OS Toast)                                   |
| Status: Active [*]                    [ Test ]                           |
|                                                                          |
| Norbert Dashboard Banner                                                 |
| Status: Active [*]                    [ Test ]                           |
|                                                                          |
| Tray Icon Badge                                                          |
| Style: [ Colored dot v ]  Color: amber                                   |
| Status: Active [*]                    [ Test ]                           |
|                                                                          |
| ---- Advanced Channels ------------------------------------------------- |
|                                                                          |
| Email (SMTP)                                                             |
| SMTP Host: [________________]  Port: [____]                              |
| Username:  [________________]  Password: [********]                      |
| From:      [________________]  To: [________________]                    |
| Encryption: ( ) None  (*) TLS  ( ) STARTTLS                             |
| Status: Not configured               [ Test ]                           |
|                                                                          |
| Webhook                                                                  |
| URL: [____________________________________________]                      |
| Method: POST  Content-Type: application/json                             |
| Status: Not configured               [ Test ]                           |
|                                                                          |
+--------------------------------------------------------------------------+
```

### Integration Checkpoint

- Channel configuration persisted via norbert-notif's config store
- SMTP credentials stored securely (not in plaintext JSON)
- Webhook URL validated for HTTPS on save

---

## Step 3: Test a Channel

### Emotional State

- Entry: Hopeful -- "I think this is right"
- Exit: Verified -- "I saw the test notification arrive; it works"

### Desktop Mockup (Test Notification Flow)

```
+-- Test Notification ---------------------------------------------------+
|                                                                         |
|  [ Test ] clicked for "Windows Notification Center"                     |
|                                                                         |
|  Sending test notification...                                           |
|  [========================================] Done                        |
|                                                                         |
|  Result: Delivered successfully                                         |
|  Sent: "Test notification from Norbert" at 2026-03-17 14:32:05         |
|                                                                         |
+-------------------------------------------------------------------------+

Windows OS Toast (appears in Action Center):
+------------------------------------------+
| Norbert                                  |
| Test Notification                        |
| This is a test from Norbert Notification |
| Center. If you see this, the channel is  |
| working correctly.                       |
+------------------------------------------+
```

### Integration Checkpoint

- Test button fires a synthetic event through the full delivery pipeline
- Test notification clearly labeled as "[TEST]" in all channels
- Result displayed inline with success/failure status and timestamp

---

## Step 4: Receive a Real Notification

### Emotional State

- Entry: Working on something else; agent running in background
- Exit: Informed and calm -- "Session finished, I can go check now"

### Desktop Mockup (Dashboard Banner)

```
+============================================================================+
| Norbert                                                    _ [] X          |
+============================================================================+
|      | +-- Notification Banner ----------------------------------------+  |
| [S]  | | [!] Session response completed - project-alpha (14:47:22)  [x]|  |
| [U]  | +--------------------------------------------------------------+  |
| [C]  | +-- Notification Banner ----------------------------------------+  |
| ---  | | [!] Cost threshold reached - $5.12 of $5.00 limit (14:45:10)[x]|  |
| [*]  | +--------------------------------------------------------------+  |
|      |                                                                     |
|      | +-- Session View -----------------------------------------------+  |
|      | | ...                                                           |  |
|      | +---------------------------------------------------------------+  |
+============================================================================+
| norbert-notif | DND: Off  |  2 unread                                     |
+============================================================================+

Tray Icon:
  [N] with amber dot

Windows OS Toast:
+------------------------------------------+
| Norbert                              14m |
| Session Response Completed               |
| project-alpha session finished.          |
| Duration: 4m 32s | Cost: $5.12          |
+------------------------------------------+
```

### Integration Checkpoint

- Event arrives via hook bridge from norbert-session or norbert-usage plugin
- norbert-notif checks user preferences for that event type
- Dispatches to enabled channels only
- DND status checked before any audible or visual delivery
- Banner persists until dismissed; badge count reflects unread banners

---

## Step 5: Do Not Disturb

### Emotional State

- Entry: About to enter a meeting or focus block
- Exit: Safe -- "Notifications are paused; I will not be interrupted"

### Desktop Mockup (DND Toggle and Schedule)

```
+-- Settings / Notifications / Do Not Disturb ----------------------------+
| sec-hdr                                                                  |
| Do Not Disturb                                                           |
+--------------------------------------------------------------------------+
|                                                                          |
| Global Mute: [ ] Enable Do Not Disturb                                   |
|                                                                          |
| Quick Toggle: Right-click tray icon > Do Not Disturb                     |
| Keyboard Shortcut: Ctrl+Shift+D                                          |
|                                                                          |
| ---- Schedule ---------------------------------------------------------- |
|                                                                          |
| Enable scheduled DND: [x]                                               |
|                                                                          |
| Schedule:                                                                |
| +------+--------+--------+                                              |
| | Day  | Start  | End    |                                              |
| +------+--------+--------+                                              |
| | Mon  | 09:00  | 10:00  |  [x]                                        |
| | Tue  | 09:00  | 10:00  |  [x]                                        |
| | Wed  | 09:00  | 10:00  |  [x]                                        |
| | Thu  | 09:00  | 10:00  |  [x]                                        |
| | Fri  | 09:00  | 10:00  |  [x]                                        |
| | Sat  |        |        |  [ ]                                        |
| | Sun  |        |        |  [ ]                                        |
| +------+--------+--------+                                              |
|                                                                          |
| When DND is active:                                                      |
| (*) Queue notifications and show count badge                             |
| ( ) Discard notifications silently                                       |
| ( ) Deliver to banner only (no sound or toast)                           |
|                                                                          |
+--------------------------------------------------------------------------+

Tray Icon (DND active):
  [N] with "pause" overlay

Status Bar:
+============================================================================+
| norbert-notif | DND: On (until 10:00)  |  Queued: 3                       |
+============================================================================+
```

### Integration Checkpoint

- DND state stored in norbert-notif config and checked on every dispatch
- Tray icon updated via Tauri system tray API
- Status bar item updated via NorbertAPI.ui.registerStatusItem
- Queued notifications delivered as batch when DND ends

---

## Emotional Arc Summary

```
Curious/Anxious --> Oriented --> In Control --> Verified --> Informed --> Confident
     |                |              |              |             |            |
  "I missed       "I see all     "I chose       "The test     "Alert      "This
   an event"       my options"    what I want"   worked!"     arrived!"    system
                                                                          works for me"
```

### Arc Pattern: Confidence Building

- Start: Anxious or Curious -- user either missed an event (push) or is exploring a new feature
- Middle: Progressive control -- each configuration step builds confidence
- Peak Tension: Testing the channel -- "will this actually work?"
- Resolution: Receiving a real notification -- the system delivers on its promise
- End: Trust -- user stops thinking about notifications because they just work

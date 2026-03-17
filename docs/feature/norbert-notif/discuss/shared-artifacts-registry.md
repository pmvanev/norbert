# Shared Artifacts Registry: norbert-notif

## Artifact Inventory

### event_registry

- **Source of truth**: norbert-notif/domain/eventRegistry (TypeScript const array of event definitions)
- **Consumers**:
  - Settings Events grid (display event names and descriptions)
  - Hook bridge event matching (map incoming hook events to notification events)
  - Notification dispatch engine (look up event by ID to check preferences)
  - Test notification sender (use event metadata for test payload)
- **Owner**: norbert-notif plugin
- **Integration risk**: HIGH -- if event IDs in registry do not match hook event names, notifications silently fail
- **Validation**: Every hook event name delivered by norbert-session, norbert-usage, or other plugins must have a corresponding entry in the event registry

### default_toggles

- **Source of truth**: norbert-notif/domain/defaults (TypeScript record mapping event IDs to default channel/sound states)
- **Consumers**:
  - Settings Events grid initial state (first-launch defaults)
  - First-run configuration (populate preferences on first load)
- **Owner**: norbert-notif plugin
- **Integration risk**: MEDIUM -- defaults only apply on first launch; mismatch with spec is a UX issue, not a runtime failure
- **Validation**: Default values match product spec table (session-complete=On, session-started=Off, etc.)

### user_preferences

- **Source of truth**: norbert-notif/config/preferences.json (persisted to user's config directory)
- **Consumers**:
  - Settings Events grid (read/write toggle states and thresholds)
  - Notification dispatch engine (consult on every event to determine delivery)
  - DND behavior mode (queue vs discard vs banner-only)
  - Sound playback (per-event sound assignment)
- **Owner**: norbert-notif plugin
- **Integration risk**: HIGH -- corrupt or missing preferences file must fall back to defaults, not crash
- **Validation**: Preferences file schema validated on load; invalid entries reset to defaults with user notification

### threshold_values

- **Source of truth**: norbert-notif/config/preferences.json (nested under event-specific entries)
- **Consumers**:
  - Settings Events grid threshold inputs (display and edit)
  - Threshold evaluation in dispatch engine (compare event value against threshold)
  - Status bar summary (show active threshold counts)
- **Owner**: norbert-notif plugin
- **Integration risk**: HIGH -- threshold mismatch between settings display and dispatch evaluation would cause user to see one value but be alerted on another
- **Validation**: Single read path for thresholds shared by settings UI and dispatch engine

### channel_config

- **Source of truth**: norbert-notif/config/channels.json (persisted to user's config directory)
- **Consumers**:
  - Settings Channels sub-section (display and edit)
  - Notification dispatch engine (look up channel endpoints for delivery)
  - Test notification sender (use same config to send test)
- **Owner**: norbert-notif plugin
- **Integration risk**: HIGH -- SMTP credentials and webhook URLs must be read from the same source by both settings and dispatch
- **Validation**: Channel config validated on save (URL format, required SMTP fields); test button exercises the same path as real delivery

### dnd_state

- **Source of truth**: norbert-notif/domain/dndManager (runtime state) backed by preferences.json (persisted state)
- **Consumers**:
  - Notification dispatch engine gate check (suppress delivery when active)
  - Tray icon overlay (show pause indicator)
  - Status bar DND indicator (show "DND: On/Off")
  - Settings DND toggle (read/write)
  - Keyboard shortcut handler (toggle)
- **Owner**: norbert-notif plugin
- **Integration risk**: HIGH -- if dispatch engine reads a stale DND state, notifications may be delivered during DND or suppressed after DND ends
- **Validation**: DND state changes propagate to all consumers within same event loop tick; tray icon, status bar, and dispatch engine all react to the same state change event

### dnd_schedule

- **Source of truth**: norbert-notif/config/preferences.json (schedule entries)
- **Consumers**:
  - DND scheduler (evaluate against system clock)
  - Settings DND schedule grid (display and edit)
- **Owner**: norbert-notif plugin
- **Integration risk**: MEDIUM -- schedule evaluation uses system clock; timezone changes or clock skew could cause incorrect activation
- **Validation**: Schedule times stored as local time with timezone offset; scheduler evaluates every minute

### badge_count

- **Source of truth**: norbert-notif/domain/badgeTracker (runtime counter)
- **Consumers**:
  - Tray icon badge (display count or dot)
  - Status bar item (display unread count)
  - Dashboard banner list (count of undismissed banners)
- **Owner**: norbert-notif plugin
- **Integration risk**: MEDIUM -- badge count must decrement when banner is dismissed; stale count causes confusion
- **Validation**: Badge count derived from banner list length; dismissing a banner recalculates count

### sound_library

- **Source of truth**: norbert-notif/assets/sounds/ (built-in) and ~/.norbert/sounds/ (custom)
- **Consumers**:
  - Sound picker in Settings Events grid
  - Sound playback engine (on notification delivery)
- **Owner**: norbert-notif plugin
- **Integration risk**: LOW -- missing custom sound file falls back to default; user notified
- **Validation**: Sound files validated for supported format (WAV, MP3, OGG) on discovery; invalid files excluded from picker with tooltip explanation

### global_volume

- **Source of truth**: norbert-notif/config/preferences.json
- **Consumers**:
  - Volume slider in Settings
  - Sound playback engine (applied as multiplier)
  - Sound preview (plays at current volume)
- **Owner**: norbert-notif plugin
- **Integration risk**: LOW -- volume is a simple numeric value
- **Validation**: Clamped to 0-100 range on save

---

## Integration Checkpoints

### Checkpoint 1: Event Registry to Hook Bridge

- norbert-notif registers hook processors for each event in event_registry
- Hook bridge delivers events using the same hook names
- **Test**: fire each hook event name and verify norbert-notif receives it

### Checkpoint 2: Preferences to Dispatch

- Settings UI writes to preferences.json
- Dispatch engine reads from preferences.json
- **Test**: change a toggle in settings, fire the event, verify delivery matches new toggle state

### Checkpoint 3: Channel Config to Delivery Pipeline

- Settings UI writes channel config
- Test button reads same config
- Real dispatch reads same config
- **Test**: configure webhook URL in settings, send test, send real event -- all hit the same URL

### Checkpoint 4: DND State Propagation

- DND toggle/schedule changes dndManager state
- Dispatch engine checks dndManager state on every event
- Tray icon and status bar reflect dndManager state
- **Test**: enable DND, fire event, verify suppressed; disable DND, verify queued events delivered

### Checkpoint 5: Badge Count Consistency

- Badge count equals number of undismissed banners
- Dismissing a banner decrements badge count
- DND queue adds to badge count
- **Test**: fire 3 events, verify badge shows 3; dismiss 1 banner, verify badge shows 2

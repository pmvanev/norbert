# Component Boundaries: norbert-notif

## Plugin Boundary

norbert-notif interacts with Norbert exclusively through the NorbertAPI contract:
- `api.hooks.register()` -- register hook processors for event types
- `api.ui.registerView()` -- register settings and banner views
- `api.ui.registerTab()` -- register sidebar tab
- `api.ui.registerStatusItem()` -- register status bar item with DND/count

No direct imports from other plugins or Norbert host internals. Follows ADR-014 sandbox enforcement.

---

## Internal Component Map

```
src/plugins/norbert-notif/
  manifest.ts              -- Plugin manifest (id, version, dependencies)
  index.ts                 -- Plugin entry point (onLoad, onUnload)

  domain/                  -- Pure core (no effects, no imports from adapters)
    eventRegistry.ts       -- 14 event type definitions
    defaults.ts            -- Default preference values per event
    dispatchEngine.ts      -- (event, prefs, dndState) -> DispatchInstruction[]
    dndManager.ts          -- (schedule, time, toggle) -> DndState
    badgeTracker.ts        -- (count, action) -> count
    soundLibrary.ts        -- (builtIn, custom) -> merged sound list
    preferenceValidator.ts -- (raw) -> Result<ValidatedPreferences, ValidationError[]>
    types.ts               -- All domain types (NotificationEvent, Preferences, etc.)

  ports/                   -- Function signature types (driven ports)
    preferencesPort.ts     -- read/write preferences
    toastPort.ts           -- send OS toast
    smtpPort.ts            -- send email
    webhookPort.ts         -- send HTTP POST
    soundPort.ts           -- play sound at volume
    trayPort.ts            -- update tray badge/overlay

  adapters/                -- Effect boundary implementations
    jsonPreferenceStore.ts -- Preferences port via Tauri IPC + fs
    tauriToastAdapter.ts   -- Toast port via Tauri notification IPC
    tauriTrayAdapter.ts    -- Tray port via Tauri tray IPC
    rustSmtpAdapter.ts     -- SMTP port via Tauri IPC to Rust lettre
    rustWebhookAdapter.ts  -- Webhook port via Tauri IPC to Rust reqwest
    webAudioAdapter.ts     -- Sound port via Web Audio API
    customSoundScanner.ts  -- Scans ~/.norbert/sounds/ via Tauri IPC

  views/                   -- React UI components (effect boundary)
    EventsGrid.tsx         -- Per-event toggle grid with thresholds and sounds
    ChannelsConfig.tsx     -- Channel setup forms with Test buttons
    DndSettings.tsx        -- DND toggle, schedule, behavior config
    NotificationBanner.tsx -- In-app notification banners
    SoundPicker.tsx        -- Sound dropdown with preview
    StatusBarItem.tsx      -- Status bar content (DND state + unread count)
```

---

## Dependency Rules

### Inward dependencies only

```
views/ -> domain/, ports/    (views use domain types and call through ports)
adapters/ -> ports/          (adapters implement port function signatures)
domain/ -> (nothing)         (pure core has no outward dependencies)
ports/ -> domain/            (ports reference domain types in signatures)
index.ts -> domain/, ports/, adapters/, views/  (composition root wires everything)
```

### What each layer may NOT do

| Layer | Prohibited |
|-------|-----------|
| domain/ | Import from adapters/, views/, Tauri, React, Node APIs, fs, fetch |
| ports/ | Import from adapters/, views/; contain implementation logic |
| adapters/ | Import from domain/ directly (only through ports/); import from other adapters |
| views/ | Import from adapters/ directly; call Tauri IPC directly (use ports) |

### Composition Root (index.ts)

The `onLoad` function in `index.ts` is the only place where adapters are instantiated and injected into domain functions via port parameters. This is the effect shell wrapping the pure core.

---

## Responsibility Boundaries

### norbert-notif owns

- 14 notification event type definitions
- User preference storage and validation
- Dispatch logic (event + prefs + DND -> channel instructions)
- DND state management (toggle, schedule, queue)
- Badge count tracking
- Settings UI for notifications (Events, Channels, DND)
- In-app banner rendering
- Sound library management (built-in + custom)
- Test notification flow

### norbert-notif does NOT own

- Hook event delivery infrastructure (hook bridge, owned by plugin host)
- Session/cost/error event production (owned by norbert-session, norbert-usage, norbert-config)
- System tray icon lifecycle (owned by Tauri backend; norbert-notif only updates badge/overlay)
- OS notification permission management (delegated to Tauri plugin)
- SMTP protocol implementation (delegated to Rust lettre crate)
- Webhook HTTP client (delegated to Rust reqwest crate)

---

## Integration Boundaries with Other Plugins

### Events received from other plugins (via hook bridge)

| Source Plugin | Hook Name | Notification Events Mapped |
|--------------|-----------|---------------------------|
| norbert-session | session-event | session_started, session_completed, context_compaction, agent_spawned, agent_completed |
| norbert-usage | usage-event | cost_threshold, token_threshold, context_window_threshold, credit_balance_low |
| norbert-config | config-event | hook_error, hook_timeout |
| nWave (optional) | des-event | des_enforcement_block |
| anomaly detector | anomaly-event | anomaly_detected |
| digest generator | digest-event | session_digest_ready |

### No cross-plugin API dependency

norbert-notif declares `dependencies: {}` in its manifest. It does not call `api.plugins.get()` for any other plugin. All inter-plugin communication flows through the hook bridge -- norbert-notif registers processors and receives events. This ensures it loads independently and has no ordering constraint except being after the plugin host.

---

## Rust Backend Boundary

New IPC commands live in `src-tauri/src/` as Tauri command functions. They are thin adapters:

| Command | Boundary |
|---------|----------|
| `send_os_notification(title, body)` | Delegates to `tauri-plugin-notification` |
| `send_smtp_email(config, subject, body)` | Delegates to `lettre`, returns Result |
| `send_webhook(url, payload, timeout_ms)` | Delegates to `reqwest`, returns Result |
| `update_tray_badge(badge_type, count)` | Updates tray icon overlay via Tauri API |
| `read_notif_preferences(plugin_dir)` | Reads JSON file, returns content string |
| `write_notif_preferences(plugin_dir, content)` | Writes JSON file, returns Result |
| `scan_custom_sounds(sounds_dir)` | Lists audio files, returns filename array |

These commands contain no business logic. All notification logic lives in the TypeScript domain layer.

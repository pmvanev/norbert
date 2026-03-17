# Definition of Ready Validation: norbert-notif

## Story: US-NOTIF-01 (Event Notification Delivery)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Raj wastes 15 minutes/day polling for session completion; domain language used |
| User/persona identified | PASS | Raj Patel, senior dev, daily Claude Code user, works in VS Code while agent runs |
| 3+ domain examples | PASS | 3 examples: session completion toast, cost threshold multi-channel, hook error |
| UAT scenarios (3-7) | PASS | 5 scenarios covering happy path, multi-channel, error context, disabled event, channel failure |
| AC derived from UAT | PASS | 6 AC items derived from scenario outcomes |
| Right-sized | PASS | Core dispatch engine + 3 built-in channels (toast, banner, badge); ~3 days, 5 scenarios |
| Technical notes | PASS | Hook bridge integration, Tauri notification API, failure isolation documented |
| Dependencies tracked | PASS | Depends on hook bridge (existing), Tauri notification API (platform), norbert-notif plugin registration (US-NOTIF-07) |

### DoR Status: PASSED

---

## Story: US-NOTIF-02 (Event and Channel Configuration)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Keiko overwhelmed by uniform notifications; needs per-event control |
| User/persona identified | PASS | Keiko Tanaka, tech lead, monitors team costs, needs granularity |
| 3+ domain examples | PASS | 3 examples: toggle banner, change cost threshold, custom sound assignment |
| UAT scenarios (3-7) | PASS | 5 scenarios: enable channel, change threshold, invalid threshold, custom sound, default verification |
| AC derived from UAT | PASS | 7 AC items covering grid display, thresholds, sounds, persistence, defaults |
| Right-sized | PASS | Settings UI for events grid; ~2 days, 5 scenarios |
| Technical notes | PASS | Settings registration, JSON persistence, sound file discovery documented |
| Dependencies tracked | PASS | Depends on NorbertAPI.ui settings registration (existing), norbert-notif plugin (US-NOTIF-07) |

### DoR Status: PASSED

---

## Story: US-NOTIF-03 (Channel Setup and Testing)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Marcus mistyped webhook URL, discovered 2 days later when real alert should have fired |
| User/persona identified | PASS | Marcus Chen, freelancer, power user, needs channel confidence |
| 3+ domain examples | PASS | 3 examples: successful webhook test, failed webhook test, SMTP test |
| UAT scenarios (3-7) | PASS | 5 scenarios: success, failure with error, SMTP failure, toast test, test labeling |
| AC derived from UAT | PASS | 7 AC items covering test button, pipeline, labeling, errors, security |
| Right-sized | PASS | Channel config forms + test button flow; ~2 days, 5 scenarios |
| Technical notes | PASS | Synthetic event, timeout handling, credential security documented |
| Dependencies tracked | PASS | Depends on notification dispatch (US-NOTIF-01), channel config artifact |

### DoR Status: PASSED

---

## Story: US-NOTIF-04 (Do Not Disturb)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Keiko's notification sound fired during client demo; had to mute entire Windows audio |
| User/persona identified | PASS | Keiko Tanaka, tech lead, has meetings, needs temporary suppression with auto-resume |
| 3+ domain examples | PASS | 3 examples: manual tray toggle, scheduled DND, keyboard shortcut toggle |
| UAT scenarios (3-7) | PASS | 5 scenarios: tray toggle, suppression/queuing, delivery on end, schedule, keyboard shortcut |
| AC derived from UAT | PASS | 7 AC items covering toggle methods, schedule, behaviors, persistence, summary |
| Right-sized | PASS | DND toggle + schedule + queue behavior; ~3 days, 5 scenarios |
| Technical notes | PASS | Tray icon API, schedule evaluation, persistence, global hotkey documented |
| Dependencies tracked | PASS | Depends on notification dispatch (US-NOTIF-01), tray icon (Tauri system tray), status bar (US-NOTIF-07) |

### DoR Status: PASSED

---

## Story: US-NOTIF-05 (Webhook and Email Channel Delivery)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Keiko misses toasts on wrong monitor; needs alerts in Slack and email |
| User/persona identified | PASS | Keiko Tanaka, works in Slack, needs external channel routing |
| 3+ domain examples | PASS | 3 examples: cost alert to Slack, anomaly to email, DES block to security channel |
| UAT scenarios (3-7) | PASS | 4 scenarios: Slack webhook, email, payload format, timeout isolation |
| AC derived from UAT | PASS | 6 AC items covering payload format, SMTP, per-event toggle, timeout, encryption, logging |
| Right-sized | PASS | Webhook + Email delivery adapters; ~2 days, 4 scenarios |
| Technical notes | PASS | Async delivery, Rust SMTP, payload schema, rate limiting documented |
| Dependencies tracked | PASS | Depends on dispatch engine (US-NOTIF-01), channel config (US-NOTIF-03), Tauri Rust backend |

### DoR Status: PASSED

---

## Story: US-NOTIF-06 (Notification Sound System)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Marcus cannot distinguish Norbert sounds from other Windows sounds |
| User/persona identified | PASS | Marcus Chen, power user, wants auditory distinction per event type |
| 3+ domain examples | PASS | 3 examples: built-in assignment, custom sound, global volume |
| UAT scenarios (3-7) | PASS | 5 scenarios: built-in preview, custom discovery, volume, silence, missing fallback |
| AC derived from UAT | PASS | 6 AC items covering built-in library, custom sounds, preview, volume, silence, fallback |
| Right-sized | PASS | Sound library + picker + volume control; ~2 days, 5 scenarios |
| Technical notes | PASS | Web Audio API, file scanning, format validation, asset bundling documented |
| Dependencies tracked | PASS | Depends on event configuration (US-NOTIF-02), audio API (Web Audio or Tauri) |

### DoR Status: PASSED

---

## Story: US-NOTIF-07 (Plugin Registration and Status Bar)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Raj needs quick glance indicator of notification status without opening settings |
| User/persona identified | PASS | Raj Patel, daily user, Norbert on secondary monitor, needs at-a-glance status |
| 3+ domain examples | PASS | 3 examples: status bar with DND off, status bar with DND timer, plugin load/registration |
| UAT scenarios (3-7) | PASS | 4 scenarios: status bar display, DND update, plugin registration, settings sec-hdr |
| AC derived from UAT | PASS | 5 AC items covering manifest, hook registration, status bar, settings, standalone load |
| Right-sized | PASS | Plugin scaffold + registration + status bar; ~1 day, 4 scenarios |
| Technical notes | PASS | Manifest fields, status bar API, sidebar tab order documented |
| Dependencies tracked | PASS | No plugin dependencies (standalone); depends on NorbertAPI contract (existing) |

### DoR Status: PASSED

---

## Summary

| Story | DoR Status | Est. Days | Scenarios |
|-------|-----------|-----------|-----------|
| US-NOTIF-01 | PASSED | 3 | 5 |
| US-NOTIF-02 | PASSED | 2 | 5 |
| US-NOTIF-03 | PASSED | 2 | 5 |
| US-NOTIF-04 | PASSED | 3 | 5 |
| US-NOTIF-05 | PASSED | 2 | 4 |
| US-NOTIF-06 | PASSED | 2 | 5 |
| US-NOTIF-07 | PASSED | 1 | 4 |
| **Total** | **ALL PASSED** | **~15** | **33** |

### MoSCoW Prioritization

| Priority | Stories |
|----------|---------|
| Must Have | US-NOTIF-07 (plugin registration), US-NOTIF-01 (core delivery), US-NOTIF-02 (event config) |
| Should Have | US-NOTIF-03 (test button), US-NOTIF-04 (DND), US-NOTIF-06 (sounds) |
| Could Have | US-NOTIF-05 (webhook/email channels) |

### Recommended Build Order

1. US-NOTIF-07 -- Plugin scaffold, manifest, hook registration, status bar (foundation)
2. US-NOTIF-01 -- Core dispatch engine, toast/banner/badge delivery (core value)
3. US-NOTIF-02 -- Settings UI with events grid and toggles (user control)
4. US-NOTIF-06 -- Sound system with picker and volume (auditory feedback)
5. US-NOTIF-03 -- Channel test button (confidence building)
6. US-NOTIF-04 -- Do Not Disturb (noise management)
7. US-NOTIF-05 -- Webhook and Email channels (advanced routing)

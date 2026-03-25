# JTBD Analysis: hook-receiver-clarity

## Feature Classification

**Job Type**: Brownfield — improve existing system (hook receiver already exists; adding metadata and UI affordances)
**Workflow**: `[research] -> discuss -> design -> distill -> baseline -> ...`
**Discovery depth**: Lightweight — single persona, single happy path, decisions pre-answered

---

## Persona: Dev Danielle

**Name**: Danielle Reyes
**Role**: Software developer using Claude Code on Windows daily
**Context**: Runs Norbert on her development machine. The hook receiver starts automatically at login via the Windows Startup folder and runs invisibly in the background, capturing Claude Code telemetry. Danielle uses Task Manager to check resource usage and to debug startup slowdowns.

**Characteristics**:
- Technically literate; comfortable with Windows Task Manager, system tray
- Not a Norbert expert — she did not write it, she uses it
- Expects background processes to be identifiable and controllable
- Has encountered the "two Norbert processes" problem when troubleshooting

---

## Job Stories

### JS-01: Process Identity in Task Manager

**When** I open Task Manager to investigate high CPU or memory usage and see multiple processes named "Norbert",
**I want to** immediately know which process is the main GUI app and which is the background hook receiver,
**so I can** take the right action (kill the sidecar, not the GUI; or diagnose the correct process) without guessing.

#### Functional Job
Distinguish `norbert-hook-receiver.exe` from `norbert.exe` at a glance in Windows Task Manager.

#### Emotional Job
Feel confident and in control when managing background processes — not confused or anxious about killing the wrong process.

#### Social Job
Not embarrassed by asking "which Norbert is which?" on a team. Be perceived as someone who knows their own tooling.

#### Forces Analysis

**Push** (demand-generating frustration):
- Both processes show as "Norbert" in Task Manager — no way to distinguish them without checking the executable path
- Killing the wrong process terminates the main GUI unexpectedly
- Investigating memory leaks requires knowing which process to inspect

**Pull** (demand-generating attraction):
- A distinct FileDescription ("Norbert Hook Receiver") appears immediately in Task Manager's Description column
- Zero learning curve — Windows standard metadata, familiar UX pattern
- Works without running the app itself; visible even if main GUI crashes

**Anxiety** (demand-reducing):
- "Will changing build metadata break anything?" — no, VERSIONINFO is read-only metadata
- "Will the exe name still work in the Startup shortcut?" — yes, exe filename is unchanged

**Habit** (demand-reducing):
- Current workaround: hover over process in Task Manager → check "Command line" column for path — slow, non-obvious
- Habit strength: LOW — this is friction that frustrates Danielle, not a workflow she likes

**Force Balance**: Strong Push + Strong Pull, Low Anxiety, Low Habit resistance → HIGH motivation to adopt

---

### JS-02: Hook Receiver Visibility and Status

**When** I want to know whether the hook receiver is running, what port it is listening on, and how many events it has captured today,
**I want to** see a system tray icon with a right-click status menu and tooltip,
**so I can** confirm the sidecar is healthy, know where it is listening, and quit it gracefully without opening Task Manager.

#### Functional Job
Monitor and control the hook receiver's operational state from the Windows system tray.

#### Emotional Job
Feel reassured that Norbert's background data capture is working — not anxious about silent failures. Feel in control with a visible "quit" option.

#### Social Job
Demonstrate to teammates that the tool is professionally built — not a mystery black-box process.

#### Forces Analysis

**Push**:
- No visible indicator when hook receiver crashes silently — Danielle loses telemetry for hours without knowing
- Must open Task Manager just to confirm the process is alive
- No graceful shutdown — must kill via Task Manager (risk of data loss if write is in flight)

**Pull**:
- System tray icon is the Windows idiom for "I am running in the background" — immediately recognizable
- Tooltip shows port + event count at a glance
- Right-click Quit triggers clean shutdown (flush SQLite writes, close port)

**Anxiety**:
- "Will the tray icon consume too many resources for a headless server process?" — must be validated; expected negligible (single icon, no polling loop)
- "What if the icon does not appear on the tray on some Windows versions?" — standard `tray-icon` crate handles this

**Habit**:
- Current habit: forget the hook receiver exists until something is wrong — strong negative habit Danielle wants to break
- No existing tray management workflow to unlearn — LOW habit resistance

**Force Balance**: Strong Push + Strong Pull, Medium Anxiety (resource concern needs technical note) → HIGH motivation to adopt

---

## Opportunity Scoring (Lightweight)

| Job Story | Importance | Satisfaction (current) | Opportunity | Priority |
|-----------|-----------|------------------------|-------------|----------|
| JS-01: Process identity | High | Very Low (no label) | Critical | Must Have |
| JS-02: Tray visibility | High | Very Low (invisible) | Critical | Must Have |

Both jobs are underserved and high-importance for the solo developer persona. No deprioritization needed — implement together as they share the same binary and build pipeline.

---

## Domain Glossary (Ubiquitous Language)

| Term | Definition |
|------|------------|
| hook receiver | The `norbert-hook-receiver.exe` sidecar process; headless Axum HTTP server on localhost:3748 |
| main GUI | The `norbert.exe` Tauri desktop application |
| VERSIONINFO | Windows PE binary metadata block; contains FileDescription shown in Task Manager |
| FileDescription | The human-readable process name shown in Task Manager's Description column |
| system tray | Windows notification area (bottom-right taskbar); home of background app icons |
| tray icon | The small icon representing an app in the system tray |
| tray tooltip | Text shown on hover over the tray icon |
| tray context menu | Right-click popup menu on the tray icon |
| event count | Number of telemetry events (hooks + OTLP spans) captured since the receiver started |
| graceful shutdown | Orderly process termination: flush pending SQLite writes, close HTTP port, remove tray icon |

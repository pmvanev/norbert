# Journey: Hook Receiver Clarity — Visual Map

## Persona
Danielle Reyes, developer using Norbert on Windows daily.

## Journey Goal
Danielle can immediately identify the hook receiver process in Task Manager, confirm it is healthy from the system tray, and shut it down gracefully — without ever opening Task Manager for these tasks.

---

## Emotional Arc

```
START: Anxious/Confused          MIDDLE: Orienting            END: Confident/Reassured
"Which Norbert is which?"   "Oh, there's the tray icon"   "All good. Hook receiver is
  [Task Manager chaos]       "It shows port and count"      alive, port 3748, 42 events"
```

Arc pattern: **Problem Relief** — starts frustrated, resolves to relieved and confident.

---

## Happy Path Flow

```
[Login / Boot]
     |
     | Windows auto-starts hook receiver via Startup shortcut
     v
[Step 1: Startup]
  norbert-hook-receiver.exe launches
  tray icon appears in system tray
  Feels: normal startup, expected

     |
     | Danielle opens Task Manager (investigating something unrelated)
     v
[Step 2: Task Manager — Process Identification]
  Description column shows "Norbert Hook Receiver"
  Description column shows "Norbert" for norbert.exe (unchanged)
  Danielle can distinguish processes at a glance
  Feels: relieved — no confusion

     |
     | Danielle glances at system tray
     v
[Step 3: Tray Icon — Status Check]
  Tray icon is visible
  Hovering shows tooltip: "Norbert Hook Receiver  |  :3748  |  42 events"
  Feels: reassured — sidecar is alive and counting

     |
     | Danielle right-clicks tray icon
     v
[Step 4: Tray Context Menu]
  Menu appears:
    - "Norbert Hook Receiver" (title, non-clickable)
    - "Port: 3748"
    - "Events captured: 42"
    - ─────────────────
    - "Quit"
  Feels: in control — has all the info she needs

     |
     | Danielle clicks "Quit"
     v
[Step 5: Graceful Shutdown]
  Pending SQLite writes flushed
  HTTP listener closed
  Tray icon removed from system tray
  Process exits cleanly
  Feels: satisfied — clean, professional shutdown
```

---

## Error Paths

```
[Step 1 Error: Hook receiver crashes at startup]
  Tray icon never appears
  User notices absence when they expect to see it
  Workaround: check Task Manager manually (current behaviour, unchanged)
  → Future story: crash restart / watchdog (out of scope for this feature)

[Step 3 Error: Port conflict — receiver never bound to 3748]
  Tray icon appears but tooltip shows "Port: UNAVAILABLE" or "Port: not bound"
  Signals misconfiguration to Danielle without requiring log diving
  → Requirements note: tooltip must reflect actual bound port, not assumed port

[Step 5 Error: SQLite write in flight at quit time]
  "Quit" triggers graceful drain: wait up to 2 seconds for pending writes
  If drain completes: clean exit
  If drain times out: forced exit; log warning (in-flight data may be incomplete)
  → Requirements note: force-quit timeout is a technical constraint for DESIGN wave
```

---

## TUI/GUI Mockups

### Task Manager — Description Column

```
+-- Task Manager ────────────────────────────────────────────────────────────+
| Name                          PID   CPU   Memory   Description             |
| ─────────────────────────────────────────────────────────────────────────  |
| norbert.exe                   4521  0.1%  128 MB   Norbert                 |
| norbert-hook-receiver.exe     4892  0.0%   24 MB   Norbert Hook Receiver   | <-- distinct!
| chrome.exe                    3110  2.3%  512 MB   Google Chrome           |
+────────────────────────────────────────────────────────────────────────────+

${file_description} = "Norbert Hook Receiver"
  Source: Cargo.toml / build.rs VERSIONINFO block
```

### System Tray — Hover Tooltip

```
+────────────────────────────────────────────+
|  [N]  Norbert Hook Receiver                |  <- tray icon hover tooltip
|       :3748  |  42 events                  |
+────────────────────────────────────────────+

${port}        = actual bound port (3748 default)
  Source: runtime — listener bind result
${event_count} = cumulative events captured since process start
  Source: runtime — atomic counter in hook receiver
```

### System Tray — Right-Click Context Menu

```
+──────────────────────────────────+
|  Norbert Hook Receiver           |  <- title row (disabled)
|  ───────────────────────────     |
|  Port: 3748                      |  <- ${port}
|  Events captured: 42             |  <- ${event_count}
|  ───────────────────────────     |
|  Quit                            |  <- triggers graceful shutdown
+──────────────────────────────────+
```

---

## Integration Checkpoints

| Checkpoint | What to Validate |
|------------|-----------------|
| IC-01: Build metadata | `norbert-hook-receiver.exe` VERSIONINFO FileDescription = "Norbert Hook Receiver" |
| IC-02: Main GUI unaffected | `norbert.exe` VERSIONINFO unchanged — still shows "Norbert" |
| IC-03: Tray icon appears | Icon visible in system tray within 2 seconds of process start |
| IC-04: Port reported accurately | Tooltip/menu port matches actual `TcpListener::local_addr()` |
| IC-05: Event count live | Event count in tooltip/menu reflects actual count in memory |
| IC-06: Graceful quit | After "Quit", process exits with code 0; no port held; SQLite WAL flushed |

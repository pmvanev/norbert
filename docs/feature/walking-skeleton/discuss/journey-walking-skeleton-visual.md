# Journey: Walking Skeleton -- Install to First Confirmed Data

## Journey Flow

```
[TRIGGER]              [STEP 1]               [STEP 2]               [STEP 3]
User decides to    --> Install Norbert     --> First Launch &     --> Run Claude Code
try Norbert            via npm                 Settings Merge         session normally

Feels: Curious         Feels: Hopeful         Feels: Cautious -->    Feels: Neutral
                                              then Reassured         (no change to
                                                                      workflow)

Sees: README           Sees: npm install       Sees: Tray icon       Sees: Claude Code
      with one-line         output, global          appears,               terminal output
      install cmd           package                 window shows           as usual
                            installed               "Listening"

Artifacts:             Artifacts:              Artifacts:             Artifacts:
  (none)                 norbert-cc binary        ~/.norbert/            Hook POST events
                         in PATH                  norbert.db             sent to
                                                  settings.json.bak      localhost:3748
                                                  patched settings.json


[STEP 4]               [STEP 5]               [GOAL]
Status shows       --> Open Norbert        --> Full pipeline
live event count       window after            confirmed working
                       session ends

Feels: Confident       Feels: Satisfied       Feels: Trust
       (it works!)            (proof!)                established

Sees: Tray badge       Sees: Window with      Sees: "Ready for
      or status             session record,         features"
      indicator             event count,            confidence
                            timestamp

Artifacts:             Artifacts:
  Events in SQLite       Session record
  incrementing           visible in UI
```

## Emotional Arc

```
Trust Level
  ^
  |                                                          *** TRUST
  |                                                      ***
  |                                              CONFIDENT
  |                                            **
  |                                        ***
  |                               REASSURED
  |                           ****
  |                     CAUTIOUS
  |                  ***
  |             HOPEFUL
  |          ***
  |     CURIOUS
  |  ***
  +-----------------------------------------------------------> Time
  Install    First       Settings     Claude Code   Check    Open
  Decision   Launch      Merge        Session       Status   Window
```

**Arc Pattern**: Confidence Building
- Start: Curious/Hopeful (trying something new)
- Dip: Cautious (settings modification -- will it break things?)
- Rise: Reassured (tray icon appears, backup confirmed)
- Plateau: Neutral (Claude Code session -- no change to workflow)
- Peak: Confident/Satisfied (data confirmed in UI)

## Step Details

### Step 1: Install Norbert

```
+-- Terminal -------------------------------------------------------+
|                                                                    |
|  $ npm install -g norbert-cc                                       |
|                                                                    |
|  added 1 package in 4s                                             |
|                                                                    |
|  $ norbert-cc                                                      |
|                                                                    |
+--------------------------------------------------------------------+
```

**Emotional state**: Hopeful -> Expectant
**What could go wrong**: npm permission errors, network failure, binary download failure
**Recovery**: Clear error message with suggested fix (e.g., "Run with sudo" or "Check network connection")

### Step 2: First Launch and Settings Merge

```
+-- System Tray (Windows 11) ------+
|                                   |
|  [Norbert icon appears]           |
|                                   |
+-----------------------------------+

+-- Windows Notification Center ----+
|                                   |
|  Norbert                          |
|  Hooks registered successfully.   |
|  Restart any running Claude Code  |
|  sessions for hooks to take       |
|  effect.                          |
|                                   |
+-----------------------------------+

+-- Norbert Main Window (minimal) --+
|                                    |
|  NORBERT v0.1.0                    |
|                                    |
|  Status: Listening                 |
|  Port: 3748                        |
|  Sessions: 0                       |
|  Events: 0                         |
|                                    |
|  Waiting for first Claude Code     |
|  session...                        |
|                                    |
+------------------------------------+
```

**Emotional state**: Cautious -> Reassured
**Critical moment**: The settings merge is the highest-anxiety point. The user needs to see:
1. Backup was made (settings.json.bak)
2. Hooks were registered successfully
3. The app is now listening

**What could go wrong**:
- settings.json does not exist (first-time Claude Code user)
- settings.json is malformed JSON
- Port 3748 already in use
- ~/.claude/ directory does not exist

**Recovery**:
- Missing settings.json: create it with just the hook config
- Malformed JSON: show error, do not modify, tell user to fix manually
- Port conflict: show error with port in use, suggest alternative
- Missing directory: create ~/.claude/ if needed

### Step 3: Run Claude Code Session

```
+-- Claude Code Terminal (unchanged) --+
|                                       |
|  $ claude                             |
|  > Help me write a sorting function   |
|                                       |
|  [Claude Code runs normally]          |
|  [Hook events POST to localhost:3748] |
|  [User sees no difference]            |
|                                       |
+---------------------------------------+
```

**Emotional state**: Neutral
**Key design decision**: Norbert is invisible during this step. The user's Claude Code workflow is completely unchanged. Hook events are async and do not affect performance.

### Step 4: Status Shows Live Event Count

```
+-- System Tray (Windows 11) ------+
|                                   |
|  [Norbert icon -- active state]   |
|  Tooltip: "Norbert -- 47 events"  |
|                                   |
+-----------------------------------+
```

**Emotional state**: Confident
**What triggers the transition**: The first hook event arriving changes the tray icon state from "Listening" (idle) to "Active" (receiving). The window, if open, shows the event count incrementing.

### Step 5: Open Norbert Window After Session

```
+-- Norbert Main Window (after session) -----+
|                                              |
|  NORBERT v0.1.0                              |
|                                              |
|  Status: Listening                           |
|  Port: 3748                                  |
|  Sessions: 1                                 |
|  Events: 47                                  |
|                                              |
|  Last session:                               |
|    Started: 2026-03-08 14:23:01              |
|    Duration: 12m 34s                         |
|    Events: 47                                |
|                                              |
+----------------------------------------------+
```

**Emotional state**: Satisfied -> Trust established
**This is the proof moment**: The user sees concrete evidence that the full pipeline works. Session timestamp, duration, and event count prove that:
1. Hook events were received by the HTTP server
2. Events were written to SQLite
3. The UI can read and display stored data

## Integration Points

| From | To | Data | Validation |
|------|-----|------|------------|
| npm install | Tauri binary | norbert-cc executable in PATH | `which norbert-cc` returns path |
| First launch | settings.json | Hook configuration merged | settings.json contains norbert hook entries |
| First launch | ~/.norbert/ | Database initialized | norbert.db exists with schema |
| Claude Code | HTTP server | Hook POST events | Server responds 200 to POST |
| HTTP server | SQLite | Event records | SELECT count(*) FROM events > 0 |
| SQLite | UI window | Session and event display | Window shows session count > 0 |

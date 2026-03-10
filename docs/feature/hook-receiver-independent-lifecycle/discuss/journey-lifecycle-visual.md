# Journey: Hook Receiver Independent Lifecycle

## Journey Flow

```
[INSTALL]          [BOOT/LOGIN]        [ALWAYS-ON]         [GUI OPENS]
npm install        Windows login       Background process   User opens Norbert
norbert            triggers startup    listening on :3748   GUI reads from SQLite
    |                   |                   |                   |
    v                   v                   v                   v
postinstall.js     Task Scheduler      norbert-hook-        norbert.exe
registers          launches             receiver.exe         connects to
startup task       hook receiver       writes events        ~/.norbert/data/
    |                   |               to SQLite            norbert.db
    v                   v                   |                   |
"Startup task      "Hook receiver          |               GUI shows
 registered"        started on             |               session history
                    port 3748"             |               + receiver status
                        |                   |                   |
                        +------- SHARED DB -+-------------------+
                              ~/.norbert/data/norbert.db
```

## Emotional Arc

**Pattern**: Confidence Building

```
Confident -----+                                              +--- Confident
               |                                              |
               |    Neutral                    Neutral         |
               +----+----+                  +--+----+---------+
                         |                  |
                    Trust-building     Verification
                    (install done,    (GUI shows data
                     receiver         was collected
                     registered)      while closed)
```

- **Start** (Install): Confident -- install completes with clear success message including startup registration
- **Middle** (First boot): Neutral/trusting -- hook receiver starts silently, user doesn't interact
- **End** (GUI opens): Confident -- GUI shows complete session history, including events captured without GUI running

## Step-by-Step Detail

### Step 1: Installation Registers Startup

**Trigger**: `npm install norbert` (or `npm run postinstall` on update)

**What happens**:
1. Existing postinstall downloads binaries to ~/.norbert/bin/
2. NEW: postinstall registers a Windows Task Scheduler task for norbert-hook-receiver.exe
3. Registration is idempotent (re-running install updates rather than duplicates)
4. Success message confirms startup registration

```
+-- postinstall output -------------------------------------------+
|                                                                  |
| Installing norbert v0.1.0 for win32-x64...                      |
| Download URL: https://github.com/.../norbert-v0.1.0-win32.tar.gz|
| Install directory: C:\Users\Phil\.norbert\bin                    |
| Downloading...                                                   |
| Extracting...                                                    |
| Binary installed to: C:\Users\Phil\.norbert\bin                  |
| Start Menu shortcut created: ...\Norbert.lnk                    |
| Startup task registered: norbert-hook-receiver                   |
|                                                                  |
| Norbert installed successfully!                                  |
|                                                                  |
| To start collecting Claude Code events now:                      |
|   norbert-hook-receiver                                          |
|   (or reboot -- it will start automatically)                     |
|                                                                  |
| To open the dashboard:                                           |
|   norbert                                                        |
+------------------------------------------------------------------+
```

**Emotional state**: Confident -- clear confirmation that both binaries and startup registration are in place.

### Step 2: System Boot Starts Hook Receiver

**Trigger**: Windows user login

**What happens**:
1. Task Scheduler triggers norbert-hook-receiver.exe at user logon
2. Hook receiver checks if port 3748 is already in use
3. If port available: binds and starts listening
4. If port in use (another instance): exits silently (singleton behavior)
5. Writes to stderr: `norbert-hook-receiver: listening on 127.0.0.1:3748`

**Emotional state**: Invisible -- user doesn't see this. Trust is built by absence of problems.

### Step 3: Always-On Collection (Background)

**Trigger**: Claude Code sends hook events to http://localhost:3748/hooks/{EventType}

**What happens**:
1. Hook receiver accepts POST requests
2. Validates event type, parses payload
3. Writes to ~/.norbert/data/norbert.db via WAL-mode SQLite
4. Returns 200 OK

**Emotional state**: Invisible -- this is the existing behavior, unchanged. The difference is it works even when the GUI is closed.

### Step 4: GUI Opens as Viewer

**Trigger**: User clicks Norbert in Start Menu (or launches norbert.exe)

**What happens**:
1. GUI opens and connects to ~/.norbert/data/norbert.db (read path)
2. GUI does NOT spawn hook receiver (changed from current behavior)
3. GUI displays session history including events captured while GUI was closed
4. GUI shows hook receiver status (healthy/not running)

```
+-- Norbert v0.1.0 -----------------------------------------------+
|                                                                   |
| Status: Listening                                                 |
| Hook receiver: Running on port 3748                               |
| Sessions: 12    Events: 847                                       |
|                                                                   |
| Latest session: sess-a1b2c3d4                                     |
| Started: 2026-03-10 09:15:22                                      |
| Events: 34                                                        |
|                                                                   |
+-------------------------------------------------------------------+
```

**Emotional state**: Confident -- complete data is visible, including events from before the GUI was opened.

### Step 5: GUI Closes, Collection Continues

**Trigger**: User closes Norbert GUI window

**What happens**:
1. GUI hides to tray (existing behavior) or fully exits
2. Hook receiver continues running independently
3. No data loss, no interruption

**Emotional state**: Trust -- user knows closing the GUI has no impact on data collection.

## Error Paths

### E1: Port 3748 Already in Use (non-Norbert process)

Hook receiver cannot bind to port 3748 because another application is using it.
- Hook receiver logs error: `norbert-hook-receiver: Port 3748 unavailable: {error}`
- Hook receiver exits with code 1
- Claude Code hooks fail silently (no receiver listening)
- GUI could show "Hook receiver: Not running -- port conflict" (future enhancement)

### E2: Startup Task Not Registered (install failed or was cleaned up)

User reboots but hook receiver doesn't start.
- No error visible to user (they may not notice immediately)
- When GUI opens, no new events since last receiver shutdown
- Fix: re-run `npm run postinstall` or `npx norbert` to re-register

### E3: Database Lock Contention

Hook receiver and GUI both access SQLite simultaneously.
- Already mitigated: SQLite WAL mode allows concurrent readers with one writer
- Hook receiver is the only writer; GUI is read-only
- No action needed -- existing architecture handles this

### E4: Second GUI Instance Opened

User opens norbert.exe while it's already running.
- Current: spawns duplicate hook receiver (crashes on port conflict)
- After change: GUI no longer spawns hook receiver, so no conflict
- Two GUI instances both read from same database -- harmless

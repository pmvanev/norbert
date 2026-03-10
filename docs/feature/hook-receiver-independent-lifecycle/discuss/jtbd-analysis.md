# JTBD Analysis: Hook Receiver Independent Lifecycle

## Job Classification

**Job Type**: Brownfield (Job 2 -- Improve Existing System)

The hook receiver binary already exists and works correctly. The system is understood, the problem is identified. The gap is purely lifecycle management -- making the hook receiver start independently of the GUI.

**Workflow**: `[research] -> discuss -> design -> distill -> baseline -> roadmap -> split -> execute -> review`

Note: Discovery (discuss) is needed because although the problem is clear, the lifecycle management approach requires requirements definition before DESIGN wave.

---

## Job Stories

### JS-1: Always-On Data Collection

**When** I close the Norbert GUI after a coding session and continue using Claude Code,
**I want to** know that my hook events are still being captured in the background,
**so I can** review a complete, uninterrupted history of my Claude Code activity whenever I open the GUI.

#### Functional Job
Capture all Claude Code hook events regardless of whether the GUI application is running.

#### Emotional Job
Feel confident that no observability data is silently lost -- trust that the system is always working.

#### Social Job
Not applicable (solo developer tool, no social dimension).

### JS-2: Singleton Hook Receiver

**When** I launch the Norbert GUI (or it launches at startup alongside an already-running hook receiver),
**I want to** have exactly one hook receiver process listening on port 3748,
**so I can** avoid port conflicts, crashes, and duplicate data from competing receiver instances.

#### Functional Job
Ensure a single hook receiver instance owns port 3748 at all times -- no duplicates, no conflicts.

#### Emotional Job
Feel that the system "just works" without requiring manual process management or troubleshooting.

### JS-3: Seamless Install-to-Running

**When** I install Norbert via npm for the first time (or update it),
**I want to** have the hook receiver automatically registered to start at system boot,
**so I can** start collecting Claude Code data immediately without manual configuration steps.

#### Functional Job
Register the hook receiver for automatic startup during the install process, idempotently.

#### Emotional Job
Feel that installation is complete and the tool is ready -- no "now go configure this manually" friction.

---

## Four Forces Analysis

### Demand-Generating

**Push (frustration with current situation)**:
- Hook events are silently lost when the GUI is closed. Phil closes Norbert, keeps coding with Claude Code, and later discovers gaps in his session history.
- Opening a second GUI instance crashes the hook receiver on port 3748 conflict. The error is confusing and requires manual investigation.
- The GUI must be running at all times to collect data, which contradicts the "lightweight always-on observer" product identity.

**Pull (attraction of new solution)**:
- Hook receiver runs as an independent background process from system boot. Data collection is continuous and invisible.
- The GUI becomes a pure viewer -- open it when you want to review data, close it without consequence.
- Single instance guarantee eliminates port conflicts and duplicate process confusion.
- The install experience is complete: npm install, reboot (or manual start), data collection begins.

### Demand-Reducing

**Anxiety (fears about new approach)**:
- Will the background process consume noticeable system resources (memory, CPU) when idle?
- What if the startup registration breaks or gets cleaned up by system maintenance tools?
- How do I know the hook receiver is actually running? Is there any visibility?
- What if I need to stop or restart it -- is there a way to control it?

**Habit (inertia of current approach)**:
- Current approach "works" as long as the GUI is open. Phil has adapted by keeping Norbert running.
- The sidecar model is simple to reason about -- GUI starts receiver, GUI stops receiver.

### Assessment

- **Switch likelihood**: HIGH -- Push is strong (data loss is the primary pain), Pull directly addresses it.
- **Key blocker**: Anxiety about controllability and resource usage. Must be addressed in design.
- **Key enabler**: Push of silent data loss. Every lost hook event erodes trust in the tool.
- **Design implication**: The hook receiver must be invisible when working, diagnosable when not. The GUI should surface receiver health status. The startup registration must be robust and idempotent.

---

## 8-Step Job Map: Hook Receiver Lifecycle

| Step | Description | Current State | Gap |
|------|-------------|---------------|-----|
| 1. **Define** | User decides to use Norbert for Claude Code observability | Covered by product install | No gap |
| 2. **Locate** | User installs Norbert binaries | postinstall.js downloads and places binaries in ~/.norbert/bin/ | No gap |
| 3. **Prepare** | Hook receiver is registered for automatic startup | NOT COVERED -- no startup registration exists | **Primary gap** |
| 4. **Confirm** | User can verify the hook receiver is running and healthy | NOT COVERED -- no health check or status visibility | **Gap** |
| 5. **Execute** | Hook receiver runs, accepts hooks, writes to SQLite | Fully covered by existing hook_receiver.rs | No gap |
| 6. **Monitor** | User sees receiver status in the GUI | Partially covered -- GUI shows "Listening" but doesn't check if receiver process is alive | **Gap** |
| 7. **Modify** | User can stop/restart/update the hook receiver | NOT COVERED -- no lifecycle control mechanism | **Gap (lower priority)** |
| 8. **Conclude** | User uninstalls Norbert, startup registration is cleaned up | NOT COVERED -- no unregistration during uninstall | **Gap (future)** |

### Key Findings

Steps 3 and 4 are the primary gaps. Step 3 (Prepare) is the core of this feature -- registering the hook receiver for startup. Step 4 (Confirm) is the confidence-builder -- letting the user know the system is healthy.

Steps 7 and 8 are lower priority but should be noted as future work. Step 6 (Monitor) is a natural enhancement for the GUI viewer role.

---

## Outcome Statements

1. **Minimize** the likelihood of losing hook events when the GUI is not running.
2. **Minimize** the likelihood of port conflicts from duplicate hook receiver instances.
3. **Minimize** the number of manual steps required after install to begin collecting data.
4. **Minimize** the time it takes to confirm the hook receiver is running and healthy.
5. **Minimize** the system resource impact of the always-on hook receiver when idle.

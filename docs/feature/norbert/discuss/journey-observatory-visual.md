# Journey Visual: Norbert Observatory -- First Use Through Mastery

**Feature ID**: norbert
**Journey**: observatory (primary user journey: install, observe, diagnose, optimize)
**Persona**: Rafael Oliveira (Power User), with annotations for Priya Chakraborty (Framework Dev) and Marcus Chen (Team Lead)
**Date**: 2026-03-02

---

## Journey Overview

```
EMOTIONAL ARC: Cautious --> Reassured --> Curious --> Focused --> Empowered --> Confident
                  |            |            |           |            |             |
                  v            v            v           v            v             v
            [1. Install]  [2. Verify]  [3. Observe]  [4. Diagnose]  [5. Act]  [6. Review]
              Setup +       First        Dashboard     Drill into     Fix/       Historical
              Config       Event         Overview      Specific       Optimize   Analysis
                                                       Problem
```

---

## Step 1: Install and Configure Norbert

**Command**: `npm install -g norbert && norbert init`
**Trigger**: Rafael installs Norbert after reading about it in Claude Code community
**Emotional state**: Cautious/Skeptical ("Will this actually work? Will it break my setup?")

### TUI Mockup: `norbert init`

```
+-- norbert init ---------------------------------------------------+
|                                                                    |
|  Norbert v0.1.0 -- The Observatory for Claude Code                |
|                                                                    |
|  Setting up data capture...                                        |
|                                                                    |
|  [1/3] Creating hook configuration...                              |
|        Writing to .claude/settings.json                            |
|        Hooks: PreToolUse, PostToolUse, PostToolUseFailure,         |
|               SubagentStart, SubagentStop, SessionStart, Stop      |
|                                                                    |
|  [2/3] Initializing local database...                              |
|        Database: ~/.norbert/norbert.db (SQLite)                    |
|        Schema version: 1                                           |
|                                                                    |
|  [3/3] Starting background server...                               |
|        Server: http://localhost:${norbert_port}                    |
|        Dashboard: http://localhost:${norbert_port}/dashboard       |
|                                                                    |
|  Ready. Run any Claude Code command -- Norbert is now observing.   |
|                                                                    |
|  Quick start:                                                      |
|    norbert serve       Open the dashboard                          |
|    norbert status      Check capture status                        |
|    norbert cost --last View cost of last session                   |
|                                                                    |
|  Docs: https://norbert.dev/getting-started                         |
|                                                                    |
+--------------------------------------------------------------------+
```

**Shared artifacts**: `${norbert_port}` (from config, default 7890), `${db_path}` (default ~/.norbert/norbert.db)
**Integration checkpoint**: Hook configuration written to `.claude/settings.json` -- verify hooks are registered.
**Exit emotional state**: Reassured ("That was fast. Three steps. Let me try it.")

---

## Step 2: Verify First Event Capture (Walking Skeleton Moment)

**Command**: User runs any Claude Code command, then `norbert status`
**Trigger**: Rafael runs a simple Claude Code task to verify Norbert is capturing
**Emotional state**: Hopeful/Testing ("Did it actually capture something?")

### TUI Mockup: `norbert status`

```
+-- norbert status -------------------------------------------------+
|                                                                    |
|  Norbert Observatory Status                                        |
|                                                                    |
|  Server:    RUNNING on http://localhost:${norbert_port}            |
|  Database:  ${db_path} (42 KB)                                    |
|  Uptime:    3 minutes                                              |
|                                                                    |
|  Capture Summary:                                                  |
|  +----------------------------------------------------------+     |
|  | Events captured     | 7                                  |     |
|  | Sessions observed   | 1                                  |     |
|  | Last event          | PostToolUse (Read) 12 seconds ago   |     |
|  | MCP servers seen    | 4 (github, sentry, postgres, omni) |     |
|  +----------------------------------------------------------+     |
|                                                                    |
|  Hook Health:                                                      |
|  PreToolUse        active    3 events                              |
|  PostToolUse       active    3 events                              |
|  PostToolUseFailure active   1 event                               |
|  SubagentStart     active    0 events                              |
|  SessionStart      active    1 event (this session)                |
|                                                                    |
|  All hooks operational. Dashboard: http://localhost:${norbert_port}|
|                                                                    |
+--------------------------------------------------------------------+
```

**Shared artifacts**: `${norbert_port}`, `${db_path}`, `${events_captured}`, `${sessions_observed}`
**Integration checkpoint**: Events > 0 confirms end-to-end pipeline works. If 0, guide to troubleshooting.
**Exit emotional state**: Reassured/Delighted ("It captured 7 events! It works!")

---

## Step 3: Observe -- Dashboard Overview

**Command**: `norbert serve` (opens browser to dashboard) or navigate to `http://localhost:${norbert_port}`
**Trigger**: Rafael opens the dashboard after first capture confirmation
**Emotional state**: Curious ("What does my workflow actually look like?")

### Web Dashboard Mockup: Overview Page

```
+-- Norbert Observatory -- Dashboard --------------------------------+
|                                                                     |
| [Overview] [Sessions] [Agents] [MCP] [Context] [Cost]              |
|                                                                     |
| TODAY'S SUMMARY                                          2026-03-02 |
| +-------------------+  +-------------------+  +-------------------+ |
| | Sessions     6    |  | Total Tokens      |  | MCP Servers       | |
| | (2 active)        |  | 142,847           |  | 4 connected       | |
| |                   |  | Est. cost: $4.28  |  | 0 failures        | |
| +-------------------+  +-------------------+  +-------------------+ |
|                                                                     |
| CONTEXT WINDOW PRESSURE                           [Current Session] |
| +---------------------------------------------------------------+  |
| |  System  |  CLAUDE.md  |  MCP Tools  |  History  |   Free     |  |
| |  12%     |  8%         |  18%        |  34%      |   28%      |  |
| +---------------------------------------------------------------+  |
| [##########|########|##################|#############...........]   |
|  Pressure: 72% -- MODERATE (warning at 85%)                        |
|                                                                     |
| RECENT SESSIONS                                                     |
| +-----+-------------+---------+--------+--------+---------+------+ |
| | #   | Started     | Agents  | Tokens | Cost   | MCP Err | Dur  | |
| +-----+-------------+---------+--------+--------+---------+------+ |
| | *6  | 14:23 (now) | 3       | 28,412 | $0.85  | 0       | 12m  | |
| |  5  | 13:01       | 1       | 8,201  | $0.25  | 0       | 4m   | |
| |  4  | 11:47       | 8       | 67,234 | $2.02  | 1       | 31m  | |
| |  3  | 10:15       | 2       | 18,500 | $0.56  | 0       | 8m   | |
| |  2  | 09:30       | 5       | 12,300 | $0.37  | 2       | 15m  | |
| |  1  | 08:45       | 1       | 8,200  | $0.25  | 0       | 3m   | |
| +-----+-------------+---------+--------+--------+---------+------+ |
|                                                                     |
| MCP SERVER HEALTH                                                   |
| +-------------+-----------+--------+--------+--------------------+ |
| | Server      | Status    | Calls  | Errors | Token Overhead     | |
| +-------------+-----------+--------+--------+--------------------+ |
| | github      | connected | 23     | 0      | 3,200 tokens       | |
| | sentry      | connected | 8      | 0      | 2,100 tokens       | |
| | postgres    | connected | 15     | 0      | 4,800 tokens       | |
| | omni-search | connected | 5      | 0      | 14,214 tokens (!)  | |
| +-------------+-----------+--------+--------+--------------------+ |
| Total MCP token overhead: 24,314 tokens (12% of context)           |
|                                                                     |
+---------------------------------------------------------------------+
```

**Shared artifacts**: `${norbert_port}`, `${session_list}`, `${mcp_servers}`, `${context_pressure_pct}`
**Integration checkpoint**: Dashboard renders with live data. Sessions match what user ran. MCP servers match `/mcp` output.
**Exit emotional state**: Curious/Impressed ("I've never seen my Claude Code usage like this before. That omni-search overhead is huge!")

**[Priya annotation]**: Framework developer focuses on MCP token overhead table immediately. "14,214 tokens for omni-search? I had no idea."
**[Marcus annotation]**: Team lead focuses on daily cost summary and session cost column. "This is the data I need for my budget conversations."

---

## Step 4: Diagnose -- Drill Into a Specific Problem

**Trigger**: Rafael clicks on Session #4 ($2.02, 8 agents, 1 MCP error) to investigate the high cost
**Emotional state**: Focused/Investigative ("Let me find out what happened here")

### Web Dashboard Mockup: Session Detail -- Execution Trace

```
+-- Session #4 -- Agent Execution Trace -----------------------------+
|                                                                     |
| Session: #4 | Started: 11:47 | Duration: 31m | Cost: $2.02         |
| Agents: 8 | Tool calls: 47 | MCP errors: 1                        |
|                                                                     |
| EXECUTION GRAPH                                    [Timeline] [DAG] |
|                                                                     |
|  main-orchestrator ($0.42)                                          |
|  |                                                                  |
|  +-- code-analyzer ($0.18)                                          |
|  |   +-- Read (x12) -- src/auth/*.ts                                |
|  |                                                                  |
|  +-- file-migrator ($1.08) <-- HIGHEST COST                        |
|  |   +-- Read (x14) -- src/models/user.ts  <-- 14 READS!           |
|  |   +-- Write (x6) -- src/models/user-v2.ts                       |
|  |   +-- github:get_file (x3) -- MCP call                          |
|  |                                                                  |
|  +-- test-runner ($0.22)                                            |
|  |   +-- Bash (x8) -- npm test                                     |
|  |                                                                  |
|  +-- sentry:get_issues ($0.12) <-- MCP ERROR at 12:04              |
|      Error: Connection timeout after 30s                            |
|      Impact: Subsequent prompts lacked Sentry context               |
|                                                                     |
| TOKEN COST WATERFALL                                                |
| +---------------------------+--------+------+-----------+           |
| | Agent                     | Input  | Output | Cost    |           |
| +---------------------------+--------+------+-----------+           |
| | file-migrator             | 42,100 | 8,200 | $1.08   |           |
| | main-orchestrator         | 18,400 | 2,100 | $0.42   |           |
| | test-runner               | 8,800  | 1,200 | $0.22   |           |
| | code-analyzer             | 6,200  | 1,400 | $0.18   |           |
| | sentry:get_issues (fail)  | 4,800  | 0     | $0.12   |           |
| +---------------------------+--------+------+-----------+           |
|                                                                     |
| INSIGHT: file-migrator read src/models/user.ts 14 times across     |
| iterations. This single file accounted for 53% of session cost.    |
| Consider restructuring the prompt to cache file contents.           |
|                                                                     |
+---------------------------------------------------------------------+
```

**Shared artifacts**: `${session_id}`, `${agent_tree}`, `${cost_waterfall}`, `${mcp_errors}`
**Integration checkpoint**: Token counts in waterfall should approximately sum to session total. MCP error timestamp correlates with sentry tool call failure.
**Exit emotional state**: Empowered ("Found it! The file-migrator is the culprit. 14 reads of the same file. And Sentry disconnected at 12:04.")

### Web Dashboard Mockup: MCP Error Detail

```
+-- MCP Error Detail ------------------------------------------------+
|                                                                     |
| MCP Error: sentry (Connection timeout)                              |
|                                                                     |
| Timeline:                                                           |
| 11:47:00  Session started, sentry connected (status: healthy)       |
| 11:52:14  sentry:get_issues called -- success (latency: 1.2s)      |
| 12:01:30  sentry:get_issues called -- success (latency: 3.8s) (!)  |
| 12:04:02  sentry:get_issues called -- TIMEOUT after 30s            |
| 12:04:32  sentry server status: disconnected                        |
| 12:04:32  Impact: 3 subsequent tool calls to sentry skipped        |
| 12:18:00  Session ended -- sentry never reconnected                 |
|                                                                     |
| Latency trend:  1.2s --> 3.8s --> TIMEOUT                           |
| Pattern: Progressive latency degradation before failure             |
|                                                                     |
| Recommendation: Sentry MCP server showed increasing latency before  |
| timeout. Check server process health and network connectivity.      |
|                                                                     |
+---------------------------------------------------------------------+
```

**[Priya annotation]**: Framework developer drills into the execution graph to trace inter-agent data flow. Finds Agent 3 passed malformed output to Agent 5.
**[Marcus annotation]**: Team lead notes that 53% of session cost came from one agent's redundant file reads. Shares this pattern with team as optimization guidance.

---

## Step 5: Act -- Translate Observation Into Action

**Trigger**: Rafael identifies file-migrator reading the same file 14 times; Sentry MCP server showing progressive latency degradation
**Emotional state**: Empowered/Productive ("I know exactly what to fix")

### Actions Rafael Takes (Outside Norbert)

1. **Restructures file-migrator prompt**: Adds instruction to cache file contents, reducing redundant reads
2. **Checks Sentry MCP config**: Discovers server process was hitting memory limits; increases allocation
3. **Returns to Norbert**: Runs next session and compares costs

### TUI Mockup: `norbert cost --last --compare`

```
+-- norbert cost --last --compare ----------------------------------+
|                                                                    |
|  Session Comparison                                                |
|                                                                    |
|  +----------------------+----------+----------+----------+         |
|  | Metric               | Previous | Current  | Change   |         |
|  +----------------------+----------+----------+----------+         |
|  | Total tokens         | 67,234   | 31,200   | -54%     |         |
|  | Total cost           | $2.02    | $0.94    | -53%     |         |
|  | file-migrator tokens | 42,100   | 12,400   | -71%     |         |
|  | file-migrator reads  | 14       | 3        | -79%     |         |
|  | MCP errors           | 1        | 0        |          |         |
|  | Duration             | 31m      | 18m      | -42%     |         |
|  +----------------------+----------+----------+----------+         |
|                                                                    |
|  Optimization impact: Saved $1.08 on file-migrator alone.          |
|  At 3 similar sessions/day, projected monthly savings: ~$97        |
|                                                                    |
+--------------------------------------------------------------------+
```

**Shared artifacts**: `${previous_session_id}`, `${current_session_id}`, `${comparison_metrics}`
**Integration checkpoint**: Comparison data pulls from same SQLite store. Previous session data matches what was displayed in Step 4.
**Exit emotional state**: Confident/Satisfied ("53% cost reduction! Norbert paid for itself in one session.")

---

## Step 6: Review -- Historical Analysis and Baselines

**Trigger**: End of week, Rafael (or Marcus) reviews usage trends
**Emotional state**: Reflective/Strategic ("What patterns do I see over time?")

### Web Dashboard Mockup: Historical Trends (Week View)

```
+-- Norbert Observatory -- Weekly Review ----------------------------+
|                                                                     |
| WEEK OF 2026-02-24 to 2026-03-02                                   |
|                                                                     |
| COST TREND                                                          |
| $8 |                                                                |
| $6 |     *                                                          |
| $4 |  *     *  *                                                    |
| $2 | *  *  *  *  *  *  *                                            |
| $0 +--Mon--Tue--Wed--Thu--Fri--Sat--Sun--                           |
|                                                                     |
| Weekly total: $28.40 | Daily avg: $4.06 | Sessions: 42             |
|                                                                     |
| TOP COST AGENTS (This Week)                                         |
| +-------------------+--------+---------+---------------------------+|
| | Agent Pattern      | Count  | Avg Cost| Optimization             ||
| +-------------------+--------+---------+---------------------------+|
| | file-migrator      | 12     | $0.94   | Improved 53% from $2.02  ||
| | code-analyzer      | 18     | $0.18   | Stable                   ||
| | test-runner         | 15     | $0.22   | Stable                   ||
| +-------------------+--------+---------+---------------------------+|
|                                                                     |
| MCP HEALTH SUMMARY                                                  |
| +-------------+--------+--------+---------+                         |
| | Server      | Uptime | Errors | Avg Lat |                         |
| +-------------+--------+--------+---------+                         |
| | github      | 99.8%  | 0      | 0.8s    |                         |
| | sentry      | 94.2%  | 3      | 2.1s    |  <-- still flaky        |
| | postgres    | 100%   | 0      | 0.3s    |                         |
| | omni-search | 99.5%  | 0      | 1.4s    |                         |
| +-------------+--------+--------+---------+                         |
|                                                                     |
| BASELINES ESTABLISHED                                               |
| Average session cost: $0.68 | P95 session cost: $2.10               |
| Average session duration: 12m | Average agents/session: 3.2         |
| Context pressure avg: 68% | Context pressure P95: 89%               |
|                                                                     |
+---------------------------------------------------------------------+
```

**Shared artifacts**: `${weekly_cost}`, `${daily_avg}`, `${baselines}`, `${mcp_health_summary}`
**Integration checkpoint**: Weekly aggregates match sum of individual session data. Baselines computed from same SQLite store.
**Exit emotional state**: Confident/In-Control ("I have a complete picture. Sentry is still flaky. My optimization worked. I know my baselines.")

---

## Emotional Arc Summary

| Step | Entry Emotion | Peak Moment | Exit Emotion | Design Lever |
|------|--------------|-------------|--------------|--------------|
| 1. Install | Cautious/Skeptical | 3-step init completes in < 30s | Reassured | Fast setup, zero disruption |
| 2. Verify | Hopeful/Testing | "7 events captured!" | Delighted | Immediate visible result |
| 3. Observe | Curious | First dashboard view: "I've never seen this" | Impressed | Data density without overwhelm |
| 4. Diagnose | Focused | "14 reads of the same file!" | Empowered | Clear root cause attribution |
| 5. Act | Empowered | "-53% cost, -71% file reads" | Satisfied | Before/after comparison |
| 6. Review | Reflective | Baselines established, trends visible | Confident | Historical context, patterns |

**Arc pattern**: Confidence Building (Anxious/Uncertain --> Focused/Engaged --> Confident/Satisfied)
**No jarring transitions**: Each step's exit emotion naturally feeds the next step's entry emotion.
**Error states guide to resolution**: If Step 2 shows 0 events, guide to hook troubleshooting (not "Error: no data").

---

## CLI Vocabulary

Norbert follows `norbert [noun] [verb]` pattern consistently:

| Command | Purpose | Journey Step |
|---------|---------|--------------|
| `norbert init` | First-time setup | Step 1 |
| `norbert serve` | Open web dashboard | Step 3 |
| `norbert status` | Check capture health | Step 2 |
| `norbert cost --last` | Quick cost summary | Step 5 |
| `norbert cost --last --compare` | Compare to previous | Step 5 |
| `norbert trace --last` | Quick trace summary | Step 4 |
| `norbert mcp status` | MCP server health | Step 3, 4 |
| `norbert mcp errors --last` | MCP errors for session | Step 4 |
| `norbert session list` | List recent sessions | Step 6 |
| `norbert session show ${session_id}` | Session detail | Step 4 |

### Consistent Flags
- `--last`: Shortcut for most recent session
- `--compare`: Show comparison to previous equivalent
- `--json`: Machine-parseable output
- `--verbose`: Detailed output
- `--quiet`: Exit code only (for scripts)
- `--no-color`: Respect accessibility

---

## Integration Points Between Steps

| From | To | Data Passed | Validation |
|------|-----|-------------|------------|
| Step 1 (Init) | Step 2 (Verify) | Hook config in `.claude/settings.json`, server URL | Hooks registered, server responding |
| Step 2 (Verify) | Step 3 (Dashboard) | `${norbert_port}` for browser URL | Dashboard renders, data matches CLI |
| Step 3 (Dashboard) | Step 4 (Diagnose) | `${session_id}` from session list click | Session detail loads with complete data |
| Step 4 (Diagnose) | Step 5 (Act) | Insight/root cause from diagnosis | User acts on external system (Claude Code config) |
| Step 5 (Act) | Step 6 (Review) | New session data for comparison | Before/after metrics computed correctly |
| Step 6 (Review) | Step 3 (Loop) | Baselines established for anomaly detection | Next observation cycle uses baselines |

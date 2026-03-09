# Norbert — Product Specification & Feature Overview

> *Named after Norbert Wiener, the father of cybernetics.*
> Norbert is a local-first observability and configuration management desktop app for Claude Code users. Install it once, and it quietly watches everything — surfacing insights, visualizing agent orchestration, and giving you complete visibility into what your AI is actually doing.

---

## Table of Contents

- [Installation \& Setup Philosophy](#installation--setup-philosophy)
- [Features](#features)
  - [1. Live Session Visualizer](#1-live-session-visualizer)
  - [2. Session Replay](#2-session-replay)
  - [3. Cost Burn Ticker](#3-cost-burn-ticker)
  - [4. Usage Analytics \& Token Tracking](#4-usage-analytics--token-tracking)
  - [5. Agent Interaction Diagrams](#5-agent-interaction-diagrams)
  - [6. Task Breakdown \& Sequence Diagrams](#6-task-breakdown--sequence-diagrams)
  - [7. Configuration Viewer](#7-configuration-viewer)
  - [8. Plugin Marketplace](#8-plugin-marketplace)
  - [9. Hook Health Monitor](#9-hook-health-monitor)
  - [10. Configuration Drift Detection](#10-configuration-drift-detection)
  - [11. Anomaly Detection](#11-anomaly-detection)
  - [12. Agent Performance Scorecards](#12-agent-performance-scorecards)
  - [12a. Agent Avatar System](#12a-agent-avatar-system-norbert-agents-later-release)
  - [14. Cost Forecasting](#14-cost-forecasting)
  - [14a. Default Dashboard](#14a-default-dashboard-norbert-usage)
  - [14b. norbert-dashboard](#14b-norbert-dashboard-separate-optional-plugin-later-release)
  - [15. Prompt Archaeology](#15-prompt-archaeology)
  - [16. MCP Connectivity \& Tool Use Visualization](#16-mcp-connectivity--tool-use-visualization)
  - [17. Notification Center](#17-notification-center-norbert-notif)
  - [18. Session Debugger](#18-session-debugger-norbert-debug)
  - [19. Performance Profiler](#19-performance-profiler-norbert-perf)
- [Claude Account Integration](#claude-account-integration)
- [nWave Plugin (Optional)](#nwave-plugin-optional)
  - [nWave Session Overview](#nwave-session-overview)
  - [Wave Flow Diagram](#wave-flow-diagram)
  - [nWave Artifact Browser](#nwave-artifact-browser)
  - [nWave Skill Analytics](#nwave-skill-analytics)
  - [nWave Agent Scorecards](#nwave-agent-scorecards)
  - [DES Visualizer](#des-delivery-enforcement-system-visualizer)
  - [Cross-Wave Analytics](#cross-wave-analytics)
- [Session Model — Filterable Event Stream](#session-model--filterable-event-stream)
  - [Per-Plugin Filter and Mode Ownership](#per-plugin-filter-and-mode-ownership)
  - [The Context Broadcast Bar](#the-context-broadcast-bar)
  - [Filter Dimensions](#filter-dimensions)
  - [How Views Declare Filter and Mode Controls](#how-views-declare-filter-and-mode-controls)
  - [Auto-Behavior Defaults](#auto-behavior-defaults)
  - [MCP Query Interface — Filter as Query](#mcp-query-interface--filter-as-query)
- [Plugin Architecture](#plugin-architecture)
  - [Plugin Capabilities](#plugin-capabilities)
  - [Plugin API Contract](#plugin-api-contract)
  - [Dependency Resolution \& Disabled Plugin Warnings](#dependency-resolution--disabled-plugin-warnings)
  - [Core Features as Plugins](#core-features-as-plugins)
- [Tech Stack](#tech-stack)
  - [Tauri 2.0 — Desktop Shell](#tauri-20--desktop-shell)
  - [React + Recharts — Dashboard UI](#react--recharts--dashboard-ui)
  - [SQLite (WAL mode) — Local Storage](#sqlite-wal-mode--local-storage)
  - [Git (libgit2 / gitoxide) — Config Drift Tracking](#git-libgit2--gitoxide--config-drift-tracking)
  - [Claude Code HTTP Hooks — Data Collection](#claude-code-http-hooks--data-collection)
  - [Anthropic Admin API — Account Integration](#anthropic-admin-api--account-integration)
- [Distribution](#distribution)
  - [Install Method — npx from GitHub](#install-method--npx-from-github)
  - [Build Pipeline](#build-pipeline)
  - [Code Signing](#code-signing)
- [UI Design, Aesthetics \& Interaction](#ui-design-aesthetics--interaction)
  - [Design Philosophy](#design-philosophy)
  - [Signature Visualizations](#signature-visualizations)
  - [Color System \& Built-in Themes](#color-system--built-in-themes)
  - [Glassmorphism \& Layering](#glassmorphism--layering)
  - [Typography](#typography)
  - [Animation \& Motion](#animation--motion)
  - [Layout \& Information Architecture](#layout--information-architecture)
  - [Information Architecture — Three-Level Navigation Model](#information-architecture--three-level-navigation-model)
  - [Layout Engine](#layout-engine)
  - [Multi-Window Support](#multi-window-support)
  - [Data Density \& Progressive Disclosure](#data-density--progressive-disclosure)
  - [Menu Navigation](#menu-navigation)
  - [Theme System](#theme-system)
- [UI Design Process](#ui-design-process)
  - [The Loop](#the-loop)
  - [Mockup Versioning](#mockup-versioning)
  - [What Goes in a Mockup vs. What Goes in the Spec](#what-goes-in-a-mockup-vs-what-goes-in-the-spec)
- [Build Order](#build-order)
  - [Phase 0 — CI/CD Pipeline](#phase-0--cicd-pipeline)
  - [Phase 1 — Vertical Slice MVP](#phase-1--vertical-slice-mvp)
  - [Phase 2 — Does Something](#phase-2--does-something)
  - [Phase 3 — Plugin Architecture \& Layout Engine](#phase-3--plugin-architecture--layout-engine)
  - [Phase 4+ — Plugin Delivery](#phase-4--plugin-delivery)

---

## Installation & Setup Philosophy

Norbert is designed to be invisible to install and deliberate to connect. The app and the Claude Code integration are two independent concerns, installed separately so that each can be added, removed, or updated without affecting the other.

**Step 1 — Install the app:**

```bash
npx github:pmvanev/norbert-cc
```

This installs the Norbert desktop app (Tauri binary, SQLite database, hook receiver sidecar, and UI) to `~/.norbert/`. On launch, Norbert appears as a system tray icon and the sidecar begins listening on `localhost:3748`. No Docker. No separate services to start. Critically, no other tool's configuration is touched — `~/.claude/settings.json` is never read or modified by the app install. Norbert runs independently of Claude Code.

**Step 2 — Connect to Claude Code:**

```
/plugin install norbert@pmvanev-marketplace
```

This uses Claude Code's `/plugin` command to install Norbert as a plugin from the marketplace. Claude's plugin framework registers the 6 async HTTP hooks and the MCP server through its own configuration management — no surgical JSON merging, no backup files, no risk of clobbering existing settings. When the plugin is installed and Claude Code runs, Norbert receives events automatically and transitions from "No plugin connected" to "Listening."

The two steps are fully independent. The app runs standalone — useful for browsing historical sessions even when the plugin is disabled. The plugin can be installed or removed at any time via `/plugin install` and `/plugin uninstall` without affecting the app or its stored data. This separation means Norbert never modifies files it does not own.

---

## Features

### 1. Live Session Visualizer

A real-time animated graph that renders as a Claude Code session runs. Agent nodes appear as they are spawned, directed edges draw as they communicate, and nodes pulse with activity while active — dimming gracefully when their work is done. For multi-agent nWave sessions, this is the first time users can actually *see* their orchestration happening.

The graph is interactive: click any node to inspect its current state, pending tool calls, and token consumption in a side panel. The visualizer is the first thing users see when they open Norbert during a running session, and it is designed to be the kind of thing people screenshot and share.

---

### 2. Session Replay

Every completed session can be scrubbed through like a video timeline. Users can pause at any point in the session's history, inspect the exact state of each agent at that moment, see which tool calls had fired, and review intermediate outputs. The scrubber is annotated with markers for significant events: agent spawns, tool call blocks, permission denials, and session end.

Session replay is invaluable for debugging multi-agent orchestrations that produced unexpected results — particularly for complex nWave sessions where understanding the sequence of events is non-trivial.

---

### 3. Cost Burn Ticker

A live dollar counter that increments in real time as tokens are consumed during an active session. The ticker is deliberately visceral — it makes the cost of each tool call and each agent response tangible in a way that end-of-session summaries never achieve. A small sparkline beside the ticker shows the burn rate over the last 60 seconds.

The ticker can be embedded in the tray icon badge for at-a-glance awareness without opening the full dashboard.

---

### 4. Usage Analytics & Token Tracking

Comprehensive usage metrics derived from hook event data, organized across multiple dimensions:

- **Per session** — total tokens in/out, cost, duration, tool calls fired, agents spawned
- **Per agent** — contribution to session cost, average task duration, retry rate
- **Per model** — breakdown when sessions use multiple models (e.g. Opus for planning, Sonnet for execution)
- **Over time** — daily/weekly token burn charts, cost trends, session frequency

**Context Window Utilization** — for each active agent, Norbert tracks tokens consumed relative to that model's context limit and displays a live utilization gauge (e.g. *"87k / 200k — 43%"*). This is surfaced at three levels:

- **Per-agent live gauge** — visible in the Live Session Visualizer as a fill indicator on each agent node, and in the session detail flyout panel
- **Historical high-water marks** — for completed sessions, the peak context utilization reached by each agent is recorded and displayed in the session detail view and Agent Scorecards
- **Context pressure timeline** — a per-session chart showing how each agent's context window filled over time, making it easy to see which agents are context-bound vs. compute-bound

For users with an Anthropic Admin API key, local hook data is cross-referenced against the Console usage API to reconcile local attribution with billing actuals and display credit balance and rate limit headroom. For subscription users (Claude Max/Pro), local hook data is the complete source of truth and all metrics are derived from it.

---

### 5. Agent Interaction Diagrams

**`norbert-agents` owns the runtime half of the agent story.** It has no responsibility for agent definition files — those live in `norbert-config`'s Configuration Viewer. What `norbert-agents` owns is everything derived from session data: what agents actually did, how they behaved, how they performed over time. If `norbert-config` answers "what agents do you have configured?", `norbert-agents` answers "what did those agents do?"

For any completed session, Norbert renders a diagram showing how agents interacted — their spawn relationships, communication patterns, tool usage, and relative cost contribution. The diagram is generated from hook event data and presented in two views:

- **Hierarchy view** — a tree showing the orchestration structure (which agent spawned which)
- **Sequence view** — a timeline showing the order of agent interactions with initial inputs, return values, and token usage annotated at each step

Each agent node in both views displays the agent's **name** and **description** as its primary label — not a generic "agent-3" identifier. Where an agent definition includes a role description or persona, a truncated version appears on the node and the full text is available on hover. This makes diagrams immediately readable to anyone familiar with the agent definitions, without requiring cross-referencing with the Configuration Viewer.

These diagrams are exportable as SVG or PNG for inclusion in documentation or post-mortems.

---

### 6. Task Breakdown & Sequence Diagrams

For each session, Norbert generates a detailed task breakdown showing every agent and subagent invocation with:

- Initial prompt / input passed to the agent
- Tools called during execution (with arguments and return values)
- Artifacts produced (files written, commands run, outputs returned)
- Token usage and estimated cost for that invocation
- Duration and whether the task completed, was retried, or was blocked

The sequence diagram view renders the full orchestration flow in a swimlane-style layout, making it easy to understand what happened across a complex multi-agent session at a glance.

---

### 7. Configuration Viewer

A structured visual explorer for the user's entire `.claude/` directory. Rather than navigating raw JSON and Markdown files in a text editor, Norbert presents each configuration area as a dedicated tab with purpose-built UI:

- **Agents** — card view of all agent definition files. Each card prominently displays the agent's **name** and **description** as the primary identifying information, followed by allowed tools, scope (global vs. project), and the source file path. Where agent definitions include a role or persona description, this is rendered in full — it is often the most important context for understanding what an agent is supposed to do. Cards are searchable and filterable by scope and tool set.
- **Hooks** — table of all configured hooks with event type, matcher, handler type, and current status; click any hook to see recent firing history and response codes
- **Skills** — browsable list of installed skills with their descriptions and invocation patterns
- **Rules** — permissions and allow/deny rules with a visual summary of what is permitted and blocked
- **MCP Servers** — all configured MCP servers from `.mcp.json` and `~/.claude.json`, their transport type (stdio, HTTP, SSE), and any environment variable dependencies. Paired with the drift detection feature, changes to MCP configuration are automatically surfaced in the drift timeline.
- **Plugins** — installed Norbert plugins with version and enabled/disabled status
- **CLAUDE.md** — rendered Markdown view of global and project memory files

**The boundary this plugin owns:** everything derived from configuration files at rest. The Configuration Viewer requires no live session and no hook data — it reads your `.claude/` directory and presents what it finds. If Claude Code is not running, every tab still works correctly. This is the "what have you configured?" half of the picture; `norbert-agents` is the "what are your agents actually doing?" half.

All views are read-only by default. Edits are made through purpose-built forms that validate before writing, with a preview diff shown before any file is touched.

The Configuration Viewer also serves as a natural entry point for users new to Claude Code's deeper capabilities. Seeing a real agent definition rendered as a card — with its name, description, allowed tools, and scope all laid out — makes the concept of agents tangible in a way that reading documentation rarely does. A user who didn't know hooks existed will understand what they are the moment they see the Hooks tab populated with live firing history. Skills, rules, and CLAUDE.md files that might otherwise be invisible machinery become visible, named, and explorable. For users coming from a background of standard LLM prompting, the Configuration Viewer is often where the "wait, Claude Code can do *that*?" moment happens. The natural next step — opening `norbert-agents` to see those same agents running live — completes the picture.

---

### 8. Plugin Marketplace

A visual plugin browser integrated directly into Norbert. Shows currently installed plugins alongside available plugins from the Claude Code marketplace. Each plugin listing includes a description, author, version history, and user ratings where available.

Install and remove plugins with a single click — Norbert handles the `settings.json` update and prompts Claude Code to reload. No manual JSON editing required.

---

### 9. Hook Health Monitor

Hooks are powerful but completely silent when something goes wrong. Norbert surfaces hook health in a dedicated view:

- Which hooks fired in the last session and their response codes
- Hooks that timed out, returned errors, or produced unexpected output
- Average response latency per hook (important for synchronous hooks that block Claude Code)
- A flame indicator on any hook that is consistently slow or failing

This is the difference between hooks working and hooks *visibly* working. It is also, for many users, the first time hooks feel real — seeing a `PreToolUse` hook fire 47 times in a session and block 2 of them is more instructive than any amount of documentation about what hooks are.

---

### 10. Configuration Drift Detection

Norbert initializes a shadow Git repository at `~/.norbert/config-repo/` that mirrors the user's `~/.claude/` directory. On each Claude Code session start, it snapshots the current state of all config files and commits the diff automatically with a timestamp.

The Drift view shows:

- A visual diff of what changed between any two snapshots, rendered like a GitHub diff view
- A timeline of when changes occurred, correlated with session activity
- Automatic detection of changes made by tools (e.g. nWave modifying agent definitions during a session) vs. changes made by the user
- Alerts when config changes are detected between sessions without a known cause

This is particularly valuable for nWave users whose orchestration framework may modify agent definitions or hook configurations dynamically during execution.

---

### 11. Anomaly Detection

Norbert passively monitors usage patterns and surfaces anomalies without requiring any configuration:

- Sessions that cost significantly more than your average for similar task types
- Agents with unusually high retry rates
- Tool calls that are consistently slow or blocking
- Sudden spikes in token consumption that may indicate a prompt or context issue
- Rate limit proximity warnings before they become a problem
- **Context window pressure warnings** — when an agent's context utilization crosses configurable thresholds (default: warn at 75%, alert at 90%), Norbert surfaces a notification *before* compression becomes necessary, giving the user a chance to intervene

**Compression Event Tracking** — context window compression is treated as a first-class lifecycle event, not just a metric. When Claude Code performs an automatic context compaction, Norbert captures and stores:

- Timestamp and which agent was compressed
- Token count before and after compression
- Estimated cost of the compaction call itself
- A summary of what was compressed (derived from the hook payload where available)
- The triggering utilization level that caused compaction

Compression events appear as distinct markers on the Session Replay scrubber timeline (visually distinguishable from tool calls and agent spawns), in the context pressure timeline chart in Feature 4, and in the anomaly feed. A dedicated **Compression History** view in the Sessions panel lets users see all compression events across sessions, sorted by cost impact — useful for identifying agents or task patterns that are systematically context-bound and may benefit from prompt optimization or task decomposition.

Anomalies appear as non-intrusive notifications and are logged to a dedicated feed in the dashboard. All detection runs locally against SQLite data — no data leaves the machine.

---

### 12. Agent Performance Scorecards

Across all sessions, Norbert maintains per-agent statistics that accumulate over time. Each scorecard is anchored by the agent's **name** and **description** as its header — the description is rendered in full, not truncated, because understanding what an agent is supposed to do is prerequisite to evaluating whether its performance metrics make sense. A link from the scorecard to the agent's definition in the Configuration Viewer keeps the two views connected.

Per-agent metrics tracked:

- Average task completion cost
- Average duration
- Success rate (completed vs. retried vs. blocked)
- Most common tools used
- Relative cost efficiency compared to other agents doing similar work
- Context window utilization history (peak, average, compression frequency)

For nWave users who are tuning their orchestration configurations, these scorecards provide empirical data to inform decisions about which agents to use for which tasks — replacing intuition with measurement.

---

### 12a. Agent Avatar System *(norbert-agents, later release)*

> **Delivery note:** This feature is explicitly scoped to a later release of `norbert-agents`. It has no dependencies on core Norbert functionality and does not block any other feature. It is designed to be added incrementally: the data model and storage can be wired in early, the generation and upload UX ships when ready, and the avatar surfaces throughout the UI as each view is updated to support it. Nothing breaks if an agent has no avatar — the placeholder state is the default.

**The idea:** Agents are playing roles. Giving them faces makes the session visualizer, the agent graph, the constellation view, and the scorecards legible at a glance — you recognize the reviewer, the security agent, the tdd-crafter before you read a label. It also makes the whole system feel alive in a way that data alone never achieves. Anthropomorphizing agents is a deliberate UX choice grounded in cognitive science: humans read intent and role from faces faster than from text.

---

**Avatar sources**

Each agent can have an avatar assigned through one of three paths:

**1. AI-generated from description** — Norbert reads the agent's `description` field from its Claude Code definition and constructs an image generation prompt. The prompt enforces a consistent art style (configurable globally — see Style Settings below). Generation happens silently in the background the first time a new agent is seen; the user is not prompted or interrupted. A placeholder (initials ring in brand color) is shown until generation completes, then the avatar fades in.

**2. User-uploaded image** — via the agent's card in the Configuration Viewer or the Agents panel. Any image can be uploaded; Norbert crops and scales it to the avatar dimensions. This path is useful for teams that want a consistent visual language they control entirely.

**3. Prompted regeneration** — the user can click "Regenerate" on any agent card to trigger a new generation with an optional custom hint ("make it more serious", "use a side profile", "comic book style"). The hint is appended to the base generation prompt.

---

**Generation model**

The default generation model is **`claude-haiku-4-5`** (the "nano banana" — fastest, cheapest, appropriate for a background task). The model is configurable:

- **Global setting** — Settings → Agents → Avatar Generation Model
- **Per-agent override** — on the agent's card, a dropdown to choose a different model for that agent specifically

Users who want stylistic consistency across all agents will use the global default. Users who want one particularly important agent (e.g. the nWave coordinator) to have a higher-quality image can override it.

The generation API call uses Anthropic's image generation endpoint. The prompt structure is:

```
[Style prefix from global style setting]
A person who is [agent description, condensed to key role and action].
Square crop, facing slightly toward the camera, plain background.
[Any per-regeneration user hint]
```

Examples of what gets generated from real agent descriptions:
- *tdd-crafter* → "A developer staring intently at a monitor, fingers hovering over a keyboard, surrounded by test output on screen"
- *code-reviewer* → "A person carefully reading a document or code diff, pen in hand, thoughtful expression"
- *security-auditor* → "A person in a security operations center scanning multiple screens with a focused, scrutinizing expression"
- *research-agent* → "A person in a lab coat examining data on a tablet, surrounded by reference materials"
- *nwave-coordinator* → "A calm, composed figure at a central desk with multiple team members visible in the background"

---

**Style settings**

Avatar style is a global setting under Settings → Agents → Avatar Style. It affects all AI-generated avatars and ensures visual consistency when multiple agents are shown together (graph nodes, scorecard grids, constellation view).

Built-in style presets:

| Style | Description | Matches theme |
|---|---|---|
| **Editorial Flat** | Flat vector illustration, muted palette, minimal detail | Claude Dark / Light |
| **CRT Technical** | Grainy, slightly teal-tinted, technical illustration feel, like a period computing manual | Norbert |
| **Ink Sketch** | Monochrome line art, hand-drawn quality | VS Code Dark / Light |
| **Photorealistic** | Realistic portrait, soft lighting, neutral background | Any |
| **Custom** | User-defined style prefix string | Any |

The Norbert theme's **CRT Technical** style is the default when the Norbert theme is active. Avatars generated in this style look like they belong in the instrument panel aesthetic — slightly weathered, technical, consistent with the phosphor palette.

---

**Where avatars appear**

Once an agent has an avatar, it surfaces throughout the UI. Each surface is independently updated as `norbert-agents` ships new versions — avatar support is additive, never blocking:

- **Agent node in Live Session Visualizer** — the avatar replaces or overlays the initials circle; a small circular crop of the avatar appears inside the node border, with the phosphor glow in the Norbert theme applied around the border
- **Agent Constellation** — star nodes show the avatar as a circular texture on the star's glow disc; the avatar fades in as the star brightens and fades out as the agent dims on completion
- **Agent list in Agents panel** — avatar appears as a 40px circle to the left of the agent name and description
- **Agent Performance Scorecards** — avatar appears in the scorecard header alongside the name and description
- **nWave Wave Flow Diagram nodes** — avatar replaces the role badge inside the node
- **nWave Agent Scorecards** — same as general scorecards
- **Artifact Browser** — producing agent shown with avatar next to name in artifact list rows
- **Session Replay** — agent nodes in the replay visualizer carry their avatars
- **Tray popover** — if an agent is active during a session, the popover shows the active agent's avatar as a small icon

**Placeholder state** — any agent without an avatar shows an initials ring: the agent's first two initials in brand color on a faint brand-colored circular background. This is the permanent fallback if generation is disabled, if the API call fails, or before generation completes. It is a complete, clean state — not a broken image or loading spinner.

---

**Privacy and control**

- Avatar generation can be **disabled globally** (Settings → Agents → Generate Avatars: Off). With generation off, all agents show the placeholder initials ring permanently.
- Individual agents can have generation **suppressed** from their card ("Don't auto-generate for this agent")
- Generated avatars are stored locally at `~/.norbert/avatars/{agent-id}.png` — they never leave the machine except as part of the generation API call to Anthropic
- The agent description used in the generation prompt is visible in the agent card's "Generation prompt" expandable section, so users know exactly what was sent

---

When a long-running autonomous session completes, Norbert generates a natural-language summary and displays it as a notification. The digest is produced by passing the session's hook event data to Claude and asking for a one-paragraph summary:

> *"Claude ran 47 tool calls across 3 agents over 12 minutes, edited 8 files in the `/src` directory, spent $1.14, and encountered 2 permission blocks on Bash commands. The session produced 3 new test files and updated the README."*

The digest is also stored with the session record and searchable from the session history view.

---

### 14. Cost Forecasting

Based on historical usage patterns, Norbert projects forward:

- Estimated days until API credits are exhausted at the current burn rate
- Projected monthly cost at current usage levels
- Usage trend (accelerating, stable, declining)

For subscription users, the forecast is based on weekly rate limit consumption rather than dollar cost. Forecasts update after each session and are displayed prominently on the dashboard home screen.

---

### 14a. Default Dashboard *(norbert-usage)*

`norbert-usage` ships a fixed, well-designed default dashboard view — the first thing a user sees when they open Norbert. It is a purpose-built React component, not generated from a widget registry or a JSON configuration. It just works, out of the box, with no setup required.

The default dashboard shows the metrics that matter most during and after a session: running cost, token count, context window utilization per agent, active agent count, tool call volume, hook health status, and a 7-day burn chart. The layout is hand-tuned for the available space. It does not need to be configurable to be excellent.

**`norbert-usage` has zero knowledge of `norbert-dashboard`**. It does not call `registerMetricWidget`. It does not export JSON. It does not depend on any widget registry. The default dashboard is a view like any other — it registers itself via `api.ui.registerView()` and that is the entirety of its relationship with the plugin system.

The one architectural commitment `norbert-usage` does make is exposing its live metrics via `api.data` — a read interface that any plugin can consume. This is not done for `norbert-dashboard` specifically; it is good plugin citizenship. `norbert-dashboard`, when it exists, will consume these data sources. So will any other plugin that wants to display usage data.

---

### 14b. norbert-dashboard *(separate optional plugin, later release)*

> **Delivery note:** `norbert-dashboard` is a separately installable plugin that does not ship with Norbert core. It has no effect on the default dashboard in `norbert-usage` and does not need to exist for Norbert to be useful. Build it when the core plugin ecosystem is stable and community appetite for customization is evident. The default dashboard ships first; this plugin ships when it's ready.

`norbert-dashboard` introduces the composable, shareable dashboard layer. Installing it adds a new entry to the view picker — "Custom Panel" — and a new section to Settings. It does not modify or replace the default dashboard; it exists alongside it.

---

**The widget registry**

`norbert-dashboard`'s foundational piece is a metric widget registry. Any plugin that wants its metrics to be composable into custom panels calls:

```typescript
api.ui.registerMetricWidget({
  id: 'usage.session_cost',
  label: 'Session Cost',
  description: 'Running cost of the current session',
  size: 'small',            // 'small' | 'medium' | 'large' (colspan hint)
  component: SessionCostWidget,
  liveUpdate: true,
});
```

`norbert-dashboard` ships with its own built-in widget registrations that wrap the metrics `norbert-usage` exposes via `api.data` — session cost, token count, context utilization, active agents, tool calls, hook health, MCP server count, burn rate, oscilloscope waveform, context pressure horizon. These are the same metrics the default dashboard shows, now available as composable atoms. The default dashboard itself is unaffected; these widget registrations are additive.

Other plugins can register their own widgets. The nWave plugin could register a DES block count widget or a current wave phase widget. Hook health could register a latency sparkline. Each plugin controls its own widget registrations independently.

---

**The panel format**

A panel is a JSON document describing a fixed grid of widget assignments:

```json
{
  "id": "nwave-deliver-watch",
  "label": "nWave Deliver Watch",
  "norbert_panel_version": "1",
  "columns": 3,
  "cells": [
    { "row": 0, "col": 0, "widget": "usage.session_cost" },
    { "row": 0, "col": 1, "widget": "usage.active_agents" },
    { "row": 0, "col": 2, "widget": "usage.context_pct" },
    { "row": 1, "col": 0, "colspan": 2, "widget": "usage.oscilloscope" },
    { "row": 1, "col": 2, "widget": "agents.hook_health" }
  ]
}
```

This is the entire format. No canvas coordinates, no resize handles, no layering. The grid constraint is a feature: panels are always clean, always screenshot-legible, and trivially human-readable. Anyone can write one by hand.

The **Norbert default panel** — a `.norbert-panel` file that replicates the layout of the default dashboard — ships inside the `norbert-dashboard` plugin repository. It is the canonical example and the starting point users are pointed to when they open the panel editor for the first time. It is not special-cased; it is just a JSON file that happens to ship with the plugin.

---

**The panel editor**

A simple click-to-assign interface. An empty grid with a `+` in each cell. Clicking a cell opens a searchable widget picker listing all registered widgets across all loaded plugins. Select one, it fills the cell. Repeat. Name the panel. Save.

No drag-and-drop in v1. No resize handles. No canvas. The editor is an afternoon of React; keep it that way.

---

**Export, import, and sharing**

- **Export** — the panel header has an Export button. Downloads a `.norbert-panel` JSON file.
- **Import** — Settings → Dashboards → Import, or drag-drop a `.norbert-panel` file onto the window. Imported panels are immediately available in the view picker.
- **Multiple panels** — users can have as many saved panels as they want. Each appears as a named entry in the view picker, assignable to Main, Secondary, or a floating panel.

The sharing story is intentionally low-infrastructure: post a `.norbert-panel` file as a GitHub gist or in a Discord. Someone else imports it in one click. No hosted registry needed.

**Community registry** *(future, if appetite warrants it)* — if `.norbert-panel` sharing becomes active in the community, a hosted registry browsable from within the Plugin Marketplace is the natural extension. Same flywheel as Grafana's dashboard marketplace, scoped to panels. Do not build this speculatively; wait for evidence.

---

**What norbert-dashboard is not**

- Not a full Grafana-style canvas builder. Freeform positioning and resize handles are 3× the build cost for marginal utility — layout presets and zone assignment already handle multi-view composition at the zone level.
- Not a replacement for the signature visualizations. Those are hand-crafted views with their own rendering logic. This is for assembling quick personal dashboards from existing metric atoms.
- Not on the critical path. The default dashboard in `norbert-usage` covers all monitoring needs for the initial release.

---

### 15. Prompt Archaeology

The most technically distinctive feature in Norbert. Because hooks capture every tool input and output, Norbert can reconstruct the full effective prompt that was assembled for any agent invocation — including injected context from skills, memory from CLAUDE.md files, system prompts from agent definitions, and any context injected via `UserPromptSubmit` hooks.

This is information that is normally completely opaque even to the person running Claude Code. Prompt Archaeology surfaces it in a readable, structured view:

- System prompt (from agent definition)
- Injected memory (from CLAUDE.md)
- Skill context (from any active skills)
- Hook-injected context (from UserPromptSubmit)
- The actual user prompt
- Token count breakdown by component

This is the feature that makes debugging a poorly-performing agent tractable, and the one most likely to surface surprising inefficiencies (e.g. a skill that is injecting thousands of tokens of context into every invocation).

---

### 16. MCP Connectivity & Tool Use Visualization

Model Context Protocol servers are increasingly central to how Claude Code operates, but their activity is currently invisible — you know a tool was called, but understanding which MCP server handled it, how long it took, whether it errored, and how much it contributed to a session's cost requires digging through raw logs.

Norbert surfaces MCP activity as a first-class concern across multiple views:

**MCP Server Dashboard** — a live panel showing all connected MCP servers, their connection status, and aggregate statistics. For each server: total tool calls this session, average response latency, error rate, and estimated token contribution. A connection health indicator shows green/yellow/red based on recent response times and error frequency.

**Tool Use Heatmap** — a visual grid showing tool call frequency across all MCP servers and built-in Claude Code tools, broken down by session, agent, or time period. Immediately answers "which tools is my agent actually using most?" and "which MCP server is the most expensive?"

**Per-Tool Analytics** — drill into any individual tool (whether MCP-backed or built-in) to see:
- Call frequency over time
- Average and p95 response latency
- Argument patterns (what inputs are most common)
- Output size distribution
- Error types and frequency
- Token cost attribution per call

**Tool Use in Session Context** — in Session Replay and Agent Interaction Diagrams, MCP tool calls are rendered as distinct node types with the originating server identified. A `mcp:github/create_pr` call is visually distinguishable from a `Bash` call or a `Read` call, and clicking it reveals the full request/response payload.

**Per-Agent, Per-Skill, Per-Session Breakdown** — tool use statistics are available at every granularity Norbert tracks. Understand which agents lean on which MCP servers, whether a particular skill consistently triggers expensive tool calls, and how tool use patterns differ between sessions tackling similar tasks.

**MCP Config Viewer** — the MCP Servers tab in the Configuration Viewer (owned by `norbert-config`) shows all configured MCP servers from `.mcp.json` and `~/.claude.json`. `norbert-mcp` reads this configuration data to provide runtime attribution — connecting live tool call activity to the server definitions that produced it.


---

### 17. Notification Center (`norbert-notif`)

A dedicated notifications plugin that gives users fine-grained control over which Norbert events trigger an alert, how that alert is delivered, and what sound accompanies it. All notifications are opt-in and individually togglable — the default state is silent on everything except the first-launch restart reminder.

`norbert-notif` is a first-party plugin that ships bundled with Norbert and is enabled by default. Other plugins (including `norbert-anomaly` and `norbert-cc-plugin-nwave`) fire into it via the Norbert event bus rather than managing their own notification delivery.

---

**Notification Events**

The following events are individually togglable. Each has a default state (on or off) chosen to be useful without being noisy out of the box:

| Event | Default | Description |
|---|---|---|
| Session response completed | ✅ On | A Claude Code session or agent task finishes |
| Session started | Off | A new Claude Code session begins |
| Context compaction occurred | ✅ On | An agent's context window was compacted |
| Token count threshold reached | Off | Cumulative session tokens cross a user-defined mark |
| Cost threshold reached | ✅ On | Session cost crosses a user-defined dollar amount |
| Context window % threshold | ✅ On | An agent's context window fills past a user-defined % (default 75%) |
| Hook error detected | ✅ On | A registered hook fired and returned an error |
| Hook timeout | ✅ On | A hook did not respond within its timeout window |
| DES enforcement block | ✅ On | nWave DES blocked a tool call (requires nWave plugin) |
| Agent spawned | Off | A new sub-agent is spawned during a session |
| Agent completed | Off | An individual sub-agent finishes its task |
| Anomaly detected | ✅ On | The anomaly detector fires on cost spike, retry rate, etc. |
| Session digest ready | Off | A session digest has been generated and is ready to read |
| Credit balance low | ✅ On | API credit balance falls below a user-defined threshold |

Threshold values (token count, cost amount, context %, credit balance) are configured per-event in the notification settings. Each threshold event also has a **repeat mode** — fire once per session when the threshold is first crossed, or fire again each time it is exceeded by a configurable increment (e.g. every additional $0.50 of cost).

---

**Delivery Channels**

Each notification event can be independently routed to any combination of delivery channels:

- **Windows Notification Center** — a native OS toast notification with the Norbert icon, event title, and a one-line summary. Clicking the toast opens the relevant session or panel in the Norbert dashboard. This is the default channel for all enabled events.
- **Norbert Dashboard Banner** — an in-app banner at the top of the dashboard that persists until dismissed. Useful for events the user wants to act on before continuing rather than just be informed of.
- **Tray Icon Badge** — a colored dot or count badge on the Norbert tray icon. Useful as a passive indicator without interrupting focus.
- **Email** — sends an email to a configured address via SMTP. Intended for events that warrant async follow-up (e.g. a long-running autonomous session completing overnight). Requires SMTP configuration in settings.
- **Webhook** — POSTs a JSON payload to a user-configured URL. Enables integration with Slack incoming webhooks, custom automation endpoints, or any other HTTP-receiving system. Payload includes event type, timestamp, session ID, and relevant metric values.

Delivery channel assignment is per-event. A cost threshold breach might be configured to fire a Windows toast and a Slack webhook. A session completion might only ring a sound. An anomaly might trigger an email. The settings UI presents a grid of events × channels with checkboxes so the full configuration is visible at a glance.

---

**Sound**

Each enabled notification event can have a sound assigned to it. Sound configuration is per-event and independent of the delivery channel — a notification can play a sound with or without a toast, and can play different sounds for different events.

**Built-in sounds** ship with `norbert-notif`, themed to the Norbert aesthetic:

| Sound | Character |
|---|---|
| `phosphor-ping` | Clean, short synthetic chime — default for most events |
| `amber-pulse` | Low, warm pulse — for warnings and threshold crossings |
| `compaction` | A brief mechanical "whoosh" — specifically for context compaction events |
| `session-complete` | A satisfying two-tone resolution — for session completions |
| `des-block` | A sharp, dry click — for DES enforcement blocks |
| `silence` | No sound — for events where only a visual notification is wanted |

**Custom sounds** — users can add their own audio files (`.wav`, `.mp3`, `.ogg`) by dropping them into `~/.norbert/sounds/`. They appear in the sound picker for any event alongside the built-in set.

**Volume** is set globally for all Norbert sounds, separate from system volume. A test button in settings plays the selected sound at the configured volume immediately.

**Do Not Disturb** — a global mute toggle accessible from the tray icon context menu and the dashboard status bar. When enabled, all sounds and OS toast notifications are suppressed; dashboard banners and tray badge updates continue. DND state is shown in the status bar. An optional schedule (e.g. mute between 22:00 and 08:00) can be configured in settings.

---

**Settings Surface**

`norbert-notif` registers a **Notifications** section in Norbert Settings (reachable via `Ctrl+,` → Notifications). The settings panel has three sub-sections:

- **Events** — the full event × channel grid with toggles, threshold inputs, and sound pickers per event
- **Channels** — configuration for each delivery channel: SMTP credentials for email, webhook URL and payload template for webhooks, badge style for tray
- **Do Not Disturb** — global mute toggle and schedule

A **Test** button on each configured delivery channel sends a test notification immediately to verify the channel is working.

---

**Plugin Event Bus Integration**

Other plugins fire notifications by emitting named events on the Norbert event bus. `norbert-notif` subscribes to these events and handles delivery — plugins do not manage notification delivery themselves. This means notification behavior is always user-configurable regardless of which plugin originates the event.

```typescript
// From norbert-anomaly plugin — fires into norbert-notif
api.events.emit('norbert:anomaly', {
  type: 'cost_spike',
  sessionId,
  value: currentCost,
  baseline: avgCost,
});

// norbert-notif handles delivery based on user's notification settings
```

The nWave plugin emits `norbert:des_block`, `norbert:wave_complete`, and `norbert:artifact_produced` events through the same mechanism.

---

### 18. Session Debugger (`norbert-debug`)

Debugging a multi-agent Claude Code session is a fundamentally different problem from debugging code. There is no stack trace. The failure may not have produced an error — the session may have completed successfully and still produced the wrong result, spent too much, or taken an unexpected path. Understanding what happened requires reconstructing a causal chain across agents, tool calls, hook decisions, and context state — from data that is normally scattered across opaque logs or invisible entirely.

`norbert-debug` is a forensic workbench for a single session. It synthesizes data from hooks, session history, agent interactions, and prompt archaeology into a unified investigative view purpose-built for the question "why did this session do that?"

---

**The Causal Event Inspector**

The primary view is a unified chronological event timeline for the selected session. Every event Norbert has captured is represented: agent spawns, tool calls, hook firings, context compactions, DES enforcements, cost threshold crossings, retry attempts, agent completions. Events are rendered as rows in a dense, compact list — not a graph, not a diagram, a list — because forensic investigation is fundamentally sequential.

Selecting any event expands it to show full context:

- **What preceded it** — the N events immediately before, highlighted in the timeline
- **What it produced** — the tool result, agent output, or hook response
- **Agent state at the moment** — context window utilization, tokens consumed so far, active tools
- **Hook decision** — if a hook fired on this event, what it received and what it returned (pass/block/modify)
- **Cost attribution** — estimated token cost for this specific event
- **Causal links** — if this event triggered another (e.g. a tool call that spawned a sub-agent), those downstream events are linked and navigable

The timeline is filterable using the standard session model filter facets — filter to a specific agent, a specific tool, only blocked events, only events above a cost threshold. The filter bar at the top of the inspector updates the timeline in real time.

---

**Error & Retry Archaeology**

When an agent retried a tool call, `norbert-debug` shows the full retry chain: each attempt, its arguments, its result, and why it was retried. For hook-blocked tool calls, it shows the exact hook response that caused the block and which hook rule matched. This is the data that currently exists only in silent logs, now rendered as a legible narrative.

**Diff view** — for retried tool calls where the arguments changed between attempts, Norbert shows a diff of the argument changes. For agents that were retried with a modified prompt, the prompt diff is shown inline.

---

**Context State Replay**

At any point in the timeline the user can ask "what did this agent's context look like at this moment?" `norbert-debug` reconstructs the approximate context state — system prompt, injected memory, conversation history up to that point, estimated token breakdown — using the same mechanism as Prompt Archaeology (Feature 15) but anchored to a specific timeline moment rather than a static invocation. This answers questions like "did this agent have the right information when it made this decision?"

---

**Debug Annotations**

Users can attach text annotations to any event in the timeline — notes about what they found, hypotheses, conclusions. Annotations persist in SQLite and are visible in future replays of the same session. A session can be exported with its annotations as a Markdown debug report, suitable for sharing with collaborators or filing as a project post-mortem.

---

**MCP tools added by `norbert-debug`:**

| Tool | Description |
|---|---|
| `get_event_timeline` | Full chronological event list for a session, filterable by agent, tool, event type |
| `get_event_detail` | Full context for a specific event — preceding events, result, hook decision, cost |
| `get_retry_chain` | Full retry history for a specific tool call or agent invocation |
| `get_context_state_at` | Reconstructed context state for an agent at a specific timeline position |

These tools make `norbert-debug` directly useful for agent self-inspection: a coordinator that encounters an unexpected result can call `get_event_timeline` on its own session to reconstruct what happened before escalating or retrying.

---

**Plugin dependencies:** `norbert-session`, `norbert-agents`, `norbert-archaeology`

**Delivery:** Medium — requires session data layer and archaeology engine to be stable first. The event timeline UI is straightforward React; the complexity is in the causal linking and context state reconstruction.

---

### 19. Performance Profiler (`norbert-perf`)

Where `norbert-debug` asks "why did this go wrong?", `norbert-perf` asks "where is my budget going, and how can I spend it better?" Nothing needs to have gone wrong. The profiler is useful on every session — it surfaces the distribution of time, tokens, and cost across agents, tools, and phases, making optimization opportunities visible that would otherwise require manual calculation across raw data.

The mental model is a **flame graph for Claude Code sessions** — a visual representation of where resources were consumed, structured to reveal bottlenecks, inefficiencies, and outliers at a glance.

---

**Session Flame Graph**

The primary view renders a horizontal flame graph of the selected session. The x-axis is time (session duration). The y-axis is hierarchy depth (coordinator → specialist → sub-agent). Each agent is a colored bar spanning its active duration. Tool calls within each agent appear as narrower bars inside the agent bar. The width of each bar encodes time; a color overlay encodes cost (cool → warm → hot as cost increases).

Reading the flame graph immediately answers:
- Which agents ran longest?
- Which tool calls were most expensive?
- Were agents running in parallel or sequentially?
- Where were the gaps — time spent waiting for tool results?
- Which sub-agent consumed the most budget relative to its parent?

The flame graph is interactive: hover for details, click to drill into any agent or tool call, click to filter the rest of the profiler to that scope.

---

**Token Efficiency Analysis**

For each agent and tool call, `norbert-perf` calculates efficiency ratios — not just absolute token counts, but tokens relative to what was produced:

- **Output density** — tokens in the result relative to tokens consumed to produce it. A high-consumption low-output agent is a candidate for prompt optimization.
- **Context efficiency** — what percentage of the context window was actually referenced in the output? (approximated from overlap analysis)
- **Retry overhead** — tokens consumed in failed/retried attempts as a percentage of total agent cost. High retry overhead means the agent is spending budget on failed work.
- **Tool call ROI** — for expensive tool calls, was the result actually used in the downstream output? This requires cross-referencing tool results against subsequent agent outputs — a heuristic, not exact, but useful.

These ratios are displayed as a ranked table alongside the flame graph, sorted by "optimization opportunity" — agents and tools where spending is highest relative to apparent contribution.

---

**Latency Profile**

Separate from token cost, `norbert-perf` profiles wall-clock latency across the session:

- **Time-to-first-token** per agent invocation
- **Tool call latency** distribution — p50, p95, p99 per tool across the session and historically
- **Hook latency** contribution — synchronous hooks add latency to every tool call; `norbert-perf` surfaces the cumulative hook overhead per session
- **Parallelism efficiency** — for sessions with concurrent agents, what percentage of the session duration had multiple agents running simultaneously vs. sequential bottlenecks?

A **latency waterfall** view shows each agent invocation as a horizontal bar on a shared time axis, making parallel vs. sequential execution immediately visible. Gaps between bars are "dead time" where neither tokens nor tool calls were active — often pointing to hook processing delays or network latency on MCP calls.

---

**Cross-Session Performance Trends**

Beyond single-session analysis, `norbert-perf` provides aggregate trend views across the filtered session scope:

- **Cost per session over time** — are sessions getting more or less expensive?
- **Agent efficiency trends** — is a specific agent getting better or worse at its task over multiple sessions?
- **Tool call latency trends** — is a specific MCP server getting slower?
- **Retry rate trends** — are retries increasing for a specific agent, suggesting prompt degradation or task drift?

These trends are rendered as small multiples — a grid of sparklines, one per tracked metric, each showing the trend over the last N sessions in scope. Outlier sessions are highlighted; clicking one loads that session in the flame graph.

---

**Optimization Recommendations**

`norbert-perf` generates a short ranked list of specific, actionable optimization recommendations based on the profiled session data:

- *"tdd-crafter consumed 68% of session cost with a retry rate of 34% — consider reviewing its system prompt for ambiguous instructions"*
- *"mcp:github tool calls averaged 840ms latency — 3× the session average for MCP calls"*
- *"coordinator spawned reviewer sequentially after architect completed — these agents did not share context and could potentially run in parallel"*
- *"context compaction occurred twice in architect — peak context usage was 94%, suggesting the task scope may benefit from decomposition"*

Recommendations are heuristic, not prescriptive. They surface patterns worth investigating; the user decides whether they represent real problems. Each recommendation links to the relevant flame graph region or agent event so the user can verify the underlying data.

---

**MCP tools added by `norbert-perf`:**

| Tool | Description |
|---|---|
| `get_session_flame` | Flame graph data for a session — agent durations, tool call spans, cost overlay |
| `get_efficiency_report` | Token efficiency ratios by agent and tool for a session |
| `get_latency_profile` | Latency distribution for agents, tools, and hooks in a session |
| `get_optimization_hints` | Ranked optimization recommendations for a session |
| `get_perf_trends` | Cross-session performance trend data for agents and tools |

An agent can call `get_optimization_hints` on its own current session to self-identify inefficiencies mid-run — a direct application of the cybernetic feedback loop Norbert is built around.

---

**Plugin dependencies:** `norbert-session`, `norbert-agents`, `norbert-mcp`

**Delivery:** Medium-to-later — the flame graph and efficiency ratios require a mature session data layer. The latency profile and hook overhead analysis can ship earlier as simpler table views before the full flame graph visualization is built.

---

## Claude Account Integration

For users with an Anthropic Admin API key, Norbert connects to the Anthropic Console API to surface:

- **Credit balance** and auto-reload status
- **Rate limit headroom** — current usage vs. limits for tokens/minute and requests/minute
- **Billing history** — cost by model, workspace, and date range pulled from the Console usage report endpoints
- **API key inventory** — which keys exist in the organization and their usage contribution

This data is displayed alongside locally-derived session data, allowing users to see both the fine-grained attribution Norbert tracks locally and the billing actuals from Anthropic's systems.

**Important limitation:** Admin API access requires an organizational account with the admin role. Claude Max and Pro subscription users who access Claude Code via subscription rather than API keys do not have Admin API access. For these users, all metrics and usage data are derived entirely from local hook telemetry, and the account integration section gracefully indicates this with a clear explanation.

---

## nWave Plugin (Optional)

Norbert supports a first-party plugin for nWave AI users that adds a dedicated **nWave tab** to the dashboard. The plugin is installed separately and activates automatically when Norbert detects nWave configuration in the user's `.claude/` directory.

```bash
npm install -g norbert-cc-plugin-nwave
```

nWave organizes work into structured waves — typically phases like Discover, Design, and Deliver — each orchestrated by a coordinator agent that spawns and directs specialist agents. This structure is semantically richer than generic multi-agent sessions, and the nWave plugin surfaces it with visualizations and analytics purpose-built for the nWave model.

---

### nWave Session Overview

The nWave tab presents a session in wave-native terms rather than generic agent/tool terms. The top-level view shows each wave phase as a lane, with the coordinator and its specialist agents nested within it. At a glance, users can see which phases completed, which are in progress, and where the session spent the most time and tokens.

A wave health summary for each phase shows: duration, total cost, number of agent invocations, artifacts produced, and whether the phase completed cleanly or encountered blocks.

---

### Wave Flow Diagram

A swimlane sequence diagram rendered specifically for nWave's orchestration model. Each lane represents a wave phase. Within each lane, agent invocations are shown in the order they were spawned, with:

- The initial prompt passed from the coordinator to each specialist
- The specialist's return value or artifact back to the coordinator
- Tool calls made during the invocation (with MCP server attribution)
- Token usage and cost annotated at each step
- Duration bars showing relative time spent

The diagram makes it immediately clear how the coordinator distributed work, what each specialist produced, and where bottlenecks or retries occurred. It is exportable as SVG for documentation or retrospectives.

---

### nWave Artifact Browser

nWave sessions produce structured artifacts — ADRs, architecture specs, user stories, acceptance tests, JTBDs, implementation plans, code files, and more — as outputs of each wave phase and each individual specialist agent. These artifacts are currently scattered across the file system and in-context agent outputs with no single place to find, navigate, or review them.

The Artifact Browser is a first-class navigation surface for everything a nWave session produced, organized so that the question "what did this wave deliver?" is answerable in seconds.

---

**Artifact Organization**

Artifacts are browsable along two axes, switchable via a toggle in the browser toolbar:

- **By Stage** — artifacts grouped under the wave phase that produced them (Discover, Design, Deliver, or any custom phase). Within each stage, artifacts are further grouped by the agent that created them, with the agent's name and description displayed as the group header.
- **By Agent** — artifacts grouped under the agent that produced them, with the agent's name and description as the group header. Within each agent group, artifacts are listed in the order they were produced, with the stage they were produced in noted as a badge.

Both views show the same set of artifacts — the grouping is purely navigational. The toggle is persistent per-session so users can switch back and forth without losing their place.

---

**Artifact Types**

The browser recognizes and renders a set of standard nWave artifact types with appropriate icons, display names, and preview treatments:

| Type | Icon | Examples |
|---|---|---|
| ADR | 📋 | Architecture Decision Records |
| Aspec | 📐 | Architecture specs, system design docs |
| User Story | 👤 | User story cards, acceptance criteria |
| Acceptance Test | ✅ | Test specs, BDD scenarios, test plans |
| JTBD | 🎯 | Jobs-to-be-done statements |
| Implementation Plan | 🗂️ | Step plans, task breakdowns |
| Code File | 💻 | Source files written by the agent |
| MCP Artifact | 🔌 | GitHub PRs, issues, API responses |
| In-Context Output | 📨 | Structured data returned between agents |
| Other | 📄 | Any file artifact not matching above types |

Type detection is heuristic — based on file name patterns, directory path, and content markers where readable. For in-context artifacts (structured outputs passed between agents rather than written to disk), type is inferred from the output schema. Users can manually reclassify a misidentified artifact from the detail view.

---

**Artifact List View**

Each artifact in the list shows:
- Type icon and type label
- Artifact name (file name or inferred title for in-context artifacts)
- Producing agent name and stage badge
- File size / token count
- Timestamp produced
- A one-line excerpt or description where available

Clicking an artifact opens the **Artifact Detail Panel** as a right flyout.

---

**Artifact Detail Panel**

The detail panel for a selected artifact shows:

- Full artifact name and type
- **Producing agent** — name, description, and a link to that agent's scorecard
- **Stage** produced in, with a link to the Stage view for that phase
- **Timestamp** and session context
- **Content preview** — rendered Markdown for document artifacts; syntax-highlighted code for code files; structured display for JSON/YAML; raw text fallback for anything else. In-context artifacts (agent-to-agent outputs) render their structure in a collapsible tree view.
- **Provenance chain** — which agent produced this artifact, from which prompt, in response to which coordinator instruction. This traces the artifact back through the session event data to its origin.
- **Downstream references** — if this artifact was subsequently read or referenced by another agent (e.g. the architecture spec produced in Design was read by the delivery sub-agents), those references are listed with links to the consuming agent.
- **Export** — download the artifact as its original file, copy content to clipboard, or open in the user's configured editor.

---

**Artifact Summary Card**

At the top of the Artifact Browser for a session, a summary card shows:
- Total artifact count by type (e.g. "3 ADRs · 12 user stories · 8 acceptance tests · 4 code files")
- Total file size of all file artifacts
- The most prolific producing agent (by artifact count)
- A timeline showing when in the session artifacts were produced — useful for seeing whether a phase front-loaded or back-loaded its output

---

**Cross-Session Artifact Search**

From the Sessions panel, a global artifact search allows querying artifacts across all nWave sessions. Searchable by artifact name, type, content (for text artifacts), producing agent, and session date range. Results link directly into the per-session Artifact Browser at the matching artifact. This is how a user finds "all ADRs from deliver sessions in the last month" or "all user stories produced by the requirements-specialist agent."

---

### nWave Skill Analytics

nWave relies heavily on skills to give specialist agents their domain-specific capabilities. The skill analytics view shows, per session and across sessions:

- Which nWave skills were activated and in which phases
- Token cost attributed to skill context injection (via Prompt Archaeology integration)
- Skill invocation frequency by agent type
- Whether skills are being used in the phases they were designed for, or showing up unexpectedly

This is particularly useful for teams building and tuning custom nWave skill sets — it provides empirical data on whether skills are being invoked as intended and what they are costing.

---

### nWave Agent Scorecards

An extension of the general Agent Performance Scorecards (Feature 12), nWave scorecards are organized by agent *role* within the nWave taxonomy rather than by individual agent name. Each scorecard header shows the agent's **name** and its full **description** — the description is the most important context for interpreting the metrics, since the same role label (e.g. "specialist") may cover agents with very different responsibilities depending on the wave type. A link to the agent's definition in the Configuration Viewer is always present.

Across all sessions, Norbert tracks how coordinator agents, discovery specialists, design specialists, delivery specialists, and any custom role types perform:

- Average phase completion cost by role
- Retry and block rates by role and wave phase
- Most common tool use patterns per role
- Which specialist roles tend to be the most expensive within a wave
- Artifact output volume by role (from the Artifact Browser data)
- Context window utilization history per role

Over time, these scorecards give nWave practitioners data to make informed decisions about how to structure their waves and which roles to invest in optimizing.

---

### DES (Delivery Enforcement System) Visualizer

The DES is nWave's quality enforcement layer — it monitors every agent tool invocation during `/nw:deliver` sessions to enforce TDD discipline and prevent out-of-session edits. It is one of the most active and consequential systems in a nWave session, but its activity is currently only visible as individual text messages in the Claude Code terminal. There is no way to see the overall compliance picture, understand patterns in where enforcement fires, or measure whether your agents are consistently completing all required TDD phases.

Norbert's DES Visualizer makes this enforcement activity a first-class visual concern.

---

**DES Status Indicator**

During an active `/nw:deliver` session, the Norbert tray icon badge gains a DES status ring — green when enforcement is nominal, amber when warnings have fired, red when a blocking enforcement event has occurred. Opening the dashboard during a live deliver session shows a DES panel front and center with the current rigor level, active step ID, current TDD phase, and a live feed of enforcement events as they occur.

---

**TDD Phase Compliance Heatmap**

For each completed deliver session, Norbert renders a grid showing every step against the four required TDD phases: RED, GREEN, REFACTOR, COMMIT. Each cell in the grid is colored by outcome:

- ✅ Green — phase completed cleanly
- ⚠️ Amber — phase completed after a DES warning or retry
- ❌ Red — phase was skipped or incomplete when the sub-agent returned
- ⬜ Grey — phase not applicable for this step

This heatmap gives an immediate visual answer to "how cleanly did this deliver session follow TDD discipline?" and makes it easy to spot which steps or agents consistently struggle with particular phases. Over multiple sessions, the aggregate heatmap reveals systemic patterns — for example, if REFACTOR is amber or red across most sessions, that is a signal worth acting on.

---

**Enforcement Event Timeline**

A chronological log of every DES enforcement event during a session, rendered as an annotated timeline alongside the general session timeline. Each event shows:

- The enforcement type (out-of-session edit attempt, missing TDD phase, step-ID pattern without DES markers, sub-agent returned early)
- The agent that triggered it
- The step ID in progress at the time
- Whether it was a warning (execution continued) or a block (execution halted)
- How it was resolved — exempted via `DES-ENFORCEMENT: exempt`, re-dispatched, or finalized

The timeline makes it easy to reconstruct exactly what happened during a complex deliver session where enforcement fired multiple times, without having to scroll through terminal output.

---

**Step Execution Flow**

A swimlane diagram specific to DES-managed delivery, showing step execution across the session. Each step is a row; columns represent TDD phases. The diagram shows the order steps were executed, which sub-agents handled each phase, and where the DES intervened. Parallel step execution (where nWave dispatches multiple sub-agents simultaneously) is rendered as parallel lanes.

This is the deliver-session equivalent of the general Wave Flow Diagram, but with TDD phase structure as the organizing principle rather than wave phase structure.

---

**DES Audit Log Viewer**

The DES writes audit logs to disk during deliver sessions. Norbert surfaces these as a structured, searchable viewer rather than raw log files. Logs are organized by session and step, with filtering by enforcement type and outcome. The viewer respects DES's own retention window configuration from `~/.nwave/des-config.json` and shows when logs have been rotated.

---

**Rigor Level History**

A timeline showing how the `/nw:rigor` setting has changed across sessions — lean, standard, or custom. Correlated against session cost and TDD compliance scores, this makes it easy to see the practical tradeoff between rigor levels in your own workflow. Did standard rigor sessions produce cleaner heatmaps? Did lean sessions cost significantly less? The data answers it.

---

**DES Health at Session Start**

The DES performs background housekeeping at every session start — removing expired audit logs, cleaning up signal files from crashed sessions, rotating the skill-loading log. Norbert captures this activity (currently silent) and surfaces it as a brief session initialization panel, showing what was cleaned up and flagging anything anomalous (e.g. an unusually large number of signal files from crashed sessions, which may indicate a stability issue worth investigating).

---

### Cross-Wave Analytics

For users who run nWave sessions repeatedly on similar projects, cross-wave analytics compares performance across sessions:

- Cost per wave phase across sessions (is Discover getting more expensive over time?)
- Artifact output volume trends
- Agent invocation count trends by phase
- Time-to-completion by wave type

These comparisons require enough session history to be meaningful, so Norbert accumulates them passively and surfaces them once sufficient data exists.

---

## Session Model — Filterable Event Stream

Every piece of data Norbert collects is an event: a hook firing, a tool call, an agent spawning, a token count, a cost increment, a DES enforcement, a context compaction. These events are timestamped, attributed to a session and an agent, and stored in SQLite. Everything Norbert displays is a query against this event stream — filtered, aggregated, and rendered by whichever view is active.

This is the underlying abstraction that unifies all of Norbert's views. It is not a special "session viewer" feature or a separate "analytics mode." It is the data model everything runs on.

---

### Per-Plugin Filter and Mode Ownership

**Each plugin owns its own filter and time-mode controls.** There is no global filter bar that all plugins must respond to. Instead, each plugin declares the filter dimensions and time modes it supports, and those controls are rendered directly in the plugin's zone toolbar alongside its mode tabs. The zone toolbar is the plugin's complete control surface — tabs for mode switching, and inline controls for scope filtering, all in one compact row.

This is the right model because Norbert's plugins do not share a single coherent "current state." The Configuration Viewer has no meaningful live/playback distinction — it reads files at rest. The Sessions list *is* a list of sessions — it doesn't get filtered by agent in a useful way, it is how you pick sessions. The Oscilloscope's time axis is already intrinsic to its view, scrolling and scrubbing on its own terms. Forcing all of these to respond to a single global mode toggle creates false uniformity and makes the toolbar a lie — a control that claims to affect everything but only actually matters to some plugins.

Per-plugin ownership means each plugin's controls are always meaningful for that plugin. The Live Session Visualizer's toolbar shows a Live/Playback toggle and a session picker — because those are the only things that matter to it. The Usage Trends view shows a time range picker and a session multi-select — because that's what drives it. The Configuration Viewer shows nothing — because nothing affects it.

---

### The Context Broadcast Bar

A single global control does exist, but it is a **suggestion mechanism, not a mandate**. The narrow bar that was formerly the "session bar" becomes the **Context Broadcast Bar** — a slim strip that lets the user broadcast a session context hint to all plugins that have opted in.

```
[⬡ Context: nw:deliver — user-auth ▾]  [● live]   ···   [$0.84  ⚡ 87k]
```

The broadcast bar contains:
- **Session context picker** — a compact dropdown to select a session. Setting this broadcasts `contextSession: <id>` to all subscribed plugins as a soft default. Plugins that have opted into context broadcast use this as their initial session scope when they open, and show a "📡" indicator in their toolbar while tracking it.
- **Live indicator** — a simple status dot reflecting whether a live session is active. Not a toggle — just ambient awareness. Clicking it navigates to the Sessions list.
- **Cost ticker** — shows aggregate cost across the broadcast session context. A persistent, ambient number visible regardless of which plugin is active.

The broadcast bar is visually minimal — one row, low height, no chrome overhead. It is not the primary filter surface. Most users will set it once when a session starts and leave it. Power users doing cross-plugin investigation will set it to snap all live-mode plugins to the same session simultaneously.

**Opt-in, not opt-out.** A plugin subscribes to the broadcast by declaring `broadcastContext: true` in its registration. Session-scoped plugins (Live Visualizer, Oscilloscope, Archaeology) opt in by default. Config-agnostic plugins (Configuration Viewer, Plugin Marketplace) never subscribe. Aggregate views (Usage Trends, Scorecards) may subscribe to set an initial session scope but still expose their own multi-session override.

When a live session starts, the broadcast bar automatically updates its session context to the new session and displays a toast: "New session detected — broadcasting to subscribed plugins." Plugins that are in live mode update immediately. Plugins in playback mode are offered but not forced to follow.

---

### Filter Dimensions

The following filter dimensions are the vocabulary plugins draw from when declaring their own controls. Not every plugin exposes every dimension — each plugin registers only the dimensions relevant to its views.

**Session** — which sessions are in scope
- `live` — only currently active sessions
- A single named session — focus mode for session-scoped views
- Multiple selected sessions — for aggregate comparison views
- A saved filter set — e.g. "nWave deliver sessions", "last 7 days", "over $1.00"

**Agent** — which agents within the scoped sessions are included
- `all agents` — default
- By name — exact or glob pattern (`tdd-crafter`, `nwave:*`)
- By role — coordinator, specialist, reviewer, etc.
- By status — active, completed, errored, blocked
- Cross-references `norbert-config`'s agent definitions for list-based selection

**Tool** — which tool calls are in scope
- `all tools` — default
- By tool name — `Bash`, `Write`, `mcp:github/*`
- By MCP server — all tools from a specific server
- By outcome — succeeded, errored, DES-blocked

**Token / Cost** — threshold filters
- Sessions or agents above a cost threshold
- Context utilization above a percentage
- Agents with above-average token consumption

**Time range** — absolute or relative
- Last N hours / days / weeks; a specific date range; relative shorthands

**Hook event type** — filter the raw event stream
- e.g. only `PreToolUse` events where the tool was blocked

**DES / nWave** *(when nWave plugin active)*
- By wave type — Discover, Design, Deliver
- By DES phase and outcome

---

### How Views Declare Filter and Mode Controls

Each view declares its own filter surface and time mode support. The Norbert shell renders these controls in the zone toolbar immediately to the right of the mode tabs, using a compact inline style.

```typescript
api.ui.registerView({
  id: 'session-live-viz',
  label: 'Live Graph',
  primaryView: true,
  tabOrder: 0,
  broadcastContext: true,        // tracks context broadcast session
  timeMode: ['live', 'playback'],
  defaultTimeMode: 'live',
  filterControls: [
    { dim: 'session', style: 'picker', cardinality: 'single' },
  ],
  onFilterChange: (filter) => { /* re-render */ },
  onTimeModeChange: (mode, scrubPosition) => { /* re-render */ },
});

api.ui.registerView({
  id: 'usage-trends',
  label: 'Cost Trend',
  tabOrder: 2,
  broadcastContext: false,       // manages its own session scope
  timeMode: ['playback'],        // aggregate trends have no live mode
  filterControls: [
    { dim: 'session', style: 'multi-select', cardinality: 'multi' },
    { dim: 'time',    style: 'range-picker' },
  ],
});

api.ui.registerView({
  id: 'config-viewer',
  label: 'Agents',
  tabOrder: 0,
  broadcastContext: false,
  timeMode: [],                  // no time mode — static view
  filterControls: [],            // no filter controls
});
```

**Toolbar rendering rules:**

Mode tabs always appear first (leftmost). Filter controls appear immediately after the active mode's tab, rendered inline. A Live/Playback toggle only renders if the active view declares `timeMode` with more than one option. A timeline scrubber appears below the zone (not the toolbar) only when a session-scoped view is in playback mode — it is per-zone, not per-window, because two zones can independently be in live vs. playback.

**Three compatibility tiers** that map to the configuration/runtime boundary:

| Tier | Examples | Session filter | Agent filter | Time mode |
|---|---|---|---|---|
| **Config-agnostic** | Configuration Viewer, Plugin Marketplace | None | None | Static only |
| **Aggregate** | Scorecards, Usage Trends, Constellation, Heatmap | Multi-select | Multi | Playback only |
| **Session-scoped** | Live Visualizer, Oscilloscope, Replay, Archaeology | Single-picker | Multi | Live or Playback |

When a view's declared constraints are violated by the current filter state, the view shows a graceful inline message rather than breaking — "Select a single session to use this view." The incompatible control is highlighted in the toolbar, not hidden, so the user understands how to satisfy the constraint.

---

### Auto-Behavior Defaults

Norbert sets sensible defaults so the dashboard is never empty and never confusing:

| Condition | Broadcast context | Plugin default |
|---|---|---|
| Live session active | That session | Subscribed plugins → live mode |
| Multiple live sessions | Most recently started | Subscribed plugins → live, others unaffected |
| No live session | Most recent session | Subscribed plugins → playback |
| Fresh install | None | All plugins → empty state with onboarding prompt |

When a new live session starts while Norbert is open, the broadcast bar updates and shows a non-intrusive banner. Subscribed plugins in live mode update immediately. Subscribed plugins in playback mode are offered but not forced to follow.

---

### MCP Query Interface — Filter as Query

The filter model maps directly onto the Norbert MCP server's query interface. When an agent calls `query_sessions` or `query_tool_use`, it is constructing the same filter programmatically that a human would set via a plugin's filter controls. The MCP tools accept the same filter dimensions — session id, agent name, tool name, time range, cost threshold — and return the same event stream data the UI renders.

The filter model is not just a UI concern. It is the canonical query language for Norbert's data, usable by both humans (via plugin controls) and agents (via MCP tool calls).

---

Norbert exposes its local SQLite data as an MCP server, allowing Claude Code users to ask natural language questions about their own usage, sessions, agents, and DES compliance data directly inside a Claude Code session — without switching to the dashboard.

```json
{
  "mcpServers": {
    "norbert": {
      "type": "stdio",
      "command": "norbert-cc",
      "args": ["mcp"]
    }
  }
}
```

**Install-time registration**

Norbert registers this MCP server entry automatically during install. The postinstall script merges the `norbert` entry into `~/.claude.json` (the global Claude Code MCP config) using the same surgical merge pattern used for hook registration — a backup is made first, the existing config is preserved, and only the `norbert` key is added. After the merge, a banner prompts the user to restart Claude Code. From that point on, the Norbert MCP server is available in every Claude Code session, every agent, every sub-agent — without any manual configuration step. Users who want to opt out can remove the entry from their MCP config at any time; Norbert does not re-add it on subsequent launches.

---

**Cybernetic introspection — Claude observing itself**

This is the feature that closes the feedback loop in the truest sense of Norbert Wiener's original vision. Claude Code, through its agents, can query Norbert's MCP server to observe its own behavior — not as a user asking about past sessions, but as a running agent inspecting its own current state mid-session.

A coordinator agent can call `get_norbert_status` at any point and receive back: the live session cost so far, how many agents have been spawned, which agents are currently active, context window utilization per agent, hook health, and any anomalies Norbert has flagged. It can call `query_tool_use` to see which tools it has called most in the current session and whether any are showing elevated latency. It can call `query_agents` to compare its own performance profile against historical baselines for similar tasks.

This is cybernetic feedback in the technical sense: the system observes its own outputs, compares them against a model of desired behavior, and can adjust. An agent that checks its context utilization and finds it at 78% can choose to summarize and compress before continuing. An agent that sees it has already made 30 `Bash` calls this session and cost $0.40 can decide whether the remaining task is worth the projected spend. A coordinator that queries agent performance history can make better decisions about which specialist to delegate to next.

The practical implication for agent authors is significant: CLAUDE.md files and agent definitions can instruct agents to use Norbert as a first-class observability tool, not just a passive dashboard for human review. An nWave coordinator agent might begin each deliver step by calling `get_norbert_status` to confirm the previous step completed cleanly before proceeding. A long-running agent might call `query_usage_trends` every N tool calls to self-regulate cost.

This is not a gimmick — it is the natural consequence of making session observability available as structured data through a standard protocol. The same MCP interface that lets a human ask "what did I spend this week?" lets an agent ask "what have I spent so far this session, and is that on track?" The data is the same. The consumer is different.

---

**Example queries — human-initiated**

- *"What did I spend on Claude Code this week?"*
- *"Which of my agents is the most expensive on average?"*
- *"Show me sessions where DES enforcement fired more than 3 times."*
- *"What MCP tools am I using most frequently across all sessions?"*
- *"How has my token usage trended over the last 30 days?"*
- *"Which deliver sessions had incomplete TDD phases?"*
- *"What artifacts did my last nWave session produce?"*
- *"Compare my last 5 sessions by cost and duration."*

**Example queries — agent-initiated (self-inspection)**

- *[coordinator, start of deliver step]* `get_norbert_status` → verify previous step's agents completed, check current burn rate is within expected range
- *[tdd-crafter, mid-session]* `query_tool_use` → confirm Bash call count and latency are nominal before spawning another sub-agent
- *[any agent, approaching context limit]* `get_norbert_status` → read own context utilization, decide whether to compress or hand off
- *[nWave coordinator]* `query_des_events` → confirm no DES enforcement violations before advancing the wave phase

Claude queries Norbert's local SQLite database via the MCP tool interface, constructs the answer from real session data, and responds inline. The data never leaves the machine — the MCP server runs locally as a stdio process, exactly like any other local MCP server in Claude Code.

**MCP tools exposed by the Norbert server:**

| Tool | Description |
|---|---|
| `query_sessions` | Filter and retrieve session records by date, cost, duration, agent count |
| `query_tool_use` | Aggregate tool call stats by tool, MCP server, agent, or session |
| `query_agents` | Retrieve agent performance data across sessions |
| `query_des_events` | Query DES enforcement events and TDD phase compliance data |
| `query_artifacts` | List and search artifacts produced across sessions, filterable by type, agent, stage, and session |
| `query_usage_trends` | Time-series aggregations for token and cost data |
| `get_session_detail` | Full detail for a specific session including replay data |
| `get_norbert_status` | Live Norbert state — active session id, current burn rate, per-agent context utilization, spawned agent count, hook health, active anomaly flags. The primary tool for agent self-inspection. |

The MCP server is read-only. It never writes to Norbert's database or modifies any configuration.

---

## Plugin Architecture

Norbert is built as a plugin-first platform. A well-defined plugin API allows third-party developers to extend Norbert with new data sources, visualizations, dashboard tabs, MCP tools, and hook processors — following the same pattern as the first-party nWave plugin.

**Plugin install:**

```bash
npm install -g norbert-plugin-<name>
```

Norbert scans for installed plugins at startup and loads them automatically. Plugins can also be browsed and installed from within Norbert's own Plugin Marketplace tab.

---

### Plugin Capabilities

A Norbert plugin can contribute any combination of the following:

**Dashboard Views** — a plugin can register one or more named views, each independently assignable to any named zone, a floating panel, or a new window. Views are React components rendered inside Tauri webviews. Each view declares a minimum width and height and optionally a `floatMetric` — a live value displayed on the view's minimized floating pill. The nWave plugin exposes four views (Wave Flow Diagram, DES Visualizer, Artifact Browser, nWave Session Overview), each independently placeable. The plugin's `primaryView` is what opens when the sidebar icon is clicked; secondary views are accessible via right-click context menu, drag-and-drop, or the view picker.

**Hook Processors** — a plugin can register handlers for any Claude Code hook event. Processors receive the raw hook payload and can write derived data to their own namespace in Norbert's SQLite database. The nWave plugin uses this to extract DES enforcement events from `PreToolUse` payloads.

**MCP Tools** — a plugin can contribute additional tools to the Norbert MCP server, extending what Claude can query. The nWave plugin exposes `query_des_events`, `query_wave_phases`, and `query_nwave_artifacts` through this mechanism.

**Settings Pages** — a plugin can register a settings panel in the Norbert preferences UI for user-configurable options.

**Tray Menu Items** — a plugin can add items to the Norbert system tray context menu.

**Notification Handlers** — a plugin can subscribe to Norbert's internal event bus (session start/end, anomaly detected, DES enforcement, etc.) and trigger custom notifications or actions.

---

### Plugin API Contract

Plugins are Node.js packages that export a standard manifest and lifecycle interface:

```typescript
export interface NorbertPlugin {
  manifest: {
    id: string;           // e.g. "norbert-plugin-nwave"
    name: string;         // e.g. "nWave"
    version: string;
    norbert_api: string;  // minimum Norbert API version required
    dependencies?: {
      [pluginId: string]: string; // semver range e.g. ">=1.0"
    };
  };
  onLoad(api: NorbertAPI): Promise<void>;
  onUnload(): Promise<void>;
}
```

For example, the nWave plugin declares its full dependency set explicitly:

```typescript
manifest: {
  id: "norbert-cc-plugin-nwave",
  name: "nWave",
  version: "1.0.0",
  norbert_api: ">=1.0",
  dependencies: {
    "norbert-session":     ">=1.0",
    "norbert-usage":       ">=1.0",
    "norbert-agents":      ">=1.0",
    "norbert-mcp":         ">=1.0",
    "norbert-archaeology": ">=1.0",
    "norbert-config":      ">=1.0"
  }
}
```

The nWave plugin does not reimplement any capability provided by its dependencies — it consumes their data and APIs to add nWave-specific semantic interpretation on top. It reads token data from `norbert-usage` and groups it by wave phase. It extends `norbert-agents`' diagrams with wave swimlanes rather than rendering its own. It calls into `norbert-archaeology` for per-agent prompt reconstruction. It reads MCP attribution from `norbert-mcp` and annotates which tool calls occurred in which wave. The dependency graph makes these relationships explicit and enforced.

---

### Dependency Resolution & Disabled Plugin Warnings

Norbert resolves plugin dependencies at load time and enforces them with clear, actionable feedback rather than silent failures.

**At install time**, if a plugin's declared dependencies are not installed, Norbert presents a dependency resolution dialog listing what is missing and offering to install the missing plugins automatically:

> *norbert-plugin-nwave requires the following plugins which are not currently installed:*
> *→ norbert-mcp (not installed)*
> *→ norbert-archaeology (not installed)*
> *Install missing dependencies automatically? [Yes / No / Show Details]*

**At startup**, if a plugin's dependencies are installed but currently disabled by the user, Norbert surfaces a warning in the dashboard notification feed rather than silently loading a degraded plugin:

> *⚠️ nWave plugin: norbert-mcp is disabled. MCP tool attribution in wave diagrams will not be available. [Re-enable norbert-mcp] [Dismiss] [Don't show again]*

The plugin still loads and all features that don't depend on the disabled plugin continue to work normally. Only the capabilities that specifically require the disabled dependency are suppressed, and the UI makes clear which features are unavailable and why. Suppressed features show a greyed-out placeholder with a one-click path to re-enable the required dependency.

**At runtime**, if a dependency plugin is disabled mid-session (e.g. the user disables it from the Plugin Marketplace while nWave is active), Norbert gracefully degrades — features that relied on the now-disabled plugin show the same greyed-out placeholder state, and a tray notification informs the user what changed.

**Version mismatches** are treated as hard failures — if `norbert-plugin-nwave` requires `norbert-agents@>=1.2` but `norbert-agents@1.0` is installed, the nWave plugin refuses to load and the error message specifies exactly which version is needed and how to update.

---

The `NorbertAPI` object passed to `onLoad` provides:

- `db` — a sandboxed SQLite interface scoped to the plugin's namespace, plus read access to core Norbert tables
- `hooks` — register handlers for Claude Code hook events
- `ui` — register dashboard views (pane-hostable), sidebar icons, settings pages, tray items, and status bar items; set sidebar badge counts; views registered here are available in the layout engine's plugin picker and can be placed in any pane
- `mcp` — register additional MCP tools
- `events` — subscribe to and emit Norbert internal events
- `config` — read and write plugin configuration stored in `~/.norbert/plugins/<id>/config.json`
- `plugins` — access the public API surface of declared dependency plugins

The `plugins` API entry is how inter-plugin composition works in practice. Rather than reading raw database tables, a plugin calls into a dependency's exposed API:

```typescript
// nWave plugin reading agent data via norbert-agents public API
const agentAPI = api.plugins.get("norbert-agents");
const sessionAgents = await agentAPI.getAgentsForSession(sessionId);
```

This decouples plugins from each other's internal data schemas — the dependency plugin can change its storage structure without breaking dependents, as long as its public API contract is maintained.

Plugins are sandboxed — they cannot write to Norbert's core database tables, cannot modify hook configuration, and cannot access the OS keychain or file system outside their designated plugin directory. This ensures third-party plugins cannot corrupt Norbert's core data or user configuration.

---

### Core Features as Plugins

With a well-defined plugin architecture in place, most of Norbert's own feature set is implemented as first-party plugins that ship bundled with the core install. This has several benefits: it proves the plugin API works by dogfooding it, it keeps the core binary lean, and it allows users to disable features they don't need.

The distinction between **core** (always present, cannot be disabled) and **first-party plugin** (bundled but optional) is:

**Core — always present:**
- Hook receiver HTTP server
- SQLite database and WAL setup
- `~/.claude/settings.json` merge on install
- Tray icon and window management
- Plugin loader and API
- Norbert MCP server (base tools)

**First-party plugins — bundled, enabled by default, individually disableable:**
- `norbert-session` — Live Session Visualizer, Session Replay, Session Digest
- `norbert-usage` — Usage Analytics, Token Tracking, Cost Burn Ticker, Cost Forecasting, Default Dashboard
- `norbert-dashboard` — Custom Metrics Panel, widget registry, panel editor, `.norbert-panel` import/export *(separate optional plugin, later release)*
- `norbert-config` — Configuration Viewer (Agents tab, Hooks tab, Skills tab, Rules tab, MCP Servers tab, Plugins tab, CLAUDE.md tab), Plugin Marketplace, Config Drift Detection
- `norbert-agents` — Agent Interaction Diagrams, Agent Performance Scorecards, Task Breakdown *(runtime/session-derived only — agent definition files live in `norbert-config`)*, Agent Avatar System *(later release)*
- `norbert-mcp` — MCP Connectivity & Tool Use Visualization
- `norbert-anomaly` — Anomaly Detection
- `norbert-archaeology` — Prompt Archaeology
- `norbert-notif` — Notification Center (sounds, OS toasts, email, webhooks)
- `norbert-debug` — Session Debugger: causal event inspector, retry archaeology, context state replay, debug annotations
- `norbert-perf` — Performance Profiler: session flame graph, token efficiency analysis, latency profile, cross-session trends, optimization recommendations — Anthropic Account Integration

**Third-party plugins — separate install:**
- `norbert-cc-plugin-nwave` — nWave session visualization, DES Visualizer, wave analytics, Artifact Browser

This architecture means a user who only wants cost tracking and the session visualizer can disable everything else and keep Norbert's resource footprint minimal. It also means the community can build plugins for other Claude Code frameworks — a ruflo plugin, a Claude Flow plugin, or framework-specific visualizations — using the same API the nWave plugin uses.

---

## Tech Stack

### Tauri 2.0 — Desktop Shell

Tauri provides the system tray icon, native window management, auto-launch on login, and the application binary that users install. It uses the operating system's native webview (WebKit on macOS, WebView2 on Windows) rather than bundling Chromium, keeping the installed footprint small — typically under 15MB versus 150MB+ for Electron.

Tauri's `sidecar` feature is used to bundle and manage the local HTTP server process alongside the main application. The Tauri shell also handles the one-time `~/.claude/settings.json` merge on first launch, with appropriate file system permissions.

Norbert is a self-contained desktop application. The user clicks the tray icon and the dashboard appears in its own native window — no browser required, no terminal to keep open, no separate service to manage. This is a non-negotiable design constraint that drives the choice of Tauri over lighter-weight alternatives.

**Why not Electron:** Electron is a reasonable choice for many desktop apps — Claude Desktop itself is built on it, as is VS Code, Slack, and Discord. For those apps, bundling Chromium is an acceptable tradeoff for cross-platform consistency and the ability to share code with a web counterpart.

Norbert's situation is different. Its primary users are running Claude Code (an Electron app or terminal process) and likely Claude Desktop (Electron) simultaneously. Adding Norbert as a third Chromium instance on an already-loaded developer machine is a real resource cost that works against the product's goal of being a lightweight, always-on observer. The c9watch project — a Claude Code session monitor built around the same time as Norbert's design — articulated this reasoning directly: "You're already running a bunch of Claude Code agents eating up memory. The monitoring tool shouldn't add to that."

Norbert's initial target platform is **Windows 11**, which makes Tauri a lower-risk choice than it would be on macOS. WebView2 ships with Windows 11 and is kept current via Windows Update, so the version variance and rendering inconsistencies that have historically been Tauri's main pain point on macOS are largely a non-issue for the initial target. Cross-platform expansion to macOS and Linux comes later, at which point WebKit version variance becomes a more active concern and will require a more structured testing matrix.

**Why not a local web server + browser:** A pure Node.js server that opens `http://localhost:3748` in the user's browser was considered as a way to avoid platform-specific binaries entirely. This approach was rejected because it compromises the core UX requirement — Norbert must be a self-contained app with its own window, system tray presence, and auto-launch capability. A browser tab cannot provide any of these. The additional complexity of platform-specific builds is an acceptable tradeoff for a genuinely native app experience.

### React + Recharts — Dashboard UI

The dashboard UI runs inside Tauri's webview as a standard React application. Recharts provides the time-series charts for usage analytics and cost tracking. The live session visualizer and agent interaction diagrams use a graph visualization library (D3 or React Flow) for the node-edge rendering.

**Why React over a native UI framework:** The dashboard requires rich, interactive data visualization that is significantly easier to build and iterate on in a web stack than in native UI frameworks. Tauri's webview renders it natively without the Electron overhead.

### SQLite (WAL mode) — Local Storage

All hook event data, session records, agent statistics, and configuration snapshots are stored in a single SQLite database at `~/.norbert/norbert.db`. WAL (Write-Ahead Logging) mode is enabled on first launch, allowing reads to proceed concurrently with writes — important for multi-agent nWave sessions that may produce bursts of simultaneous hook POSTs.

```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
```

**Why not InfluxDB:** For a single-user local tool, InfluxDB introduces unnecessary infrastructure complexity. SQLite handles thousands of writes per second with indexed time queries answering in microseconds — more than sufficient for even heavy multi-agent workloads. A future `norbert-server` mode for team deployments would be the appropriate point to introduce a dedicated time-series database.

### Git (libgit2 / gitoxide) — Config Drift Tracking

Configuration drift detection is implemented using a shadow Git repository that Norbert manages at `~/.norbert/config-repo/`. The Git history provides a complete, diffable, timestamped record of every change to the user's `.claude/` directory with no custom diffing logic required.

Using Git for this is deliberate: the diff format is universally understood, the storage is efficient (Git stores deltas), and the implementation is straightforward. Norbert's drift UI is essentially a purpose-built viewer over a standard Git log.

### Claude Code HTTP Hooks — Data Collection

Norbert receives all telemetry via Claude Code's native HTTP hook system. Claude Code POSTs structured JSON to `http://localhost:3748/hooks/{event}` at each lifecycle point. Hooks are configured as `async: true` where the result is not needed, ensuring zero impact on Claude Code's execution performance.

The hook events Norbert consumes:

| Event | Purpose |
|---|---|
| `PreToolUse` | Capture tool invocation with arguments; identify MCP server from tool name prefix |
| `PostToolUse` | Capture tool result, duration, token delta; record MCP server response latency |
| `SubagentStop` | Record agent completion with transcript path |
| `Stop` | Session end, trigger digest generation |
| `SessionStart` | Initialize session record, snapshot config, detect nWave presence |
| `UserPromptSubmit` | Capture prompt for Prompt Archaeology |

MCP tool calls are identified within `PreToolUse` and `PostToolUse` events by their tool name format (`server_name__tool_name`), allowing Norbert to attribute each tool call to its originating MCP server without any additional instrumentation.

### Anthropic Admin API — Account Integration

For API users, Norbert queries the Anthropic Console usage and cost endpoints using an Admin API key stored in the OS keychain (not in any config file). The integration is optional and degrades gracefully for subscription users who do not have Admin API access.

---

## Distribution

### Install Method — Two-Phase Install

Norbert's install is split into two independent phases: app install (via `npx`) and Claude Code integration (via Claude's plugin framework). Each phase can be performed, updated, or reversed independently.

#### Phase 1: App Install — `npx` from GitHub

The Norbert desktop app is distributed via `npx` directly from its GitHub repository:

```bash
npx github:pmvanev/norbert-cc
```

This is the right approach for several reasons. Norbert's target audience — Claude Code developers — universally has Node installed, making `npx` a zero-friction prerequisite. The single command is copy-pasteable from the README and requires no explanation. It is entirely platform agnostic from the user's perspective: they run one command regardless of whether they are on macOS, Windows, or Linux.

Platform-specific binaries are unavoidable given the Tauri architecture, but they are handled invisibly. The `postinstall` script in `package.json` detects the user's OS and architecture at install time and downloads the appropriate pre-built binary from GitHub Releases:

```
npx github:pmvanev/norbert-cc
  → postinstall runs
  → detects darwin-arm64 / darwin-x64 / win32-x64 / linux-x64
  → downloads norbert-v{version}-{platform}.tar.gz from GitHub Releases
  → extracts to ~/.norbert/bin/
  → launches Norbert
```

The user never sees or thinks about their platform. The complexity lives entirely in the postinstall script. The app install does not read, modify, or back up `~/.claude/settings.json` — it touches only `~/.norbert/`.

**Why not a curl-pipe-sh install script:** A curl one-liner (`curl -fsSL .../install.sh | sh`) was considered for its README appeal, but rejected because it requires platform detection logic in shell script — fragile, harder to maintain, and less familiar than npm conventions to the target audience. The `npx github:` approach achieves the same one-line README experience using tooling developers already trust.

**Why not publish to the npm registry immediately:** Publishing to npm requires choosing and reserving a package name, setting up an npm organization, and maintaining a published package from day one. During early development, `npx github:pmvanev/norbert` sources the package directly from the GitHub repo — no registry involved. When Norbert is ready for wider distribution, `npm publish` promotes it to the registry and the install command becomes:

```bash
npx norbert-cc
```

Nothing else changes — same `package.json`, same postinstall script, same binaries on GitHub Releases. The registry is just a different resolution mechanism for the same artifact. The transition is a single command and a README update.

#### Phase 2: Plugin Install — Claude Plugin Marketplace

Once the app is running, the user connects it to Claude Code by installing the Norbert plugin:

```
/plugin install norbert@pmvanev-marketplace
```

This uses Claude Code's native `/plugin` command to install the Norbert plugin from the marketplace hosted at `github.com/pmvanev/claude-marketplace`. Claude's plugin framework reads the plugin definition and registers:

- **6 async HTTP hooks** (PreToolUse, PostToolUse, SubagentStop, Stop, SessionStart, UserPromptSubmit) pointing to `localhost:3748`
- **1 MCP server** (`norbert` via stdio, command: `norbert-cc mcp`)

The plugin source lives in the Norbert repository under `plugin/`, referenced from the marketplace catalog via `git-subdir`:

```
plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── hooks/
│   └── hooks.json           # 6 async HTTP hooks to localhost:3748
└── .mcp.json                # norbert-cc MCP server
```

The plugin can be removed at any time with `/plugin uninstall norbert`, which cleanly removes all hook and MCP registrations from Claude's configuration without affecting the Norbert app or its stored data. This replaces the previous approach of surgically merging hook entries into `~/.claude/settings.json` — Claude's plugin framework handles its own configuration management, eliminating the need for backup files, merge logic, or first-launch notifications.

### Build Pipeline

The initial release target is **Windows x64**. A GitHub Actions workflow using `tauri-apps/tauri-action` builds the Windows binary on each version tag push and attaches it to a GitHub Release. The postinstall script references the release for that version tag to download the correct binary.

macOS arm64, macOS x64, and Linux x64 are added to the build matrix when platform expansion begins. At that point the multi-platform matrix becomes the standard, but starting with a single target keeps the CI surface area minimal while the core architecture is being proven.

During early development, binaries can be built and attached to releases manually — the GitHub Actions workflow is not required until the project is ready for automated releases.

### Code Signing

Without code signing, Windows SmartScreen will block execution with an "Unknown publisher" warning. Early collaborators can bypass this ("More info → Run anyway") — developer users are accustomed to this for early-stage tools.

When macOS support is added, unsigned builds will trigger an "unidentified developer" Gatekeeper warning (right-click → Open to bypass).

Code signing requires a Windows code signing certificate and, when the time comes, an Apple Developer account ($99/year), with credentials stored as GitHub Actions secrets. This is deferred until Norbert is ready for broader distribution beyond the initial developer audience.

All data collected by Norbert stays on the local machine. Hook event data, session records, prompt contents captured for Prompt Archaeology, and configuration snapshots are written only to `~/.norbert/` and never transmitted anywhere. The one exception is the optional Anthropic Admin API integration, which makes outbound HTTPS requests to `api.anthropic.com` — and only when the user has explicitly provided an Admin API key.


---

## UI Design, Aesthetics & Interaction

### Design Philosophy

Norbert is a tool that watches something powerful and complex — multi-agent AI orchestration — and its visual design should feel like it belongs in that world. The aesthetic is **futurist glassmorphism**: dark by default, semi-transparent surfaces layered over depth, animated with purpose, and anchored by a single iconic brand color that makes Norbert immediately recognizable on a screenshot. It should feel like a window into a living system, not a static dashboard.

The tone is technical but not austere. Norbert rewards exploration — there is always something happening, some subtle animation or glow that rewards attention — but it never overwhelms. Key information surfaces immediately; detail is available on demand through hover, click, and drill-down.

---

### Signature Visualizations

Norbert ships a set of purpose-built visualizations that go well beyond standard dashboards. Each one was designed with two hard constraints: it must be **visually distinctive** — the kind of thing that makes someone stop and stare — and it must earn its place through **genuine practical utility**, not decoration. Eye-candy that doesn't tell you something useful doesn't belong here.

These visualizations are delivered **iteratively and independently**. Each is a discrete named view registered by its parent plugin — none of them are required for Norbert to function, and none of them block each other. The simplest views (Gauge Cluster, Oscilloscope) ship early; the most complex (Constellation, Radar) come later once the data layer beneath them is solid. The Norbert theme is where all of them look their best — particularly as floating panels, where the glassmorphic translucency is fully exploited. The other themes render them cleanly and functionally, but the Norbert theme is where they look like they were *designed* for this.

---

#### Gauge Cluster *(floating HUD)*

**Registered by:** `norbert-usage` · **Delivery:** Early — straightforward React layout, no exotic rendering

A floating instrument panel modeled on an analog gauge cluster — the persistent heads-up display you pin to a corner of your screen and monitor in peripheral vision during a long autonomous session. Each instrument maps a live Norbert metric to a gauge form that communicates not just value but *urgency*:

| Instrument | Metric | Form |
|---|---|---|
| **Tachometer** | Token burn rate (tokens/sec) | Radial sweep gauge, redlines at sustained high rate |
| **Fuel gauge** | Context window utilization % | Arc gauge, amber zone at 70%, red at 90% |
| **Odometer** | Session cost | Rolling digit display, digits tumble as cost increments |
| **RPM counter** | Active agent count | Radial gauge, spikes when agents spawn |
| **Warning cluster** | Hook health · DES status · anomalies | Indicator lights — green nominal, amber warn, red fault |
| **Clock** | Session duration | Elapsed time display |

In the **Norbert theme**: phosphor-cyan numerals on dark teal-black faces, amber warning zones glowing with the radar accent color, brass bezel rings framing each instrument, scanline texture overlaid, the whole cluster semi-transparent so the live session visualizer behind it bleeds through the glass. The effect is a physical instrument overlay on a radar screen. In other themes the cluster renders as clean, modern gauges — fully legible, less atmospheric.

As a floating panel the Gauge Cluster minimizes to a pill showing the current session cost. It is the right default floating panel for the "nWave Deliver" and "Full Observability" layout presets.

---

#### Token Burn Oscilloscope

**Registered by:** `norbert-usage` · **Delivery:** Early — canvas/SVG waveform, well-understood rendering pattern

Token and cost burn rate over the last 60 seconds rendered as a **continuous oscilloscope waveform** — not a bar chart, a live voltage trace scrolling right to left at ~10Hz. The waveform shape encodes information that aggregated charts cannot: the *texture* of agent activity.

- A **flat baseline** means nothing is happening — waiting for a tool result, idle between agents
- A **sharp spike** means a tool call fired or a response chunk arrived
- A **sustained plateau** means a long streaming response is in progress
- **Rapid repeated spikes** mean tool calls are hammering — bash loops, file reads, MCP calls
- A **flat line when you expect activity** means something hung

Two traces render simultaneously — token rate (phosphor cyan) and cost rate (amber) — on the same time axis so the relationship between them is visible. When a model switch occurs (e.g. coordinator on Opus, specialist on Sonnet) the cost trace changes gradient without interrupting the token trace.

In the **Norbert theme**: P31 phosphor green trace with **persistence effect** — the waveform fades slowly rather than instantly, exactly as CRT phosphor afterglows. The trace blooms slightly at peaks. Grid lines in dim brass. The whole instrument glows through floating panel glass. In other themes: clean SVG line chart with smooth scrolling, no persistence effect, brand color for the trace.

The Oscilloscope is a natural Secondary zone view during active sessions, or a floating panel pinned beside the main Gauge Cluster.

---

#### Agent Constellation

**Registered by:** `norbert-agents` · **Delivery:** Medium — requires Three.js or WebGL, deliver after agent data layer is solid

The live session visualizer, reimagined as a **star chart**. Agent nodes are rendered as stars in 3D space — size proportional to cumulative token consumption, brightness proportional to current activity level. Constellation lines connect agents with spawn relationships, pulsing with data flow. The whole chart rotates slowly in 3D (≈1 RPM, subtle enough to feel alive rather than distracting) so the structure reads as a genuine spatial object rather than a flat diagram.

What this shows that a flat graph cannot: **cost attribution is spatial**. The biggest, brightest star is eating your budget — you don't have to find it, your eye goes there. Orchestration topology is geometric — a hub-and-spoke coordinator pattern produces a radially symmetric constellation; a chain of agents produces a line; a mesh produces a cluster. You understand the session's shape before reading a number.

Clicking a star opens that agent's detail flyout. Stars dim and shrink as agents complete, leaving ghost outlines — the session's history accumulates in the chart as the faintest stars of all.

In the **Norbert theme**: stars glow phosphor-cyan with full bloom effect on active nodes, constellation lines are animated phosphor dash traces, the slow 3D rotation happens against the deep teal-black void. As a floating panel over the main dashboard it is genuinely mistakable for a mission control display. In other themes: clean WebGL point rendering, brand color for active nodes, no bloom.

This is the most "shareable screenshot" view in Norbert — the one that ends up in blog posts.

---

#### Context Pressure Horizon

**Registered by:** `norbert-usage` · **Delivery:** Medium — scrolling canvas rendering, deliver after context tracking is solid

A **scrolling horizon visualization** — the kind seen on seismic monitors and flight data recorders. Each active agent occupies a horizontal band. The band fills left-to-right over time as context window utilization climbs, rendered as a continuous colored landscape. When an agent hits compaction the landscape drops sharply — a cliff edge — then climbs again from the new baseline.

This is the best possible view for understanding **context pressure across multiple agents over time simultaneously**. No other view shows this picture. A standard utilization gauge tells you where one agent is right now. The horizon shows where every agent is, where they've been, how fast they're climbing, and where they've been reset — all at once, scrolling in real time.

The color gradient encodes urgency continuously: cool teal at low utilization, climbing through amber, burning to red near the limit, with a bright white flash at compaction. The landscape shape itself carries information — a gentle slope means slow fill, a steep ramp means an agent is burning context fast, a cliff-and-reset pattern means repeated compaction which is a signal worth investigating.

In the **Norbert theme**: the scrolling landscape glows against the dark background, the compaction flash is a phosphor burst that fades with the persistence effect, agent labels glow in dim phosphor at the left edge of each band. As a floating panel it looks like a seismic monitoring station overlaid on the session view. In other themes: clean canvas gradient bands, brand color for the fill, sharp compaction markers.

---

#### DES Enforcement Thermal View

**Registered by:** `norbert-cc-plugin-nwave` · **Delivery:** Medium — replaces/extends existing DES heatmap, deliver after DES heatmap ships

The TDD phase compliance heatmap rendered as a **live thermal image** — cells grade continuously from cool blue (clean pass) through amber (warning/retry) to white-hot (block/failure). During a live deliver session cells heat up and cool down in real time as enforcement events arrive, the color transitions smooth and physically motivated rather than snapping between discrete states.

The practical advantage over the standard heatmap is **perceptual**: thermal encoding routes through the visual system's anomaly detection before conscious scanning. A hot spot in the REFACTOR column across five consecutive steps registers as wrong before you've read a label. In a grid of 20 steps × 4 phases that speed matters.

The thermal palette maps precisely onto the Norbert color system: cool blue → nominal, amber → warning (already `--amber`), white-hot → block (`#ff4560` blooming toward white at peak intensity). Cells cool over time if no new events arrive — a resolved warning fades back toward blue — so the display reflects the session's current state rather than its worst-ever state.

In the **Norbert theme**: the thermal glow bleeds between adjacent cells giving the grid an infrared camera quality, hot cells bloom with the error glow effect, the whole thing renders through floating panel glass like a heat sensor overlay. In other themes: clean color-coded grid, same thermal palette but without glow or bleed.

This view replaces the standard DES heatmap as the default DES visualization — it is a strict improvement in readability, not an alternative.

---

#### MCP Call Radar

**Registered by:** `norbert-mcp` · **Delivery:** Later — most complex rendering, deliver after MCP analytics data layer is mature

A **circular radar sweep** for MCP tool call activity. The classic rotating sweep line, one full rotation every 4 seconds. Each tool call appears as a blip: radial position (angle) corresponds to MCP server — servers are distributed around the circle like compass points — and distance from center is proportional to call latency. Blips fade with **radar persistence** — bright on arrival, dimming over ~8 seconds exactly as a real radar return fades between sweeps.

What this shows that a table cannot: **latency outliers and call frequency are simultaneously spatial**. A server whose blips consistently appear near the outer edge of the radar is slow — you don't have to compare numbers, the geometry tells you. A server generating 40 calls per minute produces a bright arc of overlapping blips that is impossible to miss. An MCP server that drops off mid-session simply stops producing returns — the silence is visible.

Color encodes server identity (each MCP server gets a distinct hue) and blip intensity encodes whether the call succeeded or errored — errors appear in amber/red rather than the server's assigned color.

In the **Norbert theme**: rotating sweep line in dim phosphor, blips blooming on arrival and fading with the persistence effect, server labels at the cardinal positions in uppercase Share Tech Mono. As a floating panel over the session view it is genuinely mistakable for real radar hardware. In other themes: clean SVG radar with brand-colored sweep, same blip fade but without glow.

The MCP Radar is the most complex visualization in Norbert and also the most immediately striking to anyone who sees it for the first time. It ships last among the signature views precisely because the MCP analytics data layer it depends on needs to be solid first — but it is worth waiting for.

---

**Delivery sequence summary:**

The signature views are independent of each other and can ship in any order. Suggested sequence based on dependency readiness and implementation complexity:

1. **Gauge Cluster** — ships with `norbert-usage` v1, no exotic rendering required
2. **Token Burn Oscilloscope** — ships with `norbert-usage` v1 alongside Gauge Cluster, canvas waveform
3. **Context Pressure Horizon** — ships with `norbert-usage` v2 once context compaction tracking is solid
4. **DES Enforcement Thermal View** — ships with `norbert-cc-plugin-nwave` v1 as the default DES heatmap
5. **Agent Constellation** — ships with `norbert-agents` v2, requires Three.js/WebGL integration
6. **MCP Call Radar** — ships with `norbert-mcp` v2 once MCP analytics data layer is mature

None of these block the core Norbert functionality. Each one is a named view that registers itself and becomes available in the layout engine's view picker. If a view isn't built yet, it simply isn't in the picker — no stubs, no placeholders, no promises. Ship each one when it's ready and good.

---

### Color System & Built-in Themes

Norbert ships with five built-in themes from day one. The default is **Norbert** — the signature theme described below. The other four are deliberate copies of environments developers already live in, so Norbert can feel native regardless of where someone works.

---

#### Theme 1: Norbert (Default)

The signature theme. Inspired by vintage oscilloscope and radar instrumentation — the physical machines that Norbert Wiener worked with while developing the feedback control theories that became cybernetics. The palette is derived directly from the phosphor colors of period CRT displays: a P31 phosphor cyan as the primary brand color, and P7 radar amber as the warning/cost accent.

**Backgrounds** — a dark teal-black that suggests the glass face of a CRT, not pure black:
- `--bg-crt`: `#060d0b` — app shell, darkest layer
- `--bg-panel`: `#0a1410` — panel backgrounds
- `--bg-surface`: `#0f1d18` — card and widget surfaces
- `--bg-glass`: `rgba(0, 229, 204, 0.04)` — phosphor-tinted glass overlay

**Brand — Phosphor Cyan:**
- `--phosphor`: `#00e5cc` — primary brand color; active states, live indicators, agent nodes, glows
- `--phosphor-dim`: `#00b3a0` — secondary phosphor for less prominent accents
- `--phosphor-bright`: `#00fff0` — brightest point of glow effects
- `--phosphor-glow`: `rgba(0, 229, 204, 0.25)` — ambient glow

**Accent — Radar Amber:**
- `--amber`: `#f0920a` — cost ticker, warnings, compression events, anomalies, blocked tool calls
- `--amber-glow`: `rgba(240, 146, 10, 0.3)`

**Borders:**
- `--border-subtle`: `rgba(0, 229, 204, 0.1)` — phosphor-tinted panel edges
- `--border-glow`: `rgba(0, 229, 204, 0.4)` — active element borders
- `--border-brass`: `rgba(180, 140, 60, 0.15)` — title bar, status bar, instrument bezel feel

**Text:**
- `--text-primary`: `#d4f5ef` — slightly phosphor-tinted white
- `--text-secondary`: `#6ba89e` — secondary labels
- `--text-muted`: `#2d5a52` — placeholder text, disabled states

**Typography:** Rajdhani (UI) + Share Tech Mono (monospace). Uppercase labels with wide letter-spacing throughout. All section headers prefixed with `//` in the style of inline code comments.

**Atmosphere:** Subtle CRT scanline texture overlaid on the full app. Radial phosphor glow gradient bleeding from the left. Thin luminous lines along the bottom of the title bar and top of the status bar, like the bezel edge of a physical instrument. Brass corner accents on metric cards. All active glowing elements use layered `box-shadow` to simulate phosphor bloom.

**Floating panels in the Norbert theme** are the showcase surface of the entire aesthetic. With `backdrop-filter: blur(20px) saturate(1.4)` and a 72% fill opacity, floating panels are semi-transparent overlays through which the live visualizations beneath them are visible — agent graphs bleed through as teal-green blur, amber cost events diffuse through the panel edge. The effect resembles a physical instrument overlay on a radar display, which is precisely the reference point the theme is designed around. No other theme exploits floating panel translucency as dramatically. See the Glassmorphism & Layering section for full treatment values.

**Semantic colors:**
- Success: `var(--phosphor)` — healthy, running, completed
- Warning: `var(--amber)` — degraded, approaching limit, blocked
- Error: `#ff4560` — enforcement block, hook failure, hard error

---

#### Theme 2: Claude Dark

A faithful copy of Anthropic's Claude Desktop dark mode. Users who live in Claude Desktop all day will feel immediately at home. The goal is visual continuity — Norbert should feel like a native companion to the Claude interface, not a foreign tool.

**Backgrounds:**
- `--bg-base`: `#1a1a1a` — Claude Desktop's near-black background
- `--bg-panel`: `#242424` — panel surfaces
- `--bg-surface`: `#2d2d2d` — card surfaces
- `--bg-glass`: `rgba(255, 255, 255, 0.04)`

**Brand — Claude Orange:**
- `--brand`: `#d97706` — Anthropic's warm amber-orange
- `--brand-glow`: `rgba(217, 119, 6, 0.25)`

**Text:**
- `--text-primary`: `#ececec`
- `--text-secondary`: `#a3a3a3`
- `--text-muted`: `#525252`

**Borders:**
- `--border-subtle`: `rgba(255, 255, 255, 0.08)`
- `--border-glow`: `rgba(217, 119, 6, 0.3)`

**Typography:** Matches Claude Desktop's typeface stack — system UI fonts (SF Pro on macOS, Segoe UI on Windows) for UI text; SF Mono / Consolas for monospace.

**Semantic colors:** Success `#22c55e`, Warning `#f59e0b`, Error `#ef4444`.

---

#### Theme 3: Claude Light

A faithful copy of Anthropic's Claude Desktop light mode. The light counterpart to Claude Dark — warm white backgrounds, the same Claude orange brand accent, high contrast text. Intended for users who prefer light interfaces or work in bright environments.

**Backgrounds:**
- `--bg-base`: `#ffffff`
- `--bg-panel`: `#f7f7f5` — Claude's warm off-white panel tone
- `--bg-surface`: `#efefed`
- `--bg-glass`: `rgba(0, 0, 0, 0.03)`

**Brand — Claude Orange:**
- `--brand`: `#d97706` — same orange as Claude Dark
- `--brand-glow`: `rgba(217, 119, 6, 0.2)`

**Text:**
- `--text-primary`: `#1a1a1a`
- `--text-secondary`: `#525252`
- `--text-muted`: `#a3a3a3`

**Borders:**
- `--border-subtle`: `rgba(0, 0, 0, 0.08)`
- `--border-glow`: `rgba(217, 119, 6, 0.3)`

**Typography:** Same system font stack as Claude Dark.

**Semantic colors:** Success `#16a34a`, Warning `#d97706`, Error `#dc2626`.

**Glass treatment:** Light mode glass uses very low opacity dark fills rather than light fills — `rgba(0,0,0,0.03)` — to maintain depth without washing out.

---

#### Theme 4: VS Code Dark (Default)

A faithful copy of VS Code's default dark theme — `Default Dark+` / `Visual Studio Dark`. The most familiar dark developer tool aesthetic in existence. Intended for users who live in VS Code and want Norbert to blend in.

**Backgrounds:**
- `--bg-base`: `#1e1e1e` — VS Code's iconic editor background
- `--bg-panel`: `#252526` — VS Code sidebar and panel color
- `--bg-surface`: `#2d2d30` — VS Code input and widget surfaces
- `--bg-glass`: `rgba(255, 255, 255, 0.04)`

**Brand — VS Code Blue:**
- `--brand`: `#0078d4` — VS Code's activity bar active indicator and focus blue
- `--brand-glow`: `rgba(0, 120, 212, 0.25)`

**Text:**
- `--text-primary`: `#cccccc` — VS Code's default editor text color
- `--text-secondary`: `#858585`
- `--text-muted`: `#3c3c3c`

**Borders:**
- `--border-subtle`: `rgba(255, 255, 255, 0.06)`
- `--border-glow`: `rgba(0, 120, 212, 0.35)`

**Typography:** Matches VS Code's default stack — Segoe UI / system-ui for UI; Consolas / Courier New for monospace.

**Semantic colors:** Success `#89d185`, Warning `#cca700`, Error `#f48771`. These are VS Code's exact diagnostic colors.

**Activity bar:** In this theme, the activity bar uses VS Code's exact treatment — `#333333` background, active item accent bar on the left in `--brand` blue, inactive icons at 60% opacity.

---

#### Theme 5: VS Code Light (Default)

A faithful copy of VS Code's default light theme — `Default Light+` / `Visual Studio Light`. Clean white workspace feel with VS Code's signature blue accents.

**Backgrounds:**
- `--bg-base`: `#ffffff`
- `--bg-panel`: `#f3f3f3` — VS Code sidebar background
- `--bg-surface`: `#ffffff`
- `--bg-glass`: `rgba(0, 0, 0, 0.03)`

**Brand — VS Code Blue:**
- `--brand`: `#0078d4` — same blue as VS Code Dark
- `--brand-glow`: `rgba(0, 120, 212, 0.2)`

**Text:**
- `--text-primary`: `#000000`
- `--text-secondary`: `#616161`
- `--text-muted`: `#a0a0a0`

**Borders:**
- `--border-subtle`: `rgba(0, 0, 0, 0.12)`
- `--border-glow`: `rgba(0, 120, 212, 0.3)`

**Typography:** Same as VS Code Dark.

**Semantic colors:** Success `#388a34`, Warning `#bf8803`, Error `#e51400`. VS Code's light mode diagnostic colors.

---

#### Theme Picker Grouping

In the `Ctrl+K T` theme picker, built-in themes are grouped and ordered as follows:

```
Built-in Themes
  Norbert              ← default, shown first
  ─────────────────
  Claude Dark
  Claude Light
  ─────────────────
  VS Code Dark
  VS Code Light
  ─────────────────
Installed Themes
  [npm-installed themes appear here]
  ─────────────────
  Browse Themes...
```

The Norbert theme is always listed first as it is the canonical identity of the application. The Claude and VS Code themes are grouped in pairs with a separator between each family.

---

### Glassmorphism & Layering

Norbert's surfaces are semi-transparent by design, not as a novelty but as a structural visual metaphor — you are looking through Norbert at the activity happening underneath it.

**Glass panels** use `backdrop-filter: blur(16px)` with a very low-opacity fill and a 1px border. They float over the dark base layer, creating a sense of depth. Modals, flyout detail panels, and the tray popover all use this treatment.

**Card surfaces** inside panels use a slightly higher opacity fill with a subtle inner shadow to lift them from the panel background. Hovering a card increases the fill opacity slightly and adds a faint brand-colored border glow — the card responds to attention.

**Depth is achieved through layering**, not drop shadows. The hierarchy from back to front:
1. Base background — static, darkest
2. Zone content areas — solid or very lightly tinted
3. Cards and widgets — slightly more opaque glass
4. Floating panels — full glass treatment, blurred, semi-transparent
5. Detail flyout — high opacity glass, slides over zones
6. Modals — full glass treatment with a subtle backdrop dim

---

**Floating Panels — the premier glass surface**

Floating panels are where glassmorphism is most fully expressed. A floating panel hovering over a live agent graph — its edges blurred into the visualization beneath it, its content readable but the activity behind it visible — is the defining visual of the Norbert aesthetic. This is not a design flourish; it is the practical consequence of the layout model. Because floating panels sit above the zone content rather than displacing it, they are the one surface in Norbert where `backdrop-filter` is doing real work: you are genuinely seeing through the panel to live data behind it.

Floating panel glass treatment:
- `backdrop-filter: blur(20px) saturate(1.4)` — slightly stronger blur than static panels, with saturation boost so the blurred content beneath reads as richly colored rather than washed out
- Fill: `rgba(var(--bg-panel-rgb), 0.72)` — 72% opacity base, leaving 28% of the content beneath visible
- Border: `1px solid rgba(var(--brand-rgb), 0.18)` — a faint brand-colored edge that distinguishes floating panels from the zone background
- Corner radius: `var(--card-radius)` — consistent with cards, not modals
- Header bar: slightly more opaque than the panel body (`0.85`) so the drag handle is visually anchored

**The Norbert theme is uniquely well-suited to floating panels.** The phosphor-cyan-on-dark-teal-black palette is designed around translucency in a way the other themes are not. When a floating panel hovers over the Live Session Visualizer in the Norbert theme, the blurred agent graph bleeds through the panel glass tinted green-teal, the phosphor glow of active nodes diffuses through the blur radius, and the amber cost ticker visible beneath pulses through the panel edge. The result looks like a physical instrument overlay on a radar screen — which is exactly the aesthetic the theme is built around.

The Claude and VS Code themes support glass treatment correctly and look clean, but their lighter or neutral palettes don't exploit the depth as dramatically. The Norbert theme is the one where floating panels feel intentional rather than incidental. This is worth calling out in the theme picker description and in any marketing material: floating panels are a feature, and they look best in the Norbert theme.

**Theme-specific floating panel fill values:**

| Theme | Panel fill opacity | Blur |
|---|---|---|
| Norbert | `rgba(10, 20, 16, 0.72)` | `blur(20px) saturate(1.4)` |
| Claude Dark | `rgba(30, 30, 30, 0.80)` | `blur(16px)` |
| Claude Light | `rgba(247, 247, 245, 0.82)` | `blur(16px)` |
| VS Code Dark | `rgba(30, 30, 30, 0.82)` | `blur(14px)` |
| VS Code Light | `rgba(243, 243, 243, 0.84)` | `blur(14px)` |

The Norbert theme uses the lowest fill opacity and the most aggressive blur — maximizing the see-through effect. The light themes use higher opacity to maintain readability against bright backgrounds. All values are exposed as theme tokens (`--float-panel-bg`, `--float-panel-blur`) so custom themes can tune them.

---

### Typography

Each built-in theme ships with a font stack chosen to match its aesthetic identity. Font stacks are part of the theme token set and can be overridden in custom themes.

**Norbert theme:** Rajdhani (UI) + Share Tech Mono (monospace). Rajdhani has a technical, slightly military character that suits the instrument panel aesthetic. Share Tech Mono reads like teletype output from period computing hardware. All UI labels are uppercase with wide letter-spacing; section headers use `//comment` prefixes.

**Claude Dark / Claude Light:** System UI fonts — SF Pro on macOS, Segoe UI on Windows, system-ui fallback. Matches Claude Desktop's native feel exactly.

**VS Code Dark / VS Code Light:** Segoe UI (UI) + Consolas / Courier New (monospace). Matches VS Code's default font stack precisely, including the slightly condensed character spacing of VS Code's sidebar and panel labels.

**Universal typographic rules across all themes:**
- Base 13px for dense data views, 14px for standard panels
- Larger display sizes only for top-level metrics (cost burn ticker, session count)
- Regular for body text, Medium for labels and headers, Semibold only for top-level display values
- **Tabular figures everywhere** — monospaced number widths are non-negotiable for values that change over time; layout shift on a live cost ticker is unacceptable

---

### Animation & Motion

Animation in Norbert is purposeful — it communicates state change and draws attention to activity rather than decorating static content.

**The Live Session Visualizer** is Norbert's most animated surface. Nodes fade in as agents spawn with a brief scale-up from 0.8 → 1.0 and a brand-colored radial glow pulse. Edges draw in as a travelling dash animation along the path from parent to child. Active nodes pulse with a slow breathing glow (2s ease-in-out loop) while they are processing. Nodes dim to 40% opacity when completed, their glow extinguished. The whole graph gently re-layouts using a physics simulation when new nodes appear, with spring-eased transitions so the graph breathes rather than jumps.

**The Cost Burn Ticker** increments with an odometer-style digit roll — individual digit columns animate up as the value increases. The color of the ticker shifts subtly from brand blue toward amber as cost crosses the user's session average, and toward red if it goes significantly over. This happens gradually, not as a sudden jump.

**Tab transitions** use a shared-element cross-fade — 150ms, ease — rather than slides. Content within a tab fades in with a subtle upward translate (8px → 0px, 200ms). Nothing lingers; transitions are quick enough to feel responsive.

**Chart animations** on first render: line charts draw from left to right over 600ms. Bar charts grow from the baseline. These only play on first load — subsequent data updates animate incrementally rather than replaying the full entrance.

**Hook health indicators** pulse amber then settle when a warning fires, pulse red and hold when an error occurs. A resolved error fades from red back to green over 1.5s.

**Idle state**: When no session is active, the tray icon dims slightly and the dashboard home screen shows a minimal ambient animation — a very slow, low-opacity particle drift or waveform in the background — making it clear Norbert is alive and listening even when quiet.

All animations respect `prefers-reduced-motion`. When the system setting is enabled, Norbert disables transitions, pulses, and entrance animations and uses immediate state changes instead.

---

### Layout & Information Architecture

**The shell** is a fixed-width sidebar navigation on the left (collapsed to icons only by default, expandable to show labels) with the main content area filling the rest of the window.

**The context broadcast bar** sits below the title bar — a slim, always-visible strip that lets the user broadcast a session context to all plugins that have opted in. It is not a filter bar or a mode toggle. It is a soft suggestion mechanism: setting a session here pushes a default scope to subscribed plugins, snapping them to the same session simultaneously. The bar contains a session context picker on the left, a live-session status dot in the middle, and the cost ticker on the right. Full specification in the Session Model section above. Per-plugin filter and time-mode controls live in each plugin's zone toolbar, not here.

**The detail flyout** is a glass panel that slides in from the right at 420px wide, overlaying (not pushing) the content area. It is used for session detail, agent detail, hook event detail, and prompt archaeology views. Dismissing it slides it back out. Multiple flyouts do not stack — opening a second one replaces the first.

**Tray popover** — clicking the Norbert tray icon opens a compact glass popover (320px wide) showing the current session status, live cost ticker if active, last 3 sessions at a glance, and a hook health summary. A single button opens the full dashboard. This is the zero-friction access point for users who don't want to keep the full window open.

---

**Status Bar**

The status bar is a 22px-tall persistent strip at the very bottom of the window — the same position and purpose as VS Code's status bar. It is always visible regardless of which view is active. Its job is ambient state at a glance: the things you want to be able to check without navigating anywhere.

The status bar is divided into two regions: **left-anchored items** (system and session state) and **right-anchored items** (version and plugin info). Items are small — 10px monospace text with a subtle dot or icon prefix — dense without being cluttered.

**Left-anchored items (left to right):**

| Item | When shown | Color |
|---|---|---|
| `● hooks live` | Hook receiver is active and receiving events | Brand color |
| `● hooks inactive` | Hook receiver running but no events recently | Muted |
| `⚠ hooks error` | One or more hooks have errored or timed out | Amber/warning |
| `N mcp` | Count of connected MCP servers (e.g. `3 mcp`) | Brand color |
| `⚠ ctx N%` | Context window above 70% for any active agent | Amber; pulses above 90% |
| `⚠ hook timeout` | A specific hook has timed out | Amber |
| `DND` | Do Not Disturb mode is active | Muted |
| `● session active` | Shown only when no session name fits in the top bar | Brand color |

Items are only shown when relevant — the status bar does not display a full roster of green checkmarks when everything is nominal. Silence means nominal. The bar becomes more populated as conditions warrant attention, which makes anomalies visually obvious.

**Right-anchored items (right to left):**

| Item | Content |
|---|---|
| Plugin name(s) | Name and version of loaded third-party plugins (e.g. `nWave v2.1`) |
| Norbert version | Current `norbert-cc` version (e.g. `v0.1.0`) |
| Window label | If this window has been given a custom label, shown here dimly |

Every item in the status bar is **clickable**. Clicking navigates to the most relevant view or opens the most relevant settings section:

- `hooks live` → Hook Health panel
- `N mcp` → MCP Servers panel
- `⚠ ctx N%` → Usage / Context Pressure view for the affected agent
- `⚠ hook timeout` → Hook Health panel filtered to the erroring hook
- `nWave v2.1` → nWave plugin settings
- `v0.1.0` → About / changelog dialog

**Plugin API:** Plugins can register status bar items via `api.ui.registerStatusItem({ id, label, color, onClick, position })`. Position is `'left'` or `'right'`. The item is shown or hidden dynamically by the plugin as conditions change via `api.ui.setStatusItem(id, { label, color, visible })`. Core Norbert items always take priority in left-anchor ordering; plugin items are appended after them.

**Theme treatment:** In the **VS Code Dark and Light themes**, the status bar background is the blue `#0078d4` — matching VS Code's distinctive blue status bar exactly. Text is white. In the **Norbert theme**, the status bar shares the near-black titlebar background with brass luminous edge lines above it (the phosphor glow line). In the **Claude themes**, the status bar uses the titlebar background color with standard text colors. This means the status bar is visually theme-distinct: VS Code users see the exact status bar they expect; Norbert theme users see it integrated into the instrument panel aesthetic.

---

### Information Architecture — Three-Level Navigation Model

Norbert's navigation follows a strict three-level hierarchy that eliminates ambiguity about what each UI element controls:

```
Level 1 — Section    (sidebar icon)         "What plugin/area am I in?"
Level 2 — Mode       (zone toolbar tabs)    "Which facet of this plugin am I viewing?"
Level 3 — Content    (the view itself)      "The actual data and visualizations"
```

Each level has exactly one mechanism. There is no overlap.

---

**Level 1 — Section (Sidebar)**

Clicking a sidebar icon assigns that plugin to the Main zone and loads its `primaryView`. The zone toolbar immediately updates to show that plugin's declared modes. If a session is live and the plugin has relevant state, the default mode is the most contextually appropriate one (declared by the plugin via `primaryView`).

The sidebar does not control Secondary zone or floating panels — those have their own independent assignment mechanisms.

---

**Level 2 — Mode (Zone Toolbar)**

Each zone has its own toolbar — a compact row anchored to the top of the zone. The toolbar is **owned by the zone and populated by whatever plugin currently occupies it**. When a different plugin is assigned to the zone, the toolbar immediately replaces its entire contents with that plugin's modes and controls.

The zone toolbar is the plugin's **complete control surface** — not just a tab picker. It contains two kinds of controls, always in this left-to-right order:

- **Mode tabs** (leftmost) — the plugin's named views, in declared tab order. Active tab has the brand-colored underline. A mode switch is instant.
- **Filter and time-mode controls** (right of tabs) — inline controls declared by the *active mode*, rendered immediately after the tabs. These vary by mode: a Live/Playback toggle, a session picker, a time range dropdown, a search input — whatever the active view needs and only what it needs. If the active mode declares no filter controls, none appear.

This means the toolbar changes shape when you switch modes within a plugin — the Oscilloscope's Token Burn mode might show a Live/Playback toggle and a session picker, while its Cost Trend mode shows a time range picker and a multi-session selector, and its Context Pressure mode shows an agent filter. Each mode gets exactly the controls it needs.

The zone header row (`// main`, `⤢`, `⊞`) sits above the toolbar and is visually and functionally distinct — it controls the zone itself (layout, assignment), not the plugin's content.

**Every zone has a fully independent toolbar.** Main and Secondary each reflect only the plugin assigned to them. A user can have the Oscilloscope in live mode in Main and the Sessions list filtered to last 7 days in Secondary simultaneously — two plugins, two independent toolbars, two independent filter states, no interference. This independence is a property of the zone abstraction itself, not a special case for two zones — any future zones would behave identically.

---

**Level 3 — Content**

The view itself. Rendered by the plugin, fills the zone below the toolbar. Clicking, hovering, and drilling down within the content is handled entirely by the plugin — the shell provides no affordances here except the detail flyout for overflow detail panels.

---

**Plugin view registration — updated API**

Plugins declare their views in tab order. The first view with `primaryView: true` is the default mode loaded when the sidebar icon is clicked. All declared views appear as tabs in the zone toolbar in registration order:

```typescript
// Views declared in tab order — this becomes the toolbar sequence
api.ui.registerView({
  id: 'nwave-session-overview',
  label: 'Session Overview',
  icon: '◉',
  component: NWaveSessionOverview,
  primaryView: true,
  tabOrder: 0,
  minWidth: 300, minHeight: 200,
  floatMetric: null,
});

api.ui.registerView({
  id: 'nwave-wave-flow',
  label: 'Wave Flow',
  icon: '〜',
  component: WaveFlowDiagram,
  tabOrder: 1,
  minWidth: 400, minHeight: 300,
  floatMetric: null,
});

api.ui.registerView({
  id: 'nwave-des',
  label: 'DES',
  icon: '⊛',
  component: DESVisualizer,
  tabOrder: 2,
  minWidth: 300, minHeight: 250,
  floatMetric: 'des_block_count',
});

api.ui.registerView({
  id: 'nwave-artifacts',
  label: 'Artifacts',
  icon: '⊞',
  component: ArtifactBrowser,
  tabOrder: 3,
  minWidth: 350, minHeight: 250,
  floatMetric: null,
});
```

The `tabOrder` field controls the sequence of tabs in the zone toolbar. Plugins with only one view registered still get a toolbar — it shows a single active tab, which serves as a label for the current view rather than a navigation control.

---

**Floating panel mode switching**

Floating panels show a **static mode** — a single view, no tab bar. This is intentional: floating panels are ambient instruments (the Gauge Cluster, the Oscilloscope, the MCP Radar), chosen for a specific purpose and left running. A tab bar on a small floating window adds chrome overhead and dilutes the focused-instrument feel.

Mode switching *is* available but is a deliberate one-step action rather than a persistent affordance. The floating panel header's `⋯` menu includes **"Switch Mode"** — a compact popover listing the plugin's other modes in tab order. Selecting one replaces the float's current view and persists until switched again. This covers the case where a user wants a floating nWave panel and occasionally wants to flip between Wave Flow and DES without dedicating a zone to nWave.

The `⋯` menu also provides: "Open in Main Panel", "Open in Secondary Panel", "Open in New Window", "Minimize to pill", "Close".

Floating panels do **not** inherit or display the zone toolbar. The plugin's tab sequence is accessible only through the `⋯` menu in float context.

---

### Layout Engine

The main content area launches with a **two-zone model** — a Main zone and an optional Secondary zone — plus an optional floating panel overlay. This covers the dominant usage pattern (one primary view, one reference view) without the complexity of a recursive tiling tree, while keeping the architecture zone-count-agnostic. Zones are a general concept — each zone hosts one view, owns its own toolbar, and manages its own filter state independently. Nothing in the plugin API, layout persistence, or view assignment model assumes exactly two zones. A future release can introduce additional named zones (e.g. a Bottom zone for logs or a tertiary side panel) by extending the layout engine without changing the plugin contract or the zone abstraction.

---

**Initial Zones: Main and Secondary**

```
┌─────────────────────────┬───────────────┐
│                         │               │
│       Main Zone         │  Secondary    │
│    (always present)     │   Zone        │
│                         │  (optional)   │
│                         │               │
└─────────────────────────┴───────────────┘
```

**Main zone** — always present, always hosts exactly one view. Cannot be hidden or closed. When Secondary is hidden, Main expands to fill the full content area.

**Secondary zone** — optional. When shown, it appears to the right of Main separated by a draggable vertical divider. Hosts exactly one view. Opening it does not disturb what is in Main. Closing it collapses back to full-width Main — the view that was in Secondary is simply unloaded, the layout does not restructure.

The divider between Main and Secondary is a draggable 4px handle. Double-clicking it snaps to 50/50. Minimum zone width is 280px to prevent views from becoming unreadably narrow. The divider position is saved as a percentage so layouts restore correctly across different window sizes.

**Showing and hiding Secondary** is a single action:
- Click the `⊟` toggle in the top bar to hide Secondary (Main expands)
- Click the `⊞` toggle to show Secondary (last-used Secondary view reloads, or a view picker opens if none was previously assigned)
- `Ctrl+Shift+\` toggles Secondary from the keyboard

---

**Floating Panel**

Any registered view can be opened as a **floating panel** — a resizable, repositionable glass overlay that hovers above the layout without displacing either zone. This is the right answer for "I want one big view plus one small thing I can glance at" — the small thing floats, Main stays full width.

Floating panels:
- Open via right-click context menu → "Open as Floating Panel", or from the view picker
- Are resizable by dragging any edge or corner
- Are repositionable by dragging their header bar
- Snap to window edges and corners when dragged near them
- Can be minimized to a small pill in the corner (showing just the view name and a live metric if the view supports it — e.g. the usage view minimized shows the current session cost)
- Multiple floating panels can be open simultaneously
- Position and size persist per-view in `~/.norbert/layout.json`

The floating panel is the right home for persistently ambient views like the cost burn ticker or hook health monitor — things you want visible without giving them a full zone.

---

**Assigning Views to Zones**

Views are assigned to zones through four mechanisms, all consistent with each other:

**1. Right-click context menu on any plugin or view element:**
```
Open in Main Panel
Open in Secondary Panel
Open in New Window
Open as Floating Panel
```
This context menu is available on: sidebar icons, plugin view headers, items in the view picker, and any place in the UI where a specific plugin view is referenced (e.g. a session row that links to the Live Visualizer).

**2. Drag sidebar icon into a zone** — dragging a sidebar icon over the Main or Secondary zone highlights the target zone with a branded drop overlay. Dropping assigns that plugin's primary view to the zone, replacing whatever was there. Dropping onto the floating panel area (corner of the window) opens it as a floating panel instead.

**3. View picker** — shown when Secondary is empty or via `Ctrl+Shift+P` → "Change Main View" / "Change Secondary View". A searchable list of all registered views grouped by plugin. Selecting one assigns it to the target zone.

**4. Layout presets** — selecting a preset assigns views to zones directly (see Layout Persistence below).

In all cases, assigning a view to a zone *replaces* the current occupant of that zone — there is no stacking or queuing. The replaced view is simply unloaded; it can be reassigned at any time.

---

**Layout Persistence and Presets**

The current layout state — which view occupies each zone, divider positions, floating panel positions and sizes — is saved automatically to `~/.norbert/layout.json` on any change and restored on next launch. The persistence model stores zone assignments as a map keyed by zone name, so adding zones in a future release extends the schema without restructuring it.

**Named layout presets** allow saving and recalling frequently used configurations:

- `Ctrl+Shift+L` opens the **Layout Picker** — a command-palette-style list of saved layouts with a miniature thumbnail showing zone assignments
- "Save Current Layout As..." prompts for a name
- "Reset to Default" restores single-zone Main with Dashboard home

Built-in presets:

| Preset | Main | Secondary | Floating |
|---|---|---|---|
| **Default** | Dashboard | — | — |
| **Session Watch** | Live Visualizer | Sessions list | — |
| **Cost Monitor** | Usage / Analytics | Live Visualizer | — |
| **nWave Deliver** | Wave Flow Diagram | DES Visualizer | Artifact Browser (floating) |
| **Full Observability** | Live Visualizer | Hook Health | Usage (floating) |

Built-in presets cannot be deleted but "Save Copy As..." creates an editable variant.

---

**Plugin View Registration**

Plugins declare their available views when loading. A plugin can expose multiple named views — each is independently assignable to any named zone or a floating panel.

```typescript
api.ui.registerView({
  id: 'nwave-wave-flow',
  label: 'Wave Flow Diagram',
  icon: '〜',
  component: WaveFlowDiagram,
  primaryView: true,        // hint: open this view when sidebar icon is clicked
  minWidth: 400,
  minHeight: 300,
  floatMetric: null,        // no minimized-pill metric for this view
});

api.ui.registerView({
  id: 'nwave-des',
  label: 'DES Visualizer',
  icon: '⊛',
  component: DESVisualizer,
  minWidth: 300,
  minHeight: 250,
  floatMetric: 'des_block_count', // shows block count when minimized as floating pill
});
```

`primaryView: true` is a **hint to the layout engine**, not a directive. It tells the engine which view to open when the plugin's sidebar icon is clicked, but the engine decides what that means in practice (currently: open in Main zone). This keeps the layout engine and plugin code fully decoupled — if the layout model changes in a future version (e.g. open in last-focused zone, or prompt the user), plugin registrations do not need to change. Plugins declare what they are; the layout engine decides where they go.

The sidebar icon for a plugin opens that plugin's `primaryView` in Main. Secondary views from the same plugin are accessible via the right-click context menu, drag-and-drop, or the view picker.

---

### Multi-Window Support

Norbert supports opening multiple independent windows simultaneously, each with its own zone configuration. A user can have one window showing the Live Visualizer full-screen on a second monitor while another window shows the nWave Artifact Browser and DES Visualizer side by side on their primary monitor. Windows are fully independent in layout but share all data.

**Architecture — single backend, multiple UI windows**

The critical design constraint is that multiple windows must not cause performance degradation or data contention. This is achieved through a strict separation of backend and UI:

- **One backend process** — owns the SQLite database, the HTTP hook receiver, all hook processing, and the event bus. Runs as a Tauri sidecar process that starts when the first window opens and stays alive until the last window closes.
- **Each window is a pure UI shell** — a Tauri webview that subscribes to the backend's event stream via Tauri IPC. Windows do not process hooks, do not write to SQLite directly, and do not duplicate any backend logic. Opening a second window adds one more IPC subscriber and one more React render tree — the backend workload is unchanged.
- **Read queries from windows** go directly to SQLite (reads are non-blocking in WAL mode and can run concurrently without contention). Write operations (which are rare from the UI — mostly user config changes) are routed through the backend process to serialize them safely.

This is the same architecture VSCode uses: one main (Node) process owns all state, multiple renderer (Chromium) processes subscribe to it. Adding windows adds rendering work, not backend work.

**Opening a new window**

Four entry points:

- Right-click any plugin or view → "Open in New Window" — opens a new window with that view in Main, Secondary empty
- `Ctrl+Shift+N` — opens a new window with the default layout
- Tray icon context menu → "New Window"
- `Ctrl+Shift+P` → "Open New Window"

Each window gets its own layout state, independently persisted as `~/.norbert/layout-{window-id}.json`. The primary window's layout is `layout.json` as before; additional windows are numbered. On next launch, all previously open windows reopen with their saved layouts.

**Window management**

Windows are independent — closing one does not affect others. The last window closing stops the backend process. If all windows are closed but the tray icon is still present (Norbert running in tray-only mode), the backend stays alive and continues receiving hooks; reopening any window reconnects to the running backend instantly.

Windows can be differentiated by a user-assigned label ("Monitor 2 — nWave", "Session Overview") shown in each window's title bar. Labels are set via right-click on the title bar or `Ctrl+Shift+P` → "Label This Window".

---

### Data Density & Progressive Disclosure

The default view of any panel surfaces the most important 3–5 data points for that context — enough to answer "is everything OK and what's notable?" without requiring interpretation. Detail is available at every level but never forced:

- **Hover** reveals tooltips with precise values, timestamps, and context that would be too noisy to show permanently
- **Click** expands a card or opens the detail flyout with full data
- **Secondary click / kebab menu** on any element offers contextual actions — copy session ID, export diagram, disable hook, etc.
- **Search** (`Cmd+K` / `Ctrl+K`) opens a command palette that can navigate to any session, agent, hook, or plugin setting by name — the power-user path that bypasses all navigation

Keyboard shortcuts follow conventions: `Cmd+K` for command palette, `Cmd+[1-9]` for tab switching, `Esc` to dismiss flyouts and modals, `R` to refresh the current view, `E` to export the current visualization.

---

### Menu Navigation

Norbert's menu navigation is modeled on VSCode's conventions wherever the concepts map across, so that Claude Code users feel immediately at home. The same muscle memory applies — command palette for everything, sidebar for primary navigation, keyboard shortcuts following the same patterns.

---

**Command Palette**

`Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux) opens the command palette — the primary power-user navigation surface, identical in behavior to VSCode's. It is a fuzzy-search list of all available commands across Norbert core and all loaded plugins. Typing filters instantly. Commands show their keyboard shortcut on the right if one exists.

Example commands visible in the palette:

```
> Norbert: Open Session History
> Norbert: Select Color Theme
> Norbert: Open Theme Editor
> Norbert: Install Plugin...
> Norbert: Toggle Hook Health Monitor
> Norbert: Export Current Diagram
> nWave: Open DES Audit Log
> nWave: View Wave Flow Diagram
```

Plugins register their own commands into the palette via `api.ui.registerCommand()`. All plugin commands are prefixed with the plugin's display name so they are grouped and discoverable.

`Cmd+K` opens a lighter **quick-open** variant — navigation-focused rather than command-focused, for jumping to a specific session, agent, or hook by name. Equivalent to VSCode's `Cmd+P`.

---

**Sidebar Navigation**

The left sidebar is Norbert's primary navigation, equivalent to VSCode's Activity Bar. It contains icon buttons for each major section, stacked vertically. The active section is indicated by a brand-colored left-edge highlight bar — identical to VSCode's active icon treatment.

Default sidebar order (top to bottom):

```
⬡  Dashboard (home)
⏱  Sessions
🤖  Agents
🔧  Tools & MCP
⚙️  Config
🧩  Plugins
━━  (separator)
[plugin icons registered by loaded plugins]
━━  (separator — pinned to bottom)
🔔  Notifications
⚙️  Settings
```

Hovering a sidebar icon shows a tooltip with the section name — identical to VSCode's Activity Bar tooltip behavior.

**Sidebar badge counts** — plugins and core sections can post a numeric badge on their sidebar icon to communicate pending attention without requiring the user to navigate there. Badges appear as a small pill in the top-right corner of the icon. They are intentionally minimal: a count, nothing else.

Badge semantics by section:

| Icon | Badge meaning | Example |
|---|---|---|
| Hook Health | Count of active hook errors or timeouts | `1` when a hook is timing out |
| Sessions | Count of active live sessions (omitted if 0 or 1) | `3` when three sessions running simultaneously |
| Notifications | Count of unread notifications | `5` |
| nWave | Count of active DES enforcement blocks in the current session | `2` |
| Any plugin | Plugin-defined count via `api.ui.setBadge(count)` | Plugin-specific |

Badges are cleared when the user navigates to that section and the underlying condition resolves. A badge of `0` is always hidden — the icon returns to its normal state. Badges above `99` display as `99+`.

In the **Norbert theme**, badge pills use a dark amber background (`#f0920a`) with black text — consistent with the amber warning accent used throughout the theme, signaling that something needs attention. In the Claude and VS Code themes, badges use the standard red notification pill convention.

`api.ui.setBadge(count)` is how plugins post and clear badge counts. Setting count to `0` or `null` removes the badge. The hook health badge and notification badge are managed by core Norbert, not by plugins.

**Right-click context menu on any sidebar icon** — matches VSCode's Activity Bar right-click behavior exactly:

```
Open [Section Name]
─────────────────
Hide [Section Name]           ← hides this icon from the sidebar
─────────────────
⬡  Dashboard       ✓         ← checkmark = currently visible
⏱  Sessions        ✓         ← full list of all sections/plugins
🤖  Agents          ✓            with toggles; click to show/hide
🔧  Tools & MCP     ✓
⚙️  Config          ✓
🧩  Plugins         ✓
[nWave]            ✓
[any other plugins]
─────────────────
Reset Sidebar
```

This is the canonical way to toggle plugin icon visibility. The full section list in the context menu gives a single place to see everything — visible and hidden — and toggle any of them without navigating to settings. "Reset Sidebar" restores the default order and visibility state.

Hidden sections remain accessible via the command palette even when not shown in the sidebar — `Ctrl+Shift+P` → "Open [Section Name]" works regardless of visibility state.

Sections can be reordered by drag-and-drop within the sidebar. The separator between core sections and plugin sections can also be moved, allowing plugin icons to be promoted above core sections if desired. Order and visibility state persist across restarts in `~/.norbert/sidebar.json`.

Plugins register their sidebar icon via `api.ui.registerTab()`. Plugin tabs appear in the sidebar below the separator after all core tabs by default. The nWave plugin registers its tab icon here.

Clicking the active sidebar icon collapses the sidebar entirely (icon-only mode to hidden) — same behavior as clicking an active Activity Bar icon in VSCode. `Ctrl+B` toggles the sidebar open/closed.

---

**Settings Navigation**

`Cmd+,` opens Settings — the same shortcut as VSCode. Settings are organized as a left-nav tree with nested sections, equivalent to VSCode's Settings UI:

```
Settings
├── Appearance
│   ├── Color Theme
│   ├── Theme Editor
│   └── Font & Density
├── Hooks
│   ├── Hook Configuration
│   └── Registered Hooks
├── Plugins
│   ├── Installed Plugins
│   └── Marketplace
├── Account
│   └── Anthropic API Key
├── Notifications
├── Data & Privacy
├── Keyboard Shortcuts
└── [Plugin Settings sections registered by loaded plugins]
```

Plugin settings sections appear at the bottom of the tree, registered via `api.ui.registerSettingsSection()`. The nWave plugin registers a "nWave" section here containing DES config options, rigor level defaults, and wave phase display preferences.

A search box at the top of the Settings panel filters all settings across core and plugins by keyword — identical to VSCode's settings search behavior.

---

**Color Theme Selection**

Theme selection follows VSCode's exact interaction pattern:

1. `Cmd+K Cmd+T` opens the **Color Theme picker** — a quick-pick dropdown listing all installed themes
2. Arrowing up/down through the list applies the theme live to the UI behind the picker, with no confirmation needed
3. Pressing Enter confirms the selection; pressing Escape reverts to the previously active theme
4. The picker is also reachable via `Cmd+Shift+P` → "Select Color Theme" and via Settings → Appearance → Color Theme

Themes are grouped in the picker under headers: **Built-in Themes**, **Installed Themes**, and a **Browse Themes...** item at the bottom that opens the Marketplace filtered to themes.

---

**Keyboard Shortcuts Reference**

`Cmd+K Cmd+S` opens the Keyboard Shortcuts editor — same as VSCode. All Norbert core shortcuts and plugin-registered shortcuts are listed and editable. Shortcuts are stored in `~/.norbert/keybindings.json`, the same concept as VSCode's `keybindings.json`.

Core shortcuts follow VSCode conventions wherever applicable:

| Shortcut | Action |
|---|---|
| `Cmd+Shift+P` | Command palette |
| `Cmd+P` | Quick open (sessions, agents, hooks) |
| `Cmd+,` | Open settings |
| `Cmd+B` | Toggle sidebar |
| `Cmd+K Cmd+T` | Select color theme |
| `Cmd+K Cmd+S` | Open keyboard shortcuts |
| `Cmd+W` | Close current flyout or detail panel |
| `Escape` | Dismiss modal / flyout / picker |
| `Cmd+[1–9]` | Switch to sidebar section by position |
| `Cmd+Shift+F` | Search across all sessions and data |
| `R` | Refresh current view |
| `E` | Export current diagram or chart |

---

### Theme System

Norbert's theme system is deliberately separate from the plugin architecture. Themes are pure JSON token files — they have no lifecycle, no code, and no sandboxing requirements. Treating them as plugins would be overengineering a fundamentally simple thing. The model is VSCode's: themes are data, not code.

---

**Theme File Format**

Themes are `.norbert-theme` JSON files mapping CSS custom property names to values. The full token set is documented, but a minimal theme only needs to override the tokens it changes — all others fall back to the active base theme:

```json
{
  "name": "Copper",
  "author": "phil",
  "base": "norbert-dark",
  "tokens": {
    "--brand": "#c87941",
    "--brand-rgb": "200, 121, 65",
    "--brand-glow": "rgba(200, 121, 65, 0.25)",
    "--bg-base": "#0e0b09",
    "--bg-panel": "#161109"
  }
}
```

The `base` field inherits from a built-in theme. Valid base values are `norbert`, `claude-dark`, `claude-light`, `vscode-dark`, and `vscode-light`. A custom theme only needs to specify the tokens it changes — all others fall back to the base. Changing just `--brand` and `--brand-glow` is enough to produce a fully coherent custom variant because all active state colors, borders, and glow effects derive from those values.

Theme files live in `~/.norbert/themes/` and are loaded automatically on startup. Dropping a `.norbert-theme` file onto the Norbert window installs it immediately.

---

**Visual Theme Editor**

For users who don't want to hand-edit JSON, Settings → Appearance → Theme Editor provides a visual token editor. It is organized into sections — Brand, Backgrounds, Text, Semantic Colors, Glass & Borders — with a color picker for each token and a live preview of the full UI behind the editor panel as values change.

The editor writes to a theme file in real time as values are adjusted. "Save as New Theme" prompts for a name and writes the file to `~/.norbert/themes/`. "Export" saves it to a user-chosen location as a `.norbert-theme` file ready to share.

For power users, an "Edit JSON" button in the theme editor opens the raw theme file in the user's configured editor — the same `$EDITOR` / `$VISUAL` convention as VSCode's "Open settings.json" button.

---

**Theme Distribution**

Themes intended for distribution are published to npm as `norbert-theme-<name>` packages — a distinct naming convention from `norbert-plugin-<name>`. This gives themes discoverability, versioning, and a one-line install:

```bash
npm install -g norbert-theme-dracula
```

Norbert detects installed `norbert-theme-*` npm packages at startup and surfaces them in the theme picker automatically — no separate registration step needed.

The Plugin Marketplace in Norbert browses both plugins and themes as separate tabs with the same install UX. Theme listings show a preview swatch with the brand color, background tone, and a miniature sample of a chart and the session visualizer so users can evaluate them without installing. One-click install triggers the npm install and immediately makes the theme available in the picker.

---


---

## UI Design Process

Norbert's UI features follow a deliberate design loop that separates the act of *visualizing* an idea from the act of *specifying* it. The stages are not optional shortcuts — they exist because mockups reveal problems that prose descriptions cannot, and because premature spec-writing bakes in decisions that mockup critique would have invalidated.

The process applies to any new UI feature of meaningful complexity: a new plugin view, a new control surface, a new interaction pattern. Simple additions (a new stat card, a new notification event) can skip to spec writing directly.

---

### The Loop

**1. Concept sketch**

Prose description of the feature: what it does, why it exists, roughly how it works. No implementation detail. Often lives in a conversation before it becomes a spec section. The goal is a shared mental model, not a complete design.

**2. Throwaway mockup**

A static or lightly interactive HTML prototype. No architecture decisions baked in. No production code written. The mockup's only job is to make the idea *visible* so it can be reacted to viscerally rather than abstractly. Speed matters here — a rough mockup done fast is more valuable than a polished mockup done slow, because it generates feedback sooner.

Mockups are explicitly disposable. A mockup that reveals a design issue has succeeded at its job, regardless of whether any of its code is kept.

**3. Mockup review**

Structured critique against the rendered mockup. What feels wrong? What's missing? What did seeing it reveal that reading the concept sketch did not? The review is a conversation, not a checklist. The output is a set of decisions — which direction to take, what to change, what to abandon.

The v4 filter bar mockup is an example of this phase working correctly: the global Live/Playback toggle and filter pills looked coherent in prose but revealed an obvious design flaw when rendered — different plugins don't share a coherent current state, so a global toggle was a fiction. That reaction only happened because there was something to react to. The v5 mockup then demonstrates the per-plugin model.

**4. Distillation**

Take the critique and turn it into decisions. Not writing yet — deciding. This phase resolves any open questions from the review: which direction was chosen, what the tradeoffs are, what was explicitly rejected and why. Distillation outputs are bullet points or short prose, not spec language.

**5. Spec writing**

Write the feature into this document with full fidelity. Every decision made in distillation gets precise language. API surface is defined. Interaction behavior is specified. Edge cases are called out. This is the document development implements against.

**6. Development**

Implement against the spec, using the mockup series as a visual reference for intent. When implementation reveals a spec ambiguity, the spec is updated before the code is written — not after.

---

### Mockup Versioning

Mockups are named with a version suffix: `norbert-mockup-v1.html`, `norbert-mockup-v2.html`, etc. Each version is a full standalone file — no diffs, no dependencies on previous versions. The version history is preserved because the delta between versions is often more informative than the latest version alone: it shows what changed and why.

The current mockup version is always the canonical visual reference for the current spec state. When a spec section is substantially revised, a new mockup version should follow.

---

### What Goes in a Mockup vs. What Goes in the Spec

**Mockup** — visual layout, interaction feel, information density, color and typography, widget positions, animation character. Mockups answer "does this feel right?"

**Spec** — behavior, data model, API surface, edge cases, error states, plugin contracts, performance requirements. The spec answers "how does this work?"

A mockup that tries to specify behavior is over-engineered. A spec that tries to convey layout is under-specified. The two artifacts are complementary and deliberately do not overlap.

---

## Build Order

Development proceeds in phases where each phase is independently deliverable and useful before the next begins. The guiding principle is infrastructure first — the delivery pipeline and vertical slice that prove the full system works are built before any features, so every subsequent feature ships through a proven, reliable pipeline.

---

### Phase 0 — CI/CD Pipeline

*The enabler. Nothing ships without this.*

- GitHub Actions workflow using `tauri-apps/tauri-action` builds a Windows x64 binary on each version tag push
- Built binary is automatically attached to a GitHub Release
- `package.json` postinstall script downloads the Windows binary from GitHub Releases
- `npx github:your-org/norbert-cc` installs and launches on Windows 11 with no manual steps
- macOS and Linux build targets are added to the matrix when platform expansion begins

**Exit criteria:** A tagged commit triggers the pipeline, the Windows binary appears on the GitHub Release, and `npx github:your-org/norbert-cc` installs and launches on a Windows 11 machine with no manual steps.

---

### Phase 1 — Vertical Slice MVP

*The thinnest possible thing that exercises the full stack.*

- Tauri app shell with tray icon and a window that opens on click
- Window displays Norbert name, version, and a status indicator showing "Listening" or "No active session"
- `~/.claude/settings.json` merger runs on first launch, registering Norbert's HTTP hooks
- Hook receiver HTTP server starts on port 3748 and accepts POST requests
- SQLite database initializes at `~/.norbert/norbert.db` with the core schema
- Raw hook events are written to the database as they arrive — no UI for viewing them yet

**Exit criteria:** Install Norbert via `npx github:your-org/norbert`, run Claude Code, trigger any action, and confirm via a database query that the hook event was captured. The app looks minimal but the entire data path — from Claude Code hook to installed desktop app — is proven working.

---

### Phase 2 — Does Something

*The moment Norbert becomes real.*

- Session list view: open Norbert after running Claude Code and see the session appear with timestamp, duration, and basic event count
- Clicking a session shows its raw hook events in a simple list
- The app is now genuinely useful in a minimal way — it proves data flows from Claude Code into a readable UI

This is the first version worth sharing with a collaborator. It is not impressive but it is *alive* — Norbert observes something and shows you what it saw.

**Exit criteria:** Run Claude Code, do something, open Norbert, see the session and its events displayed in the UI without any manual steps.

---

### Phase 3 — Plugin Architecture & Layout Engine

*The structural investment that makes every subsequent feature faster and safer.*

- Define and implement the full `NorbertAPI` contract: `db`, `hooks`, `ui`, `mcp`, `events`, `config`, `plugins`
- Implement the plugin loader, dependency resolver, and disabled-dependency warning system
- Implement the **layout engine** — initial two-zone model (Main + optional Secondary), draggable divider, floating panel support, view picker, right-click context menu (Open in Main / Secondary / New Window / Floating Panel), drag-from-sidebar to zone assignment, layout persistence and named presets. The zone abstraction must be count-agnostic so additional zones can be introduced in a future release without changing the plugin API
- Implement **multi-window support** — single backend process architecture, Tauri IPC event subscription per window, per-window layout persistence, new window entry points, window labelling
- Implement **sidebar icon visibility** — right-click context menu with full toggle list, drag-to-reorder, persistence in `~/.norbert/sidebar.json`
- Migrate the Phase 2 session list feature into `norbert-session`, the first first-party plugin, built entirely against the plugin API including `api.ui.registerView()`
- Validate that the plugin API and layout engine are sufficient and stable by building `norbert-session` against them — refine based on what feels wrong before writing any more plugins

**Exit criteria:** `norbert-session` is a functioning first-party plugin. Its view is assignable to any named zone (initially Main and Secondary), a floating panel, and a new window via right-click and drag-and-drop. Two windows can be open simultaneously with independent layouts and no performance degradation. Sidebar icons can be hidden and reordered via right-click. Layout and window state restores correctly after restart. The zone abstraction handles N zones — adding a third zone in a future release requires only layout engine changes, not plugin API changes.

---

### Phase 4+ — Plugin Delivery

*Each plugin is a discrete deliverable shipped through the proven pipeline. Priority is governed by three factors weighted in order: foundational value (does it unblock other plugins?), user impact at current adoption stage (simpler and more immediately useful scores higher early), and visual impact (stunning views that make Norbert shareable). Priority is a starting point, not a commitment — revisit after each ship based on usage and feedback.*

---

**Priority order:**

**Tier 1 — Core value, ship fast**

These plugins are simple relative to their impact, require minimal dependencies, and produce the "wow" moments that make Norbert worth installing. Ship these before anything else.

| Priority | Plugin | Why first |
|---|---|---|
| 1 | `norbert-usage` | Token tracking + cost burn ticker is the #1 reason someone installs Norbert. Gauge Cluster and Oscilloscope ship with this — first signature visualizations. Minimal dependencies. |
| 2 | `norbert-session` extensions | Live Session Visualizer is the flagship visual. Session Replay and Session Digest follow. Depends on `norbert-usage` data layer being stable. |
| 3 | `norbert-config` | Configuration Viewer is the learning tool and the entry point for new users. No session data required — ships independently of runtime data layer. Fast to build, high teaching value. |
| 4 | `norbert-notif` | Notification center should be available early so every subsequent plugin can fire into it rather than managing its own delivery. Simple plugin, high leverage. |
| 5 | `norbert-anomaly` | Anomaly detection + cost forecasting. Depends on `norbert-usage` history accumulating. Context Pressure Horizon signature visualization ships with this. |

**Tier 2 — Depth and observability**

These plugins require the Tier 1 data layer and add the observability depth that makes Norbert indispensable for power users.

| Priority | Plugin | Why here |
|---|---|---|
| 6 | `norbert-agents` | Agent Interaction Diagrams and Scorecards. Depends on session data layer. Agent Constellation (Three.js) is the visual showpiece — ships when WebGL integration is stable. |
| 7 | `norbert-mcp` | MCP Server Dashboard and Tool Heatmap. Depends on tool attribution data from `norbert-usage` and `norbert-session`. MCP Call Radar ships with v2. |
| 8 | `norbert-archaeology` | Prompt Archaeology. Depends on `norbert-session` and `norbert-agents` for full context reconstruction. High user value; moderate build complexity. |
| 9 | `norbert-debug` | Session Debugger. Depends on `norbert-session`, `norbert-agents`, `norbert-archaeology`. The causal event inspector is the core view — ship that first, add context state replay later. |
| 10 | `norbert-perf` | Performance Profiler. Depends on `norbert-session`, `norbert-agents`, `norbert-mcp`. Latency tables ship first; flame graph follows when data layer is mature. |

**Tier 3 — Polish, platform, and ecosystem**

These plugins extend Norbert's reach rather than its core observability. Ship when Tier 1 and 2 are stable and the plugin ecosystem has traction.

| Priority | Plugin | Why here |
|---|---|---|
| 11 | `norbert-account` | Anthropic Admin API integration. Useful but requires organizational API access — smaller initial audience. Ship when Tier 1/2 usage justifies the auth complexity. |
| 12 | Norbert MCP server | Expose Norbert data to Claude via MCP. High concept value, moderate build complexity. Ship when SQLite schema is stable enough to commit to a query interface. |
| 13 | `norbert-config` marketplace | Plugin Marketplace UI and theme browser. Requires community plugin ecosystem to exist before the marketplace has anything to show. |
| 14 | Theme system | Theme editor and `norbert-theme-*` npm detection. The five built-in themes ship from day one; the editor and third-party theme loading ship here. |
| 15 | `norbert-dashboard` | Custom metrics panel, widget registry, `.norbert-panel` format. Ships when Tier 1/2 metric registry is mature and community appetite for customization is evident. |

**Tier 4 — nWave and third-party**

| Priority | Plugin | Why here |
|---|---|---|
| 16 | `norbert-cc-plugin-nwave` | nWave session visualization, Wave Flow Diagram, DES Visualizer, Artifact Browser, DES Thermal View. A full plugin build in its own right — ship after core platform is stable. Depends on `norbert-session`, `norbert-agents`, `norbert-mcp`, `norbert-config`, `norbert-archaeology`. |

---

**Signature visualization delivery sequence** *(within their parent plugins)*

The six signature visualizations ship in this order, each when its parent plugin and required data layer are stable:

1. **Gauge Cluster** — with `norbert-usage` Tier 1. Simple canvas, high visual impact, ships early.
2. **Token Burn Oscilloscope** — with `norbert-usage` Tier 1. Live canvas, phosphor effect, ships with Gauge Cluster.
3. **Context Pressure Horizon** — with `norbert-anomaly` Tier 1. Requires context utilization time-series data.
4. **DES Enforcement Thermal** — with `norbert-cc-plugin-nwave` Tier 4.
5. **Agent Constellation** — with `norbert-agents` v2 Tier 2. Requires Three.js/WebGL integration.
6. **MCP Call Radar** — with `norbert-mcp` v2 Tier 2. Requires mature MCP analytics data layer.

---

Plugin priority should be revisited after each Tier 1 ship based on actual usage patterns, collaborator feedback, and which features users are asking for. The order above is a reasoned starting point, not a commitment.



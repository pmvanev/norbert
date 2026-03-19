# Performance Monitor Design Spec

**Inspired by**: Windows Task Manager Performance tab
**Adapted for**: Claude Code session observability in Norbert

---

## 1. Layout

Master-detail dual-pane, same as Task Manager:

```
+------------------+--------------------------------------------+
| LEFT SIDEBAR     | RIGHT DETAIL PANE                          |
|                  |                                            |
| [Tokens/s]  ~~~ | Header: metric name + current value        |
| [Cost]      ~~~ |                                            |
| [Agents]    ~~~ | +----------------------------------------+ |
| [Context]   ~~~ | |                                        | |
|                  | |         MAIN GRAPH                     | |
| (each with a    | |         (scrolling line chart)          | |
|  mini sparkline  | |                                        | |
|  and current     | +----------------------------------------+ |
|  value)          | "60 seconds"                               |
|                  |                                            |
|                  | +--- STATS GRID (2 columns) -------------+ |
|                  | | Peak      1.2k tok/s | Sessions    3    | |
|                  | | Average   450 tok/s  | Total Tok  45k   | |
|                  | | Cost Rate $0.03/min  | Tool Calls 127   | |
|                  | +----------------------------------------+ |
|                  |                                            |
|                  | +--- PER-SESSION BREAKDOWN ---------------+ |
|                  | | Session        Tok/s  Agents  Context   | |
|                  | | abc123...      820    2       45%       | |
|                  | | def456...      380    1       72%       | |
|                  | +----------------------------------------+ |
+------------------+--------------------------------------------+
```

### Left Sidebar

Each metric category is a clickable row containing:
- **Category label** (e.g., "Tokens/s", "Cost", "Agents", "Context")
- **Current value** displayed prominently (e.g., "1.2k tok/s", "$0.03/min", "3", "45%")
- **Mini sparkline** — a tiny ~80x20px version of the metric's graph, showing the last 60s of data

The selected category has an accent-colored left border highlight.

### Metric Categories

| Category | What the main graph shows | Y-axis unit | Line color |
|----------|--------------------------|-------------|------------|
| **Tokens/s** | Token burn rate over time | tok/s | `--brand` (cyan/teal) |
| **Cost** | Cost accumulation rate over time | $/min | `--amber` (amber/gold) |
| **Agents** | Active agent count over time | count | `#4a9eff` (blue) |
| **Context** | Context window utilization over time | % (0–100) | `#7aa89e` (muted teal) |

Each category gets its own dedicated graph with a Y-axis scaled to its unit type. No mixing units on the same axis. This is the core difference from what we had before — **one graph per unit type**, not everything crammed together.

### Right Detail Pane

Top to bottom:
1. **Header**: category name + hardware-style subtitle (e.g., "Tokens/s" / "claude-sonnet-4-20250514")
2. **Main graph**: large scrolling line chart, 60-second window
3. **Time label**: "60 seconds" below the graph (or "5 minutes" / "15 minutes" per time window selection)
4. **Stats grid**: 2-column grid of related numerical readouts
5. **Per-session breakdown**: table showing per-session values for the selected metric

---

## 2. The Main Graph

### Visual Style

- **Line chart with filled area beneath** — the area below the line is filled with a semi-transparent version of the line color (~15% opacity). This gives visual weight showing the "volume" of the metric.
- **Line**: 1.5px, anti-aliased, smooth. No dots at data points.
- **Fill**: gradient from line color at 15% opacity at the top of the fill down to 5% at the x-axis.
- **Background**: dark inset panel (`rgba(0, 8, 6, 0.8)` in Norbert theme). Distinct from the surrounding card background.
- **Grid lines**: subtle horizontal lines at major Y-axis intervals. Very faint (`rgba(255,255,255,0.06)`). No vertical grid lines (unlike the oscilloscope — keeps it cleaner).
- **Y-axis labels**: right-aligned, faint text, at each horizontal grid line.
- **No X-axis tick labels** — just the "60 seconds" duration indicator below.

### Scrolling

- Right to left, newest data at right edge
- When idle (no new data), inject zero-rate heartbeat samples to keep the line scrolling
- Update frequency: ~1Hz for the graph data, ~10Hz for canvas redraw (smooth scrolling between data points via interpolation)

### Current Value Overlay

- The current (most recent) value is displayed as a large, bold number in the top-left corner of the graph area
- Font: monospace, bold, 18px
- Color: same as the line color

### Time Window Selector

- Small pill buttons below the graph header: **1m** | **5m** | **15m** | **Session**
- Changes the graph's time window (and sample resolution)
- Default: 1m

### Per-Session Graphs (Always Visible)

Inspired by Task Manager's "Change graph to > Logical processors" feature that splits the CPU graph into a grid of per-core mini-graphs.

The detail pane always shows **both** aggregate and per-session views stacked vertically:

1. **Aggregate graph** (top, large): the main graph showing the total/aggregate metric across all sessions — this is always the hero element
2. **Per-session graph grid** (below, smaller): a grid of mini-graphs, one per active session, automatically appearing when there are 2+ sessions

The per-session grid:
- Each mini-graph shows that session's individual time series for the selected category
- Each graph has a **label** (truncated session ID) and **current value** overlaid
- All graphs share the **same Y-axis scale** (the category's `yMax`) for visual comparison
- The grid auto-arranges: 2 sessions = 2 columns, 3 sessions = 2x2 grid (one empty), 4+ sessions = 3 columns
- Each graph uses the same filled-area line chart style as the aggregate graph
- Grid lines are omitted from mini-graphs to reduce clutter (only the line + fill)
- When only 1 session is active, the per-session grid is hidden (aggregate = session in this case)

This works for all four categories:

| Category | Aggregate shows | Per-Session shows |
|----------|----------------|-------------------|
| **Tokens/s** | Total tok/s across all sessions | Each session's individual tok/s |
| **Cost** | Total $/min across all sessions | Each session's individual $/min |
| **Agents** | Total agent count | Each session's agent count |
| **Context** | Max context % across sessions | Each session's context % |

**Data requirement**: Each session needs its own independent time-series buffer per category. The `MultiSessionStore` already tracks per-session `SessionMetrics`; we need to extend it to also maintain per-session `TimeSeriesBuffer` objects (or compute per-session rate samples in the hook processor).

### Hover Tooltips

Hovering over any point on a graph line reveals a tooltip anchored near the cursor:

- **Trigger**: mouse enters the graph canvas area. As the cursor moves horizontally, the tooltip tracks the nearest data point in the time series.
- **Visual indicator**: a thin vertical crosshair line (1px, `rgba(255,255,255,0.3)`) from top to bottom of the graph at the hovered X position. A small dot (4px circle, line color) marks the exact data point on the line.
- **Tooltip content** (varies by category):
  - **Tokens/s**: `"842 tok/s · 23s ago"`
  - **Cost**: `"$0.0341/min · 23s ago"`
  - **Agents**: `"3 agents · 23s ago"`
  - **Context**: `"72% · 23s ago"`
- **Tooltip style**: small floating box with dark background (`rgba(0,8,6,0.95)`), 1px border in the line color, monospace font, 10px. Positioned above and to the right of the cursor (flips left if near the right edge).
- **Time offset**: displayed as seconds ago relative to the right edge (newest point), e.g., "23s ago", "1s ago", "58s ago"
- **Applies to**: both aggregate graphs and per-session mini-graphs
- **Exit**: tooltip disappears when cursor leaves the canvas area

---

## 3. Stats Grid

Positioned below the graph. Two columns, 3 rows. Labels in small uppercase, values in large monospace.

The stats shown depend on which category is selected:

### Tokens/s selected:
| Left column | Right column |
|-------------|-------------|
| **Peak** — highest tok/s in window | **Sessions** — active session count |
| **Average** — mean tok/s in window | **Total Tokens** — cumulative across all sessions |
| **Cost Rate** — current $/min | **Tool Calls** — cumulative across all sessions |

### Cost selected:
| Left column | Right column |
|-------------|-------------|
| **Current** — $/min right now | **Sessions** — active session count |
| **Session Total** — $ spent this session | **Total Cost** — cumulative across all sessions |
| **Avg Cost/Token** — efficiency metric | **Model** — current model name |

### Agents selected:
| Left column | Right column |
|-------------|-------------|
| **Active** — current agent count | **Sessions** — active session count |
| **Peak** — max concurrent agents seen | **Total Spawned** — cumulative agents |
| **Agents/Session** — average | **Tool Calls** — cumulative |

### Context selected:
| Left column | Right column |
|-------------|-------------|
| **Current** — context window % | **Remaining** — tokens until limit |
| **Max Tokens** — context window capacity | **Model** — current model |
| **Urgency** — normal/amber/red | **Compressions** — if tracked |

---

## 4. Per-Session Breakdown

A compact table below the stats grid. Each row represents one active Claude Code session.

Columns change based on selected category:

### Tokens/s selected:
| Session ID | Tokens/s | Agents | Cost |

### Context selected:
| Session ID | Context % | Urgency | Remaining |

### Agents selected:
| Session ID | Agents | Tokens/s | Status |

The table:
- Monospace font for values
- Alternating row backgrounds for readability
- Session IDs truncated with ellipsis
- Rows sorted by the primary metric descending (highest first)

---

## 5. Visual Design

### Norbert Theme (default)

| Element | Value |
|---------|-------|
| App background | `#060d0b` |
| Card/panel background | `rgba(0, 229, 204, 0.03)` |
| Graph inset background | `rgba(0, 8, 6, 0.8)` |
| Grid lines | `rgba(0, 229, 204, 0.06)` |
| Primary text | `#c8f0e8` |
| Secondary text | `rgba(0, 229, 204, 0.55)` |
| Muted text (labels) | `rgba(0, 229, 204, 0.22)` |
| Brand/primary line | `#00e5cc` |
| Amber/cost line | `#f0920a` |
| Blue/agent line | `#4a9eff` |
| Context line | `#7aa89e` |
| Border | `rgba(0, 229, 204, 0.1)` |
| Font (labels) | Rajdhani (--font-ui) |
| Font (values) | Share Tech Mono (--font-mono) |

### Urgency Colors

| Level | Condition | Color |
|-------|-----------|-------|
| Normal | < 70% | `--brand` |
| Amber | 70–89% | `--amber` |
| Red | >= 90% | `#ff4444` |

---

## 6. Sidebar Mini-Sparklines

Each sidebar row has a tiny sparkline graph:
- **Size**: fills available width (~80px) x 20px tall
- **Style**: just the line — no fill, no grid, no axes, no labels
- **Line**: 1px, same color as the category's main graph line
- **Data**: same 60-second buffer as the main graph, downsampled to fit
- **Purpose**: gives a quick visual "shape" of each metric without needing to click through

---

## 7. What We Don't Do (vs Task Manager)

| Task Manager Feature | Our Approach |
|---------------------|--------------|
| Right-click context menus | Not needed — we have the time window pills and sidebar navigation |
| "Show kernel times" overlay | Not applicable |
| Double-click compact mode | Not applicable (Norbert already has zone management) |
| Hardware spec readouts (cache, sockets) | Replaced with Claude Code-specific info (model, session ID) |
| Memory composition bar | Could add context window composition later |
| Update speed selector | Fixed at ~1Hz data / ~10Hz render for now |

---

## 8. Data Sources

| Metric | Source | Currently Available? |
|--------|--------|---------------------|
| Tokens/s per session | MetricsStore + MultiSessionStore | Yes |
| Tokens/s total | Sum across MultiSessionStore | Yes |
| Cost rate | Derived from token rate + pricing model | Yes |
| Active agents | `activeAgentCount` from SessionMetrics | Yes (per session) |
| Active agents total | Sum across sessions | Yes |
| Context window % | `contextWindowPct` from SessionMetrics | Field exists, not yet populated |
| Tool calls | `toolCallCount` from SessionMetrics | Yes |
| Session cost | `sessionCost` from SessionMetrics | Yes |
| Model name | `contextWindowModel` from SessionMetrics | Field exists, not yet populated |
| Tokens/s per agent | Would need agent_id in hook events | No — blocked by Claude Code hook format |

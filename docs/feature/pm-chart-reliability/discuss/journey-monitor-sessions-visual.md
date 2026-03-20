# Journey: Monitor Active Claude Code Sessions

## Overview

A Norbert user opens the Performance Monitor to observe token consumption, cost
burn rate, agent counts, and context window usage across active Claude Code
sessions -- the same way one would open Windows Task Manager to see CPU and
memory graphs.

## Persona

**Raj Patel** -- a senior developer running 2-3 Claude Code sessions in
parallel (a refactoring agent, a test-writing agent, and an interactive
session). He wants to glance at the PM and immediately understand resource
consumption patterns without mental math.

---

## Journey Flow (ASCII)

```
[Trigger]         [Step 1]          [Step 2]          [Step 3]          [Step 4]
Open PM tab  -->  See live     -->  Hover chart  -->  Switch time  -->  Switch
                  charts             for detail        window           category
                  scrolling

Feels:            Feels:            Feels:            Feels:            Feels:
Curious           Oriented          Informed          In control        Comprehensive
"What's           "I see             "Exactly          "Let me zoom      "Now cost..."
happening?"       activity"          842 tok/s         out to 5m"
                                     12s ago"

Artifacts:        Artifacts:        Artifacts:        Artifacts:        Artifacts:
selectedCategory  samples[]         HoverState        TimeWindowId      MetricCategoryId
multiSessionStore uPlot instance    tooltipX/Y        windowSamples     categoryBuffer
```

---

## Emotional Arc

```
Curious --> Oriented --> Informed --> In Control --> Confident
  |            |             |            |              |
  Start        First         Tooltip      Time window    Category
  (open PM)    render        hover        change         switch
               with data     near cursor  shows data     shows data
```

**Pattern: Confidence Building** -- anxious/uncertain at start (are my sessions
burning tokens?), building to confident awareness through progressive
information disclosure.

---

## Step 1: See Live Charts Scrolling

### What Raj Expects

Opening the PM tab shows charts that are visibly alive -- a line advancing
rightward as new data points arrive, similar to Windows Task Manager's CPU
graph. The chart area is never blank when sessions are active.

### Desktop Mockup

```
+-- Performance Monitor -------------------------------------------+
| [sec-hdr] Performance Monitor            [1m] [5m] [15m] [Sess] |
+------------------------------------------------------------------+
|  SIDEBAR        |  DETAIL PANE                                   |
|                 |                                                 |
|  [*] Tokens/s   |  Tokens/s                                      |
|  [ ] Cost       |  Aggregate across 3 sessions                   |
|  [ ] Agents     |                                                 |
|  [ ] Context    |  +-- Aggregate Chart --------------------------+|
|                 |  |  842--+                                     ||
|                 |  |       |    ____/\                            ||
|                 |  |       |___/      \___/\_____                 ||
|                 |  |  0    |                     \_____>>>  NOW   ||
|                 |  +-------------------------------------------- +|
|                 |  60 seconds                                     |
|                 |                                                 |
|                 |  +-- Per-Session Grid -------------------------+|
|                 |  | [sess-abc1]   | [sess-def2]   | [sess-gh3]  ||
|                 |  |  __/\__       |  ____          |  _/\_      ||
|                 |  | /      \___   | /    \____     | /    \___  ||
|                 |  +---------------------------------------------+|
|                 |                                                 |
|                 |  Peak: 842 | Avg: 410 | Sessions: 3            |
+------------------------------------------------------------------+
```

### Current Broken State

Charts render an empty rectangle. The sidebar sparklines may show data, but the
detail pane aggregate chart is blank despite active sessions.

### Error Paths

- **No sessions active**: Show empty state with message "No active sessions
  detected. Start a Claude Code session to see metrics."
- **Data pipeline stalled**: Chart shows flat line at last known value rather
  than disappearing.

---

## Step 2: Hover Chart for Detail

### What Raj Expects

Moving the mouse over the chart shows a vertical crosshair line that tracks
the cursor precisely. A floating tooltip appears near the cursor (not 200px
away) showing the exact value and time offset.

### Desktop Mockup

```
+-- Aggregate Chart -------------------------------------------+
|  842--+                                                      |
|       |    ____/\          |  <-- crosshair at cursor        |
|       |___/      \___/\____|\_____                           |
|  0    |                          \_____>>>  NOW              |
+--------------------------------------------------------------+
                             ^
                        +----------+
                        | 527 tok/s|
                        | 12s ago  |
                        +----------+
                        tooltip near cursor
```

### Current Broken State

- Crosshair line appears offset to the right of the actual cursor position
  (DPI scaling issue on Windows).
- Tooltip renders far below and to the right of the cursor.

---

## Step 3: Switch Time Window

### What Raj Expects

Clicking "5m" shows the last 5 minutes of data at a coarser sample interval.
The chart redraws with the wider time range. All four buttons (1m, 5m, 15m,
Session) are functional.

### Current Broken State

Buttons change visual active state but the chart continues showing the same
60-sample buffer. The `multiWindowSampler` domain logic exists but is not wired
into the store.

---

## Step 4: Switch Category

### What Raj Expects

Clicking "Cost" in the sidebar shows cost rate charts using the same layout.
Charts switch instantly with correct data and formatting for the selected
category.

### Current State

This works at the UI level (category selection updates), but inherits the
same blank-chart and tooltip-offset problems from Steps 1-2.

---

## Integration Checkpoints

1. **Data Pipeline -> Chart**: `hookProcessor` appends samples to
   `multiSessionStore`, which notifies subscribers, causing React re-render,
   which calls `uPlot.setData()`.
2. **Time Window -> Buffer**: `PMTimeWindowSelector.onChange` updates
   `selectedWindow` state, which should select the corresponding buffer from
   `multiWindowSampler` (currently broken -- always uses 60-sample buffer).
3. **Mouse Position -> Tooltip**: `mousemove` on `uPlot.over` captures
   `clientX`/`clientY`, which flows through `HoverState` to `PMTooltip`
   positioned via CSS `fixed`.
4. **DPI Scaling -> uPlot Cursor**: `devicePixelRatio` must be accounted for
   in uPlot's cursor positioning and `pxAlign` setting.

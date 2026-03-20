<!-- markdownlint-disable MD024 -->

# pm-chart-reliability: User Stories

---

## US-PMR-01: Live Chart Data Rendering

### Problem

Raj Patel is a senior developer running 3 Claude Code sessions in parallel
("refactor-abc1", "tests-def2", "chat-ghi3") consuming approximately 840
tokens/second combined. He finds it frustrating that the Performance Monitor
charts show a blank rectangle despite the sidebar numbers updating, forcing him
to rely on the oscilloscope view or raw numbers to understand token burn.

### Who

- Developer with multiple active sessions | Monitoring resource consumption | Wants immediate visual confirmation that sessions are active and consuming resources

### Solution

Charts display a visible, non-empty line graph whenever active sessions are
generating data. The chart line advances rightward in real time as new samples
arrive, producing a scrolling time-window effect similar to Windows Task Manager.

### Domain Examples

#### 1: Happy Path -- Three sessions generating data

Raj opens the Performance Monitor with 3 active sessions. The aggregate chart
shows a line oscillating around 840 tok/s. The line visibly extends rightward
every second. Each of the 3 per-session mini charts shows its own data line
(420, 310, 110 tok/s respectively).

#### 2: Edge Case -- Session ends while viewing

Raj is watching 3 sessions. The "chat-ghi3" session completes. The aggregate
chart dips as the ended session's contribution drops to zero. The per-session
grid shrinks from 3 to 2 mini charts. No blank chart appears.

#### 3: Error/Boundary -- No active sessions

Raj opens the Performance Monitor with zero active sessions. Instead of a blank
chart, an empty-state message reads "No active sessions detected. Start a
Claude Code session to see metrics." When a session starts, data begins flowing
within 2 seconds.

### UAT Scenarios (BDD)

#### Scenario: Charts render data for active sessions

Given Raj has 3 active Claude Code sessions generating events
When the Performance Monitor aggregate chart renders
Then the chart displays a visible line with at least 10 data points
And the line represents the combined token rate across all sessions

#### Scenario: Chart line advances over time

Given the aggregate chart is displaying data
When 5 seconds elapse with active sessions generating events
Then the chart line has extended rightward with new data points
And the rightmost point corresponds to the most recent sample timestamp

#### Scenario: Per-session charts show individual data

Given 3 sessions are active with rates of approximately 420, 310, and 110 tok/s
When the per-session grid renders
Then each session has a mini chart with a non-empty data line
And the chart for "refactor-abc1" shows visibly higher amplitude than "chat-ghi3"

#### Scenario: Empty state displayed when no sessions exist

Given Raj has no active Claude Code sessions
When the Performance Monitor view renders
Then an empty-state message is displayed instead of a blank chart
And the message instructs Raj to start a session

#### Scenario: Chart continues after session ends

Given 3 sessions are active and the chart is rendering
When the "chat-ghi3" session ends
Then the aggregate chart continues updating with data from 2 sessions
And the per-session grid shows 2 mini charts instead of 3

### Acceptance Criteria

- [ ] Aggregate chart displays a non-empty line whenever active sessions exist and have generated at least one event
- [ ] Chart line advances rightward at approximately 1Hz as new samples arrive
- [ ] Per-session mini charts each show individual session data
- [ ] Empty-state message appears when no sessions are active
- [ ] Ending a session removes its mini chart without disrupting remaining charts
- [ ] Chart renders without visible frame drops or freezing with up to 900 data points in the buffer

### Technical Notes

- The data pipeline flows: `hookProcessor` -> `appendSessionSample` -> `multiSessionStore` subscriber notification -> React re-render -> `uPlot.setData()`
- `uPlot.setData()` must receive non-empty `Float64Array`; an empty array causes a blank canvas
- The `multiSessionStore.getAggregateBuffer()` recomputes by summing latest per-session values; if session buffers are empty, aggregate is zero
- Investigate whether `appendSessionSample` is being called (data pipeline) vs whether `uPlot` is rendering the data (rendering pipeline) -- the oscilloscope (canvas-based) works, suggesting the data pipeline may be functional but uPlot integration may be faulty

### Dependencies

- None (standalone fix of existing infrastructure)

---

## US-PMR-02: DPI-Aware Tooltip and Crosshair Positioning

### Problem

Raj Patel hovers over a data point on the Performance Monitor chart on his
Windows 11 laptop (150% DPI scaling). The vertical crosshair line appears
roughly 50 pixels to the right of his actual cursor position, and the tooltip
floats far below and to the right. Multiple fix attempts using `u.over`
instead of `u.root` and raw `clientX`/`clientY` have not resolved the offset.
He cannot trust that the displayed value corresponds to the point he is
hovering over.

### Who

- Developer on Windows with DPI scaling (125% or 150%) | Inspecting specific data points | Wants precise, trustworthy tooltip values aligned to cursor position

### Solution

The crosshair vertical line tracks the actual cursor position within 2 pixels
at any DPI scaling between 100% and 200%. The tooltip appears within 16 pixels
of the cursor. Values shown in the tooltip correspond to the data point nearest
the cursor's true position.

### Domain Examples

#### 1: Happy Path -- Hover at 150% DPI

Raj moves his cursor to a point on the Tokens/s chart at 150% DPI scaling. The
crosshair line is directly under his cursor. The tooltip shows "527 tok/s" and
"12s ago" positioned 8 pixels to the right and 8 pixels above his cursor.

#### 2: Edge Case -- Hover near right edge of chart

Raj hovers near the rightmost edge of the chart area. The tooltip flips to
the left side of the cursor instead of overflowing beyond the chart boundary.
The crosshair still tracks the cursor accurately.

#### 3: Error/Boundary -- Mouse leaves chart area

Raj moves his mouse off the chart canvas. The tooltip disappears immediately.
The crosshair line disappears. No stale tooltip remains visible.

### UAT Scenarios (BDD)

#### Scenario: Crosshair aligns with cursor at 150% DPI

Given Raj's Windows display scaling is set to 150%
And the aggregate chart displays token rate data
When Raj moves his mouse horizontally across the chart
Then the vertical crosshair line follows the cursor within 2 pixels horizontally

#### Scenario: Tooltip appears near cursor

Given the aggregate chart displays data
When Raj hovers over a data point showing 527 tok/s from 12 seconds ago
Then a tooltip appears within 16 pixels of the cursor position
And the tooltip displays "527 tok/s" and "12s ago"

#### Scenario: Tooltip flips near right edge

Given Raj hovers near the right edge of the chart (within 140 pixels of the edge)
When the tooltip would overflow the right boundary
Then the tooltip renders to the left of the cursor instead

#### Scenario: Tooltip and crosshair disappear on mouse leave

Given the tooltip and crosshair are visible
When Raj moves his mouse outside the chart area
Then both the tooltip and crosshair disappear within one animation frame

### Acceptance Criteria

- [ ] Crosshair vertical line is within 2 pixels of the cursor X position at 100%, 125%, and 150% DPI scaling
- [ ] Tooltip appears within 16 pixels of cursor at all DPI settings
- [ ] Tooltip value and time offset match the data point nearest the cursor
- [ ] Tooltip flips to left side when near the right edge
- [ ] Tooltip and crosshair disappear immediately when mouse exits chart

### Technical Notes

- `MouseEvent.clientX/clientY` are always in CSS pixels and should be used for tooltip positioning (already implemented via `mouseXRef`)
- uPlot's internal `cursor.left/top` values can be affected by `devicePixelRatio`; the `pxAlign` option and `u.bbox` divisor need investigation
- The gradient fill already divides `u.bbox.top` and `u.bbox.height` by `devicePixelRatio` -- the same adjustment may be needed for cursor positioning
- uPlot cursor configuration `pxAlign: 0` was set but its interaction with DPI scaling needs verification
- The tooltip uses CSS `position: fixed` with `clientX/clientY` which should be DPI-independent; if still offset, the issue is in uPlot's cursor index resolution (wrong data point) rather than tooltip placement
- Alternative root causes beyond DPI: Tauri webview coordinate offset, CSS transforms on ancestor elements, or iframe nesting -- investigation belongs in DESIGN wave

### Dependencies

- None (standalone fix)

---

## US-PMR-03: Functional Time Window Selection

### Problem

Raj Patel wants to compare his current token burn rate against the last 15
minutes of activity. He clicks the "15m" button in the Performance Monitor
header. The button visually highlights but the chart continues showing the same
60 data points (1-minute window). The `multiWindowSampler` domain module with
1m/5m/15m/session buffers exists and is tested, but it is not connected to the
`multiSessionStore` that feeds the charts.

### Who

- Developer reviewing session trends | Comparing current vs historical burn rate | Wants to zoom out to longer time ranges without losing current high-resolution data

### Solution

Each time window button (1m, 5m, 15m, Session) switches the chart to display
data from the corresponding time-resolution buffer. The `multiWindowSampler`
is integrated into the data pipeline so all four windows accumulate data at
their respective sample intervals.

### Domain Examples

#### 1: Happy Path -- Switch to 5-minute window

Raj has been running sessions for 6 minutes. He clicks "5m". The chart now
shows approximately 600 data points spanning 5 minutes at 500ms sample
intervals. The burn rate trend over the last 5 minutes is clearly visible.

#### 2: Edge Case -- Session shorter than selected window

Raj clicks "15m" but his session has only been active for 3 minutes. The chart
shows the available 3 minutes of data. The chart does not pad with zeros or
show misleading empty space.

#### 3: Error/Boundary -- Switch back to 1m preserves resolution

Raj switches from 5m to 1m. The chart returns to high-resolution 1-minute
data (600 points at 100ms intervals). No data is lost from the 1m buffer
while Raj was viewing the 5m window.

### UAT Scenarios (BDD)

#### Scenario: 5-minute window shows wider data range

Given Raj is viewing the 1-minute token rate chart
And the session has been active for 6 minutes
When Raj clicks the "5m" time window button
Then the chart displays approximately 5 minutes of historical data
And the duration label below the chart reads "5 minutes"

#### Scenario: 15-minute window with 3 minutes of data

Given Raj's session has been active for only 3 minutes
When Raj clicks the "15m" time window button
Then the chart displays the available 3 minutes of data
And no misleading empty gaps appear in the chart

#### Scenario: Session window shows full duration

Given Raj's session has been active for 45 minutes
When Raj clicks the "Session" button
Then the chart displays the full 45-minute history
And the duration label reads "Full session"

#### Scenario: Returning to 1m preserves resolution

Given Raj has switched to the 5-minute time window
When Raj clicks the "1m" button
Then the chart returns to the 1-minute high-resolution view
And the data has the same density as before the switch

### Acceptance Criteria

- [ ] Clicking a time window button changes the data buffer displayed in the chart (not just the button highlight)
- [ ] 1m window shows ~600 points at 100ms intervals
- [ ] 5m window shows ~600 points at 500ms intervals
- [ ] 15m window shows ~900 points at 1000ms intervals
- [ ] Session window dynamically adjusts sample interval based on session duration
- [ ] All four windows accumulate data independently and concurrently
- [ ] Duration label updates to match the selected window

### Technical Notes

- `multiWindowSampler.ts` contains complete, tested domain logic for multi-window buffering with `TIME_WINDOW_PRESETS` defining intervals and capacities
- `multiSessionStore.ts` currently uses a single `DEFAULT_BUFFER_CAPACITY = 60` ring buffer per category per session -- this needs to be replaced or augmented with `MultiWindowBuffer` from `multiWindowSampler`
- `PMDetailPane` currently passes `aggregateBuffer.samples` directly to `PMChart` regardless of `selectedWindow` -- it needs to select the buffer matching `selectedWindow`
- The `resolveSessionWindowConfig()` function handles dynamic session-length window configuration

### Dependencies

- US-PMR-01 (charts must render data before time windows can meaningfully switch what data is shown)

# Journey Visual: Plugin Architecture and Layout Engine

## Journey Overview

```
[Trigger: Norbert launches]
    |
    v
[Step 1: Plugin Load]     [Step 2: Layout Restore]     [Step 3: Workspace Arrange]
Load plugins, resolve  --> Restore saved layout     --> User arranges zones,
dependencies, register     (zones, divider, floats)     assigns views, resizes
views in layout engine
    |                          |                            |
Feels: Confident           Feels: Recognized            Feels: In control
(everything loaded)        (my workspace is back)       (tool adapts to me)
    |                          |                            |
Artifacts:                 Artifacts:                   Artifacts:
  plugin-registry            layout.json                  layout.json (updated)
  sidebar.json               sidebar.json                 zone-assignments
                                                          divider-positions
    |
    v
[Step 4: Multi-Window]    [Step 5: Sidebar Customize]  [Step 6: Persist & Preset]
Open additional windows -> Right-click sidebar icons -> Save layout, name presets,
with independent layouts   to show/hide/reorder         switch between presets
    |                          |                            |
Feels: Powerful            Feels: Curated              Feels: Prepared
(scales with workload)     (sidebar is mine)           (ready for next session)
    |                          |                            |
Artifacts:                 Artifacts:                   Artifacts:
  layout-{window-id}.json    sidebar.json (updated)      layout.json (final)
  window-labels                                           preset-registry
```

## Emotional Arc

```
Confident -----> Recognized -----> In Control -----> Powerful -----> Curated -----> Prepared
   |                |                  |                |               |               |
  Step 1           Step 2            Step 3           Step 4          Step 5          Step 6
  Plugins load     Layout restores   Workspace        Multi-window    Sidebar         Presets saved
  cleanly          exactly           arranged          opens           customized      for tomorrow
```

**Arc Pattern**: Confidence Building
- Start: Confident (plugins load, dependencies resolve, no silent failures)
- Middle: In Control (workspace bends to user's will via drag, right-click, keyboard)
- End: Prepared (layout persists, presets named, ready to resume instantly)

---

## Step 1: Plugin Load and Registration

### Flow
```
┌─────────────────────────────────────────────────────────────┐
│                    Norbert Startup                           │
│                                                             │
│  Scanning plugins...                                        │
│  ✓ norbert-session v1.0.0 loaded                           │
│    → Registered view: Session List (primaryView)            │
│    → Registered view: Session Detail                        │
│    → Registered hook processor: session-events              │
│                                                             │
│  Dependencies resolved:                                     │
│  ✓ norbert-session: no dependencies                        │
│                                                             │
│  Plugin load complete. 1 plugin, 2 views registered.       │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Warning (when applicable)
```
┌─────────────────────────────────────────────────────────────┐
│                    Norbert Startup                           │
│                                                             │
│  Scanning plugins...                                        │
│  ✓ norbert-session v1.0.0 loaded                           │
│  ⚠ norbert-usage v1.0.0 loaded with warnings:             │
│    → norbert-notif is disabled. Notification delivery       │
│      will not be available. [Re-enable] [Dismiss]           │
│                                                             │
│  ✗ norbert-cc-plugin-nwave v1.0.0 FAILED:                 │
│    → Requires norbert-agents@>=1.0 (not installed)         │
│    → Requires norbert-archaeology@>=1.0 (not installed)    │
│    [Install Missing] [Show Details] [Skip]                  │
│                                                             │
│  Plugin load complete. 1 loaded, 1 degraded, 1 failed.    │
└─────────────────────────────────────────────────────────────┘
```

### Emotional State
- **Entry**: Anticipation -- "Will everything load cleanly?"
- **Exit (happy)**: Confident -- "All plugins loaded, views registered, ready to go"
- **Exit (degraded)**: Alert but informed -- "I know exactly what is wrong and how to fix it"

---

## Step 2: Layout Restore

### First Launch (no saved layout)
```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ Norbert                                        _ □ X             │
├──┬───────────────────────────────────────────────────────────────────┤
│  │ // main                                              ⊞           │
│⬡ │┌────────────────────────────────────────────────────────────────┐│
│  ││                                                                ││
│⏱ ││  No view assigned to Main zone.                               ││
│  ││                                                                ││
│  ││  Click a sidebar icon or press Ctrl+Shift+P to assign a view. ││
│  ││                                                                ││
│  │└────────────────────────────────────────────────────────────────┘│
│  │                                                                  │
├──┴──────────────────────────────────────────────────────────────────┤
│ ● hooks live  ● session active                    norbert v0.3.0   │
└─────────────────────────────────────────────────────────────────────┘
```

### Subsequent Launch (saved layout restored)
```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ Norbert                                        _ □ X             │
├──┬─────────────────────────────────────┬────────────────────────────┤
│  │ // main                             │ // secondary               │
│⬡ │┌─ Session List ──────────────────┐  │┌─ Session Detail ────────┐│
│  ││ tabOrder: [Session List]        │  ││ tabOrder: [Detail]      ││
│⏱ ││─────────────────────────────────│  ││─────────────────────────││
│  ││ ● claude-code-abc  2m ago       │  ││ Session: claude-code-abc││
│  ││   feat/add-plugin-loader        │  ││ Duration: 12m           ││
│  ││ ● claude-code-def  5m ago       │  ││ Events: 34              ││
│  ││   fix/layout-persistence        │  ││ Tokens: 12,450          ││
│  ││   claude-code-ghi  1h ago       │  ││                         ││
│  ││   chore/update-deps             │  ││ [Event List...]         ││
│  │└─────────────────────────────────┘  │└─────────────────────────┘│
├──┴─────────────────────────────────────┴────────────────────────────┤
│ ● hooks live  3 mcp                               norbert v0.3.0   │
└─────────────────────────────────────────────────────────────────────┘
```

### Emotional State
- **Entry**: Expectation -- "Will my layout be there?"
- **Exit (restored)**: Recognized -- "Norbert remembers me. Ready to work."
- **Exit (first launch)**: Guided -- "Clear what to do next. Not lost."

---

## Step 3: Workspace Arrangement

### Right-Click Context Menu on Sidebar Icon
```
┌──────────────────────────────┐
│ Open Session List            │
│──────────────────────────────│
│ Open in Main Panel           │
│ Open in Secondary Panel      │
│ Open in New Window           │
│ Open as Floating Panel       │
└──────────────────────────────┘
```

### Right-Click Context Menu on Sidebar (visibility toggle)
```
┌──────────────────────────────┐
│ Open Sessions                │
│──────────────────────────────│
│ Hide Sessions                │
│──────────────────────────────│
│ ⬡  Dashboard          ✓     │
│ ⏱  Sessions           ✓     │
│ 🤖  Agents             ✓     │
│ 🔧  Tools & MCP        ✓     │
│ ⚙  Config              ✓     │
│ 🧩  Plugins            ✓     │
│──────────────────────────────│
│ Reset Sidebar                │
└──────────────────────────────┘
```

### Drag Sidebar Icon to Zone
```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ Norbert                                        _ □ X             │
├──┬─────────────────────────────────────┬────────────────────────────┤
│  │                                     │                            │
│⬡ │  ┌─────────────────────────────┐   │                            │
│  │  │ ⏱ dragging...               │   │  ╔════════════════════════╗│
│⏱◄┤  └─────────────────────────────┘   │  ║  DROP HERE             ║│
│  │                                     │  ║  Assign to Secondary   ║│
│  │   Current Main view                 │  ╚════════════════════════╝│
│  │   (stays undisturbed)               │                            │
│  │                                     │                            │
├──┴─────────────────────────────────────┴────────────────────────────┤
│ ● hooks live                                      norbert v0.3.0   │
└─────────────────────────────────────────────────────────────────────┘
```

### View Picker (Ctrl+Shift+P > "Change Secondary View")
```
┌────────────────────────────────────────┐
│ Assign view to Secondary zone          │
│ > ___________________________________  │
│                                        │
│ norbert-session                        │
│   ⏱ Session List                      │
│   ⏱ Session Detail                    │
│                                        │
│ [future plugins would appear here]     │
└────────────────────────────────────────┘
```

### Draggable Divider
```
┌──────────────────────────────────────────────────────────────────────┐
│            Main (60%)          ┃         Secondary (40%)             │
│                                ┃                                     │
│                                ┃◄── 4px draggable handle             │
│                                ┃     Double-click: snap to 50/50     │
│                                ┃     Min zone width: 280px           │
│                                ┃     Saved as percentage             │
└──────────────────────────────────────────────────────────────────────┘
```

### Floating Panel
```
┌──────────────────────────────────────────────────────────────────────┐
│ ☰ Norbert                                        _ □ X             │
├──┬───────────────────────────────────────────────────────────────────┤
│  │                                                                  │
│⬡ │   Main zone content                                             │
│  │                                                                  │
│⏱ │                    ┌─ Session List ─── ⋯ ─ × ─┐                │
│  │                    │ ● claude-code-abc         │                 │
│  │                    │ ● claude-code-def         │                 │
│  │                    │   claude-code-ghi         │                 │
│  │                    └──────────────────────────-┘                 │
│  │                    ↑ floating panel, draggable, resizable        │
│  │                    ↑ snaps to edges when dragged near            │
│  │                    ↑ ⋯ menu: Switch Mode, Open in Main, etc.    │
├──┴──────────────────────────────────────────────────────────────────┤
│ ● hooks live                                      norbert v0.3.0   │
└─────────────────────────────────────────────────────────────────────┘
```

### Minimized Floating Pill
```
                                              ┌─────────────────┐
                                              │ ⏱ Sessions  3   │
                                              └─────────────────┘
                                              ↑ minimized pill with
                                                live metric (3 active)
```

### Emotional State
- **Entry**: Purposeful -- "I know what I want to see; let me arrange it"
- **Exit**: In control -- "My workspace fits my task. Everything I need is visible."

---

## Step 4: Multi-Window

### Opening a New Window
```
Entry points:
  1. Right-click sidebar icon → "Open in New Window"
  2. Ctrl+Shift+N → new window with default layout
  3. Tray icon → "New Window"
  4. Ctrl+Shift+P → "Open New Window"
```

### Two Windows, Independent Layouts
```
Window 1 (Primary Monitor)                 Window 2 (Secondary Monitor)
┌────────────────────────────────┐         ┌────────────────────────────────┐
│ ☰ Norbert                _ □ X│         │ ☰ Norbert - Monitor 2   _ □ X│
├──┬─────────────┬──────────────-┤         ├──┬─────────────────────────────┤
│  │ Main:       │ Secondary:    │         │  │ Main:                       │
│⬡ │ Session List│ Event Detail  │         │⬡ │ Session List (full width)   │
│  │             │               │         │  │ (different session selected) │
│⏱ │ ●abc  2m   │ Session: abc  │         │⏱ │                             │
│  │ ●def  5m   │ Events: 34    │         │  │ ●ghi  1h ago               │
│  │  ghi  1h   │ Tokens: 12k   │         │  │ ●jkl  2h ago               │
├──┴─────────────┴───────────────┤         ├──┴─────────────────────────────┤
│ ● hooks live       v0.3.0     │         │ ● hooks live  "Monitor 2"     │
└────────────────────────────────┘         └────────────────────────────────┘

Both windows share same backend. Both receive live event updates via IPC.
Each has independent layout persisted as layout.json / layout-{window-id}.json.
```

### Window Labelling
```
Right-click title bar or Ctrl+Shift+P → "Label This Window"
┌──────────────────────────────────────┐
│ Label this window:                   │
│ [Monitor 2 - Sessions            ]   │
│                          [OK] [Cancel]│
└──────────────────────────────────────┘
Label appears in title bar and status bar.
```

### Emotional State
- **Entry**: Expanding -- "I need more screen real estate for monitoring"
- **Exit**: Powerful -- "Each monitor shows exactly what I need. Both updating live."

---

## Step 5: Sidebar Customization

### Drag to Reorder
```
Sidebar before:          Sidebar after drag:
┌──┐                     ┌──┐
│⬡ │ Dashboard           │⏱ │ Sessions  (moved up)
│⏱ │ Sessions            │⬡ │ Dashboard
│🤖│ Agents              │🤖│ Agents
│🔧│ Tools               │🔧│ Tools
│⚙ │ Config              │⚙ │ Config
│🧩│ Plugins             │🧩│ Plugins
└──┘                     └──┘

Drag handle visible on hover. Separator between core and plugin sections
also draggable. State persisted to ~/.norbert/sidebar.json.
```

### Emotional State
- **Entry**: Opinionated -- "I want Sessions first, not Dashboard"
- **Exit**: Curated -- "Sidebar reflects my priorities"

---

## Step 6: Layout Persistence and Presets

### Save Current Layout As Preset
```
Ctrl+Shift+L opens Layout Picker:
┌────────────────────────────────────────┐
│ Layout Presets                          │
│ > ___________________________________  │
│                                        │
│ Built-in:                              │
│   ⊞ Default         [Main: Dashboard] │
│   ⊞ Session Watch   [Main: Live Viz,  │
│                       Sec: Sessions]   │
│                                        │
│ Custom:                                │
│   ⊞ My Monitoring   [Main: Sessions,  │
│                       Sec: Events,     │
│                       Float: Cost]     │
│                                        │
│ ──────────────────────────────────     │
│ Save Current Layout As...              │
│ Reset to Default                       │
└────────────────────────────────────────┘
```

### Emotional State
- **Entry**: Satisfied with arrangement -- "This layout is perfect for debugging sessions"
- **Exit**: Prepared -- "Named and saved. Tomorrow I switch to it with one keystroke."

---

## Plugin Developer Journey (Tomasz)

### Step A: Implement NorbertPlugin Interface
```typescript
// norbert-session/src/index.ts
export const plugin: NorbertPlugin = {
  manifest: {
    id: 'norbert-session',
    name: 'Sessions',
    version: '1.0.0',
    norbert_api: '>=1.0',
    dependencies: {},
  },
  async onLoad(api: NorbertAPI) {
    // Register views
    api.ui.registerView({
      id: 'session-list',
      label: 'Session List',
      icon: '⏱',
      component: SessionListView,
      primaryView: true,
      tabOrder: 0,
      minWidth: 280,
      minHeight: 200,
      floatMetric: 'active_session_count',
    });

    // Register hook processor
    api.hooks.register('session-events', handleSessionEvent);

    // Register sidebar tab
    api.ui.registerTab({
      id: 'sessions',
      icon: '⏱',
      label: 'Sessions',
      order: 1,
    });
  },
  async onUnload() {
    // cleanup
  },
};
```

### Step B: View Appears in Layout Engine
```
After plugin loads:
  - Sidebar shows ⏱ Sessions icon
  - View picker includes "norbert-session > Session List"
  - Right-click context menu works on sidebar icon
  - Drag-from-sidebar works
  - Floating panel minimizes to pill showing "⏱ Sessions  3"
```

### Step C: Plugin Validates Zone Abstraction
```
norbert-session's Session List view is:
  ✓ Assignable to Main zone
  ✓ Assignable to Secondary zone
  ✓ Openable as floating panel
  ✓ Openable in new window
  ✓ Switchable via right-click context menu
  ✓ Assignable via drag-and-drop
  ✓ Assignable via view picker
  ✓ Persisted in layout.json
  ✓ Restored on restart

If any of these fail, the API is insufficient — refine before Phase 4.
```

### Emotional State (Tomasz)
- **Entry**: Curious -- "Will this API actually work for a real plugin?"
- **Exit**: Confident -- "It works. I can build on this."

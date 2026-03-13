# Component Boundaries: Plugin Architecture and Layout Engine (Phase 3)

## Overview

Phase 3 introduces 5 component boundaries into the existing modular monolith. Each boundary has a clear owner, defined ports, and explicit data flow.

```
                    ┌─────────────────────────────────────────┐
                    │            Norbert Core                   │
                    │                                           │
                    │  ┌──────────────┐  ┌──────────────────┐  │
                    │  │ Plugin Host  │  │ Multi-Window Mgr │  │
                    │  │              │  │                  │  │
                    │  │ Loader       │  │ Window Factory   │  │
                    │  │ Dep Resolver │  │ IPC Router       │  │
                    │  │ API Factory  │  │ State Manager    │  │
                    │  │ Sandbox      │  │                  │  │
                    │  │ Registry     │  │                  │  │
                    │  │ Lifecycle    │  │                  │  │
                    │  └──────┬───────┘  └────────┬─────────┘  │
                    │         │                    │             │
                    │  ┌──────▼────────────────────▼──────────┐ │
                    │  │         Layout Engine (per-window)    │ │
                    │  │                                       │ │
                    │  │  Zone Registry  │  Assignment Engine  │ │
                    │  │  Zone Renderer  │  Divider Manager    │ │
                    │  │  Float Manager  │  Layout Persistor   │ │
                    │  └──────┬────────────────────────────────┘ │
                    │         │                                   │
                    │  ┌──────▼──────┐                           │
                    │  │ Sidebar Mgr │                           │
                    │  │             │                           │
                    │  │ Renderer    │                           │
                    │  │ Visibility  │                           │
                    │  │ Order       │                           │
                    │  │ Persistor   │                           │
                    │  └─────────────┘                           │
                    └─────────────────────────────────────────────┘
                                        │
                    ┌───────────────────▼──────────────────────┐
                    │        norbert-session (Plugin)           │
                    │                                           │
                    │  Plugin Entry  │  Session List View       │
                    │                │  Session Detail View     │
                    │                │  Hook Processor          │
                    └───────────────────────────────────────────┘
```

---

## Boundary 1: Plugin Host

### Owner
Norbert Core (backend)

### Responsibility
Load, validate, resolve, sandbox, and manage plugin lifecycle.

### Ports (Driving -- Inbound)
- **PluginLoader port**: Scan filesystem for installed plugin packages
- **LifecycleManager port**: Start/stop plugins, handle runtime enable/disable

### Ports (Driven -- Outbound)
- **NorbertAPI**: The contract exposed to each plugin (db, hooks, ui, mcp, events, config, plugins)
- **PluginStore**: Read/write plugin enabled/disabled state to plugins.json

### Data Contracts
- **Input**: Plugin npm packages with NorbertPlugin exports
- **Output**: Populated PluginRegistry (views, tabs, hooks, MCP tools)

### Integration Points
- Layout Engine: receives ViewRegistration records from Plugin Registry
- Sidebar Manager: receives TabRegistration records from Plugin Registry
- SQLite: Plugin db access scoped to `plugin_{id}_*` namespace

### Invariants
- Plugins load in topological dependency order
- Missing dependencies prevent load (hard failure with actionable message)
- Disabled dependencies produce degradation warnings (not failures)
- Version mismatches are hard failures
- No plugin can write to core SQLite tables

---

## Boundary 2: Layout Engine

### Owner
Norbert Core (frontend, per-window instance)

### Responsibility
Zone model, view assignment, divider management, floating panels, persistence.

### Ports (Driving -- Inbound)
- **ViewAssignment port**: Assign/unassign views to zones (from 4 mechanisms)
- **DividerControl port**: Drag resize, double-click snap
- **FloatingPanelControl port**: Open/close/minimize/restore floating panels
- **PresetControl port**: Save/load/delete named presets

### Ports (Driven -- Outbound)
- **LayoutPersistence port**: Read/write layout.json (or layout-{window-id}.json)
- **PluginRegistry port**: Query registered views for validation and picker population

### Data Contracts
- **LayoutState**: `{ zones: Map<zoneName, {viewId, pluginId}>, dividerPosition: number, floatingPanels: [{viewId, position, size, minimized}] }`
- **PresetState**: `{ name, zones, dividerPosition, floatingPanels, builtIn }`

### Integration Points
- Plugin Host: reads ViewRegistration to validate zone assignments
- Sidebar Manager: sidebar click triggers view assignment
- Multi-Window Manager: each window has independent Layout Engine instance
- Config Store: reads/writes layout JSON files

### Invariants
- Zone registry is a named map, never positional
- Zones accept any registered view ID (zone-count-agnostic)
- Main zone always present, always hosts exactly one view
- Secondary zone is optional, toggleable
- Minimum zone width 280px enforced at render time
- Divider position stored as ratio 0.0-1.0
- All 4 assignment mechanisms produce identical zone state
- Layout auto-saves on every change (debounced)
- Missing view IDs (uninstalled plugin) show graceful empty state

---

## Boundary 3: Multi-Window Manager

### Owner
Norbert Core (backend -- Tauri)

### Responsibility
Window creation, destruction, IPC routing, per-window layout file management.

### Ports (Driving -- Inbound)
- **WindowCreate port**: Open new window (from right-click, Ctrl+Shift+N, tray, command palette)
- **WindowClose port**: Close window, handle last-window-close logic
- **WindowLabel port**: Set/get user-assigned window labels

### Ports (Driven -- Outbound)
- **TauriWindow port**: Create/destroy Tauri webview windows
- **IPCBroadcast port**: Emit events to all window subscribers
- **WindowStatePersistence port**: Read/write open window set for restart restore

### Data Contracts
- **WindowState**: `{ windowId, label, layoutFile, position, size }`

### Integration Points
- Layout Engine: each window gets independent Layout Engine instance
- Hook Receiver: events propagated to all windows via IPC
- Config Store: per-window layout files

### Invariants
- Single backend process regardless of window count
- Each window subscribes to backend events independently via Tauri IPC
- Closing one window does not affect others
- Last window closing keeps backend alive in tray mode
- All previously open windows reopen on restart with saved layouts
- Backend process count always 1

---

## Boundary 4: Sidebar Manager

### Owner
Norbert Core (frontend)

### Responsibility
Sidebar icon rendering, visibility, ordering, persistence.

### Ports (Driving -- Inbound)
- **VisibilityToggle port**: Show/hide sidebar icons via right-click toggle
- **Reorder port**: Drag-to-reorder icons
- **Reset port**: Restore default visibility and order

### Ports (Driven -- Outbound)
- **SidebarPersistence port**: Read/write sidebar.json
- **PluginRegistry port**: Query registered tabs from plugins
- **CommandPalette port**: Register hidden-section access commands

### Data Contracts
- **SidebarState**: Ordered array of `{ id, visible }` entries

### Integration Points
- Plugin Host: receives TabRegistration records
- Layout Engine: sidebar click triggers view assignment via Assignment Engine
- Command Palette: hidden sections accessible via Ctrl+Shift+P

### Invariants
- Hidden icons still accessible via command palette
- Newly installed plugins append to end without disrupting existing order
- "Reset Sidebar" restores default order and visibility
- Bottom-pinned items always remain at bottom
- Drag works for both core sections and plugin sections

---

## Boundary 5: norbert-session Plugin

### Owner
First-party plugin (loaded via standard plugin loader)

### Responsibility
Migrate Phase 2 session list into plugin architecture. Validate NorbertAPI sufficiency.

### Ports (Driving -- Inbound)
- **NorbertPlugin interface**: onLoad(api), onUnload()

### Ports (Driven -- Outbound)
- **api.ui.registerView()**: Register Session List and Session Detail views
- **api.ui.registerTab()**: Register Sessions sidebar icon
- **api.hooks.register()**: Register session event handler
- **api.db**: Read session/event data (read-only on core tables)

### Data Contracts
- **ViewRegistration**: `{ id: 'session-list', label: 'Session List', icon, component, primaryView: true, minWidth: 280, minHeight: 200, floatMetric: 'active_session_count' }`

### Integration Points
- Uses ONLY public NorbertAPI (no internal Norbert imports)
- Views assignable to any zone, floating panel, or new window
- Friction log feeds back into API refinement

### Invariants
- All Phase 2 session list functionality preserved (no regression)
- Plugin uses zero internal Norbert APIs
- Session List works in Main, Secondary, floating panel, and new window
- floatMetric updates live in minimized pill

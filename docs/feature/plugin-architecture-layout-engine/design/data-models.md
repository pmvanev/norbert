# Data Models: Plugin Architecture and Layout Engine (Phase 3)

## Persistence Files

All files stored in `~/.norbert/` (platform data directory).

---

### layout.json (Primary Window)

```json
{
  "version": 1,
  "zones": {
    "main": {
      "viewId": "session-list",
      "pluginId": "norbert-session"
    },
    "secondary": {
      "viewId": "session-detail",
      "pluginId": "norbert-session"
    }
  },
  "dividerPosition": 0.6,
  "secondaryVisible": true,
  "floatingPanels": [
    {
      "viewId": "session-list",
      "pluginId": "norbert-session",
      "position": { "x": 800, "y": 400 },
      "size": { "width": 320, "height": 240 },
      "minimized": false
    }
  ],
  "presets": {
    "default": {
      "name": "Default",
      "builtIn": true,
      "zones": {
        "main": { "viewId": null, "pluginId": null }
      },
      "dividerPosition": 0.5,
      "secondaryVisible": false,
      "floatingPanels": []
    },
    "session-watch": {
      "name": "Session Watch",
      "builtIn": true,
      "zones": {
        "main": { "viewId": "session-list", "pluginId": "norbert-session" },
        "secondary": { "viewId": "session-detail", "pluginId": "norbert-session" }
      },
      "dividerPosition": 0.5,
      "secondaryVisible": true,
      "floatingPanels": []
    }
  }
}
```

**Design notes**:
- `zones` is a keyed map, not positional fields -- adding a `"bottom"` zone extends naturally
- `dividerPosition` is a ratio (0.0-1.0) for resolution independence
- `presets` stored in same file for atomic access
- `version` field enables future schema migration

---

### layout-{window-id}.json (Additional Windows)

Same schema as `layout.json` minus the `presets` key (presets are global, not per-window).

```json
{
  "version": 1,
  "windowId": "window-2",
  "label": "Monitor 2 - Sessions",
  "zones": {
    "main": {
      "viewId": "session-list",
      "pluginId": "norbert-session"
    }
  },
  "dividerPosition": 0.5,
  "secondaryVisible": false,
  "floatingPanels": []
}
```

---

### sidebar.json

```json
{
  "version": 1,
  "items": [
    { "id": "dashboard", "visible": true },
    { "id": "sessions", "visible": true },
    { "id": "agents", "visible": true },
    { "id": "tools-mcp", "visible": true },
    { "id": "config", "visible": true },
    { "id": "plugins", "visible": true }
  ]
}
```

**Design notes**:
- Ordered array -- position in array determines render order
- Newly installed plugins appended at end
- Bottom-pinned items (notifications, settings) managed separately from this list

---

### plugins.json

```json
{
  "version": 1,
  "plugins": {
    "norbert-session": {
      "enabled": true,
      "version": "1.0.0"
    }
  }
}
```

---

### windows.json

```json
{
  "version": 1,
  "windows": [
    {
      "id": "main",
      "layoutFile": "layout.json",
      "position": { "x": 100, "y": 100 },
      "size": { "width": 1200, "height": 800 }
    },
    {
      "id": "window-2",
      "layoutFile": "layout-window-2.json",
      "label": "Monitor 2 - Sessions",
      "position": { "x": 1400, "y": 100 },
      "size": { "width": 800, "height": 600 }
    }
  ]
}
```

---

## In-Memory Data Models

### Plugin Registry

```
PluginRegistry {
  plugins: Map<pluginId, LoadedPlugin>
  views: Map<viewId, ViewRegistration>
  tabs: Map<tabId, TabRegistration>
  hookProcessors: Map<processorId, HookProcessor>
}

LoadedPlugin {
  manifest: PluginManifest
  status: 'loaded' | 'degraded' | 'failed' | 'disabled'
  publicAPI: unknown  // plugin's exported API for inter-plugin use
  warnings: DegradationWarning[]
}

ViewRegistration {
  id: string
  pluginId: string
  label: string
  icon: string
  component: ReactComponent
  primaryView: boolean
  tabOrder: number
  minWidth: number
  minHeight: number
  floatMetric: string | null
}

TabRegistration {
  id: string
  pluginId: string
  icon: string
  label: string
  order: number
}
```

### Zone State

```
ZoneRegistry {
  zones: Map<zoneName, ZoneState>
}

ZoneState {
  viewId: string | null
  pluginId: string | null
  visible: boolean
}
```

### Dependency Graph

```
DependencyGraph {
  nodes: Map<pluginId, PluginManifest>
  edges: Map<pluginId, Set<pluginId>>  // plugin -> its dependencies
  loadOrder: pluginId[]  // topological sort result
  resolutionErrors: ResolutionError[]
}

ResolutionError {
  pluginId: string
  type: 'missing' | 'version_mismatch' | 'disabled'
  dependency: string
  requiredVersion: string
  installedVersion: string | null
}
```

---

## SQLite Schema Extensions

### Plugin Namespace Tables

Plugins create tables with prefix `plugin_{pluginId}_`. Example for norbert-session:

```sql
-- Created by norbert-session plugin via api.db
CREATE TABLE IF NOT EXISTS plugin_norbert_session_custom_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    data TEXT NOT NULL
);
```

### Core Tables (Unchanged)

The existing `sessions` and `events` tables (from Phase 2) remain unchanged. Plugins have read-only access to these via `api.db`.

---

## Validation Rules

| Rule | Enforcement Point |
|---|---|
| Zone assignment viewId must exist in ViewRegistration | Layout Persistor restore, Assignment Engine |
| Preset zone keys must be valid zone names | Preset save, preset load |
| Sidebar item ids must reference registered tabs or core sections | Sidebar Persistor restore |
| Plugin namespace prefix enforced on all db writes | Sandbox Enforcer |
| Divider position must be 0.0-1.0 | Divider Manager, Layout Persistor |
| floatMetric must be a registered metric key | Floating Panel Manager |
| Window IDs must be stable across restarts | Window State Manager |

# Shared Artifacts Registry: Plugin Architecture and Layout Engine

## Artifact Registry

### plugin_registry

| Field | Value |
|-------|-------|
| **Source of truth** | NorbertAPI plugin loader scan results (in-memory at startup) |
| **Consumers** | Startup log, sidebar icon registration, view picker plugin grouping, status bar plugin names, dependency resolution warnings |
| **Owner** | Core Norbert plugin loader |
| **Integration risk** | HIGH -- if plugin registry and view picker disagree on registered views, users see phantom or missing views |
| **Validation** | Every view ID in the view picker must correspond to a registered view in the plugin registry. Count of sidebar icons must equal count of plugins with registerTab() calls. |

### dependency_graph

| Field | Value |
|-------|-------|
| **Source of truth** | Plugin manifest `dependencies` declarations, resolved at load time |
| **Consumers** | Startup dependency warnings, plugin settings page, greyed-out placeholders for suppressed features, install-time resolution dialog |
| **Owner** | Core Norbert dependency resolver |
| **Integration risk** | HIGH -- incorrect dependency resolution leads to silent feature failures or false error messages |
| **Validation** | Every dependency warning must name the specific plugin and affected feature. Version mismatch must be a hard failure, not a warning. |

### layout_state

| Field | Value |
|-------|-------|
| **Source of truth** | `~/.norbert/layout.json` (primary window), `~/.norbert/layout-{window-id}.json` (additional windows) |
| **Consumers** | Main zone view assignment, Secondary zone view assignment, floating panel positions/sizes, divider percentage, Layout Picker preset display |
| **Owner** | Layout engine |
| **Integration risk** | HIGH -- if layout.json references a view ID that no longer exists (plugin uninstalled), zone must show graceful empty state, not crash |
| **Validation** | All view IDs in layout.json must be validated against current plugin_registry at restore time. Divider percentage must produce valid pixel widths at current window size. |

### sidebar_state

| Field | Value |
|-------|-------|
| **Source of truth** | `~/.norbert/sidebar.json` |
| **Consumers** | Sidebar icon rendering order, right-click context menu checkmarks, command palette (hidden sections still accessible) |
| **Owner** | Sidebar manager |
| **Integration risk** | MEDIUM -- if sidebar.json references a plugin ID that is no longer installed, the entry must be silently skipped (not error) |
| **Validation** | Sidebar.json must include all currently-registered plugin tabs. Newly installed plugins must appear at end if not already in the file. Hidden plugins must still be accessible via Ctrl+Shift+P. |

### zone_assignments

| Field | Value |
|-------|-------|
| **Source of truth** | Layout engine in-memory state (auto-saved to layout.json) |
| **Consumers** | Main zone renderer, Secondary zone renderer, floating panel renderer, zone header labels, layout.json persistence, Layout Picker thumbnails |
| **Owner** | Layout engine |
| **Integration risk** | HIGH -- zone assignments must be stored as a keyed map (not positional), so adding new zone names in future does not break existing data |
| **Validation** | Zone assignment map keys must be zone names from the zone registry. Values must be valid view IDs from the plugin registry. |

### divider_position

| Field | Value |
|-------|-------|
| **Source of truth** | Layout engine in-memory state (auto-saved to layout.json) |
| **Consumers** | Zone width calculation, layout.json persistence, window resize recalculation |
| **Owner** | Layout engine |
| **Integration risk** | MEDIUM -- percentage must map to valid pixel widths. If window is resized smaller than 2x minimum zone width (560px), divider must enforce minimums. |
| **Validation** | Divider position stored as percentage (0.0-1.0). Minimum zone width 280px enforced at render time. Double-click resets to 0.5. |

### window_layout

| Field | Value |
|-------|-------|
| **Source of truth** | `~/.norbert/layout-{window-id}.json` per additional window |
| **Consumers** | Window-specific zone rendering, window restore on next launch |
| **Owner** | Layout engine (per-window instance) |
| **Integration risk** | MEDIUM -- window IDs must be stable across restarts. If a layout file references window ID that no longer exists, it must be cleaned up. |
| **Validation** | Each window layout file uses the same schema as primary layout.json. Window IDs are deterministic (not random) for persistence stability. |

### window_label

| Field | Value |
|-------|-------|
| **Source of truth** | User input via title bar right-click or Ctrl+Shift+P > "Label This Window" |
| **Consumers** | Window title bar, status bar right-aligned items |
| **Owner** | Window manager |
| **Integration risk** | LOW -- purely cosmetic. Empty label falls back to "Norbert" + window number. |
| **Validation** | Label persisted in window layout file. Displayed in both title bar and status bar. |

### preset_registry

| Field | Value |
|-------|-------|
| **Source of truth** | `~/.norbert/layout.json` presets section |
| **Consumers** | Layout Picker (Ctrl+Shift+L), command palette preset commands |
| **Owner** | Layout engine |
| **Integration risk** | MEDIUM -- presets may reference view IDs from uninstalled plugins. Preset application must handle missing views gracefully. |
| **Validation** | Built-in presets always present, not deletable. Custom presets can be created, renamed, deleted. Preset zone map uses same keyed format as layout state. |

---

## Integration Checkpoints

### Checkpoint 1: Plugin Registry to View Picker Consistency
- **Between steps**: 1 (Plugin Load) and 3 (Workspace Arrangement)
- **Check**: Every view registered in step 1 appears in the view picker in step 3
- **Failure mode**: View picker shows outdated or phantom entries
- **Test**: Register a view via api.ui.registerView(), verify it appears in Ctrl+Shift+P view picker immediately

### Checkpoint 2: Layout Save to Layout Restore Roundtrip
- **Between steps**: 3/6 (Arrangement/Presets) and 2 (Restore)
- **Check**: layout.json written in step 3/6 produces identical layout when read in step 2
- **Failure mode**: Divider position drifts, zone assignments swap, floating panel positions shift
- **Test**: Arrange layout, save, restart Norbert, verify pixel-perfect restore

### Checkpoint 3: Zone Assignment Consistency Across Mechanisms
- **Within step**: 3 (Workspace Arrangement)
- **Check**: All four assignment mechanisms (right-click, drag, picker, preset) produce identical zone state
- **Failure mode**: Drag assigns to wrong zone, picker assigns view but does not show Secondary
- **Test**: Assign same view to same zone via each mechanism, verify layout.json is identical each time

### Checkpoint 4: Multi-Window Event Propagation
- **Between steps**: 4 (Multi-Window) and all zones
- **Check**: Hook event arriving at backend is delivered to all open windows via IPC
- **Failure mode**: One window updates, other does not, or significant delay between updates
- **Test**: Open two windows showing same session, fire hook event, verify both update within 100ms

### Checkpoint 5: Sidebar State to Command Palette Consistency
- **Between steps**: 5 (Sidebar Customization) and all navigation
- **Check**: Hidden sidebar items remain accessible via Ctrl+Shift+P
- **Failure mode**: Hidden plugin becomes completely unreachable
- **Test**: Hide a sidebar icon, verify Ctrl+Shift+P > "Open [Section]" still works

### Checkpoint 6: Zone Abstraction Future-Proofing
- **Cross-cutting**: All steps
- **Check**: No hardcoded references to "main" or "secondary" in plugin API, view registration, or persistence schema
- **Failure mode**: Adding a "bottom" zone requires changes to plugin manifests or api.ui.registerView() signature
- **Test**: Grep plugin API surface for hardcoded zone names. Layout.json must use zone name as map key, not positional field.

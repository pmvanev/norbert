# Walking Skeleton Strategy: Plugin Architecture and Layout Engine

## Implementation Sequence

The walking skeletons should be implemented in this order. Each skeleton
validates a distinct value proposition and informs the focused scenarios
that follow.

### Skeleton 1: Plugin registers a view and user can access it

**File**: `tests/acceptance/plugin-architecture-layout-engine/plugin-api-contract.test.ts`
**Story**: US-001 (NorbertAPI Contract)
**Milestone**: M1 -- Plugin Host functional

**User goal**: A plugin developer builds an extension, and users can see and interact with it.

**Thin vertical slice**:
- Plugin Loader scans and finds the plugin
- NorbertAPI Factory creates API instance
- Plugin calls api.ui.registerView()
- View appears in sidebar and view picker
- Clicking sidebar icon assigns view to Main zone

**Implementation order after skeleton**:
1. Enable skeleton test (remove .skip)
2. Implement PluginLoader, NorbertAPI Factory, Plugin Registry (inner TDD loop)
3. Skeleton passes = M1 done
4. Enable focused scenarios one at a time (sandbox, hooks, status bar, etc.)

### Skeleton 2: User arranges workspace and arrangement survives restart

**File**: `tests/acceptance/plugin-architecture-layout-engine/layout-persistence-presets.test.ts`
**Story**: US-008 (Layout Persistence)
**Milestone**: M2 -- Layout Engine + Persistence functional

**User goal**: A user arranges their workspace once, and it persists forever.

**Thin vertical slice**:
- Zone Registry manages Main + Secondary zones
- View Assignment Engine assigns views to zones
- Divider Manager sets divider position
- Layout Persistor auto-saves to layout.json
- On restart, Persistor restores layout from file
- User sees identical workspace

**Implementation order after skeleton**:
1. Enable skeleton test
2. Implement Zone Registry, Assignment Engine, Divider Manager, Persistor
3. Skeleton passes = M2 done
4. Enable US-003, US-004, US-005, US-008 focused scenarios one at a time

### Skeleton 3: norbert-session works across all placement targets

**File**: `tests/acceptance/plugin-architecture-layout-engine/norbert-session-migration.test.ts`
**Story**: US-009 (norbert-session Migration)
**Milestone**: M3 -- Full integration validated

**User goal**: The session list works everywhere -- Main, Secondary, floating panel, new window.

**Thin vertical slice**:
- norbert-session implements NorbertPlugin interface
- Loads via standard plugin loader
- Session List assignable to all targets
- Floating panel with pill metric works
- New window with live updates works

**Implementation order after skeleton**:
1. Enable skeleton test (requires M1 + M2 + US-005 + US-006 done)
2. Implement norbert-session plugin migration
3. Skeleton passes = M3 done, Phase 3 feature validated
4. Enable remaining focused scenarios

## Milestone Dependency Graph

```
M1 (Plugin Host)
  |
  v
M2 (Layout Engine + Persistence)
  |
  +--> US-005 (Floating Panels)
  +--> US-006 (Multi-Window)
  +--> US-007 (Sidebar Customization)
  |
  v
M3 (norbert-session -- full integration)
```

## One-at-a-Time Implementation Tags

All scenarios use `it.skip()`. The software crafter should:
1. Remove `.skip` from the walking skeleton test
2. Implement until it passes (inner TDD loop)
3. Commit
4. Remove `.skip` from the next focused scenario
5. Repeat

Never have more than one failing acceptance test at a time.

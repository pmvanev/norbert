# Plugin Architecture & Layout Engine — Evolution Record

**Feature ID**: plugin-architecture-layout-engine
**Delivery Date**: 2026-03-13
**Paradigm**: Functional (TypeScript + React)
**Rigor**: Thorough (opus agent, sonnet reviewer, double review, full TDD)

## Summary

Introduced the plugin architecture with NorbertAPI contract, flexible zone-based layout engine, multi-window support, sidebar customization, and validated the design by migrating the session viewer into norbert-session as the first first-party plugin.

## Phases Delivered

| Phase | Steps | Scope |
|-------|-------|-------|
| 01 — Plugin Host | 7 steps | Types, loader, registry, API factory, sandbox, hooks, dependencies |
| 02 — Layout Engine | 6 steps | Zone types/registry, persistence, toggle/divider, assignment, floating panels, presets |
| 03 — Multi-Window | 2 steps | Window factory, IPC router, per-window layout persistence |
| 04 — Sidebar | 1 step | Visibility, reorder, persistence |
| 05 — norbert-session | 3 steps | Plugin entry, placement targets, App.tsx integration |

**Total**: 19 steps, all 5/5 TDD phases PASS.

## Key Architecture Decisions

- **Zone abstraction is count-agnostic**: `ReadonlyMap<string, ZoneState>` — adding zones requires only layout engine changes, not plugin API changes
- **Plugin API uses dependency injection**: `CreateNorbertAPI` factory injected into lifecycle manager, not imported directly
- **Effects boundaries**: hookBridge and lifecycleManager are the only modules with side effects; all layout/sidebar/registry modules are pure functions
- **Stable React rendering**: View wrappers use refs to prevent unmount/remount on poll cycles

## Review Findings (Deferred)

| ID | Severity | Description | Reason Deferred |
|----|----------|-------------|-----------------|
| S1 | HIGH | SQL sandbox regex bypass vectors | Needs proper SQL parser — future phase when DB access is implemented |
| A4 | MEDIUM | hookBridge module-level mutable singleton | Works correctly; refactor to factory when multi-tenant needed |
| A1 | LOW | Stub sub-APIs (McpAPI, EventsAPI, ConfigAPI) | Intentionally incomplete — implemented when features land |
| I1 | MEDIUM | Sidebar/Tab registration sync gap | Current code uses views for sidebar (correct); tabs sync needed when multiple plugins exist |

## Files Added

- `src/plugins/` — 11 modules (types, loader, registry, API factory, sandbox, hooks, dependencies, lifecycle, norbert-session/*)
- `src/layout/` — 13 modules (types, registry, toggle, divider, renderer, assignment, context menu, drag-drop, view picker, floating panels, presets, persistence, pill minimize)
- `src/multiWindow/` — 3 modules (window factory, IPC router, window state manager)
- `src/sidebar/` — 3 modules (types, manager, persistor)

## Test Coverage

- 85 acceptance scenarios across 9 test files
- ~200 unit tests (post-theater cleanup)
- 14 smoke tests (DOM structure + CSS chain)
- All tests green (excluding pre-existing hook-receiver and plugin-install-split failures)

## Post-Delivery Fixes

- v0.3.1: Added sidebar with plugin icons, fixed status bar anchoring, fixed 1/sec render glitch
- v0.3.2: Smoke tests for layout and UI elements
- v0.3.3: Matched mockup — geometric sidebar icons, titlebar logo, status bar styling, two-panel layout

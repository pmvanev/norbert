# Definition of Ready Validation: Plugin Architecture and Layout Engine

## US-001: NorbertAPI Contract Definition

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Tomasz cannot extend Norbert without modifying core source; specific pain articulated in domain language |
| User/persona identified | PASS | Tomasz Kowalski -- plugin developer building custom monitoring views for his team |
| 3+ domain examples | PASS | 3 examples: happy path (register view), edge (inter-plugin API), error (sandbox rejection) |
| UAT scenarios (3-7) | PASS | 5 scenarios covering view registration, hook processing, plugin composition, sandbox, status bar |
| AC derived from UAT | PASS | 6 AC items each traceable to at least one scenario |
| Right-sized | PASS | 3 days effort, 5 scenarios, single demonstrable feature (API contract) |
| Technical notes | PASS | NorbertPlugin interface, Node.js packages, sandboxing at api.db layer |
| Dependencies tracked | PASS | None (foundational story) |

### DoR Status: PASSED

---

## US-002: Plugin Loader and Dependency Resolver

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Reina confused by silent plugin failures; does not know why features are unavailable |
| User/persona identified | PASS | Reina Vasquez -- power user with multiple plugins installed |
| 3+ domain examples | PASS | 4 examples: happy path, disabled dependency, missing dependency, version mismatch |
| UAT scenarios (3-7) | PASS | 5 scenarios covering load order, degradation, missing deps, version mismatch, runtime disable |
| AC derived from UAT | PASS | 6 AC items each traceable to scenarios |
| Right-sized | PASS | 2 days effort, 5 scenarios |
| Technical notes | PASS | Topological sort, semver comparison, plugins.json config |
| Dependencies tracked | PASS | Depends on US-001 (documented) |

### DoR Status: PASSED

---

## US-003: Two-Zone Layout Engine with Draggable Divider

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Kai forced to click-switch between session list and events; loses track of anomalies |
| User/persona identified | PASS | Kai Nakamura (daily observer, single monitor) and Reina Vasquez (power user, dual monitor) |
| 3+ domain examples | PASS | 3 examples: open secondary, minimum width boundary, toggle with nothing assigned |
| UAT scenarios (3-7) | PASS | 5 scenarios covering open/assign, drag resize, snap 50/50, hide/expand, reshow |
| AC derived from UAT | PASS | 7 AC items traceable to scenarios plus zone abstraction future-proofing |
| Right-sized | PASS | 3 days effort, 5 scenarios |
| Technical notes | PASS | Zone registry as Map, ratio persistence, render-time constraints |
| Dependencies tracked | PASS | Depends on US-001 (documented) |

### DoR Status: PASSED

---

## US-004: View Assignment via Right-Click, Drag, and Picker

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Reina finds menu navigation slow for frequent layout changes; needs multiple fast paths |
| User/persona identified | PASS | Reina Vasquez -- power user with frequent layout changes |
| 3+ domain examples | PASS | 3 examples: right-click, drag with overlay, invalid drop area |
| UAT scenarios (3-7) | PASS | 5 scenarios covering right-click, drag, picker, consistency, replacement |
| AC derived from UAT | PASS | 5 AC items traceable to scenarios |
| Right-sized | PASS | 2 days effort, 5 scenarios |
| Technical notes | PASS | Zone registry generation, HTML5 drag API, command palette reuse |
| Dependencies tracked | PASS | Depends on US-003, US-001 (documented) |

### DoR Status: PASSED

---

## US-005: Floating Panel with Pill Minimize

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Kai finds it wasteful to dedicate entire Secondary zone to small metric; wants overlay |
| User/persona identified | PASS | Kai Nakamura -- single monitor, ambient info needs |
| 3+ domain examples | PASS | 3 examples: open float, pill with metric, pill without metric |
| UAT scenarios (3-7) | PASS | 5 scenarios covering open, snap, pill, switch mode, persistence |
| AC derived from UAT | PASS | 7 AC items traceable to scenarios |
| Right-sized | PASS | 2 days effort, 5 scenarios |
| Technical notes | PASS | No zone toolbar, z-indexed overlay, pill click restore |
| Dependencies tracked | PASS | Depends on US-001, US-003 (documented) |

### DoR Status: PASSED

---

## US-006: Multi-Window with Independent Layouts

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Reina cannot monitor multiple concerns across dual monitors; single window insufficient |
| User/persona identified | PASS | Reina Vasquez -- dual monitor, 3-4 concurrent sessions |
| 3+ domain examples | PASS | 3 examples: second window, window label, both windows restored |
| UAT scenarios (3-7) | PASS | 5 scenarios + 1 @property (performance) covering open, independent layouts, persistence, label, close behavior |
| AC derived from UAT | PASS | 7 AC items traceable to scenarios |
| Right-sized | PASS | 3 days effort, 5 scenarios |
| Technical notes | PASS | VS Code architecture mirror, WAL mode reads, backend serialized writes, 4 entry points |
| Dependencies tracked | PASS | Depends on US-003, US-004 (documented) |

### DoR Status: PASSED

---

## US-007: Sidebar Icon Visibility and Reorder

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Kai's sidebar cluttered with rarely-used icons; visual noise slows navigation |
| User/persona identified | PASS | Kai Nakamura -- several plugins, uses 3-4 daily |
| 3+ domain examples | PASS | 3 examples: hide/reorder, command palette access, reset |
| UAT scenarios (3-7) | PASS | 5 scenarios covering toggle, reorder, command palette, reset, new plugin |
| AC derived from UAT | PASS | 7 AC items traceable to scenarios |
| Right-sized | PASS | 1 day effort, 5 scenarios |
| Technical notes | PASS | sidebar.json schema, separator draggable, bottom-pinned items |
| Dependencies tracked | PASS | Depends on US-001 (documented) |

### DoR Status: PASSED

---

## US-008: Layout Persistence and Named Presets

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Reina finds it tedious to rearrange layout for each task; wants saved configurations |
| User/persona identified | PASS | Reina Vasquez -- frequent task-switching between monitoring/cost/debug |
| 3+ domain examples | PASS | 3 examples: save preset, built-in not deletable, preset references uninstalled plugin |
| UAT scenarios (3-7) | PASS | 5 scenarios covering auto-save, save preset, switch, built-in protection, reset |
| AC derived from UAT | PASS | 7 AC items traceable to scenarios |
| Right-sized | PASS | 2 days effort, 5 scenarios |
| Technical notes | PASS | layout.json presets key, command-palette-style picker, standard view IDs |
| Dependencies tracked | PASS | Depends on US-003, US-004, US-005 (documented) |

### DoR Status: PASSED

---

## US-009: norbert-session Plugin Migration and API Validation

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Hardcoded session list proves nothing about API quality; cannot validate without real consumer |
| User/persona identified | PASS | Norbert development team as internal consumer of their own API |
| 3+ domain examples | PASS | 3 examples: register in Main, floating pill metric, new window |
| UAT scenarios (3-7) | PASS | 5 scenarios covering registration, all placements, persistence, pill metric, friction log |
| AC derived from UAT | PASS | 7 AC items traceable to scenarios |
| Right-sized | PASS | 3 days effort, 5 scenarios |
| Technical notes | PASS | Bundled first-party, public API only, friction log feeds back |
| Dependencies tracked | PASS | Depends on US-001 through US-006 (all documented) |

### DoR Status: PASSED

---

## Summary

| Story | DoR Status |
|-------|------------|
| US-001: NorbertAPI Contract | PASSED |
| US-002: Plugin Loader | PASSED |
| US-003: Two-Zone Layout | PASSED |
| US-004: View Assignment | PASSED |
| US-005: Floating Panels | PASSED |
| US-006: Multi-Window | PASSED |
| US-007: Sidebar Customize | PASSED |
| US-008: Layout Presets | PASSED |
| US-009: norbert-session | PASSED |

All 9 stories pass the 8-item DoR hard gate. Ready for DESIGN wave handoff.

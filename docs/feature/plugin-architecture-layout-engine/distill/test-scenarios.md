# Test Scenarios: Plugin Architecture and Layout Engine (Phase 3)

## Scenario Inventory

| Test File | US | Scenarios | Walking Skeletons | Focused | Error/Boundary | @property |
|---|---|---|---|---|---|---|
| plugin-api-contract.test.ts | US-001 | 10 | 1 | 5 | 4 | 0 |
| plugin-loader-dependencies.test.ts | US-002 | 9 | 0 | 2 | 7 | 0 |
| two-zone-layout-engine.test.ts | US-003 | 11 | 0 | 4 | 6 | 1 |
| view-assignment.test.ts | US-004 | 8 | 0 | 4 | 3 | 1 |
| floating-panels.test.ts | US-005 | 9 | 0 | 6 | 3 | 0 |
| multi-window.test.ts | US-006 | 10 | 0 | 5 | 4 | 1 |
| sidebar-customization.test.ts | US-007 | 8 | 0 | 3 | 5 | 0 |
| layout-persistence-presets.test.ts | US-008 | 10 | 1 | 3 | 5 | 1 |
| norbert-session-migration.test.ts | US-009 | 10 | 1 | 5 | 4 | 0 |
| **Total** | | **85** | **3** | **37** | **41** | **4** |

## Error Path Ratio

Error/boundary scenarios: 41 of 85 = **48%** (target: >= 40%)

## Walking Skeletons (3)

1. **Plugin registers a view and user can access it** (plugin-api-contract.test.ts)
   - US-001 | Validates core plugin value: load, register, see in UI
   - Answers: "Can a plugin developer build an extension that users can see?"

2. **User arranges workspace and arrangement survives restart** (layout-persistence-presets.test.ts)
   - US-008 | Validates core persistence value: arrange once, keep forever
   - Answers: "Can a user set up their workspace and have it persist?"

3. **norbert-session works across all placement targets** (norbert-session-migration.test.ts)
   - US-009 | Validates API sufficiency: first-party plugin works everywhere
   - Answers: "Can a real plugin work in Main, Secondary, floating, and new window?"

## @property-Tagged Scenarios (4)

1. Zone registry is count-agnostic (US-003)
2. All assignment mechanisms produce identical zone state (US-004)
3. No performance degradation with two windows (US-006)
4. Layout save-restore roundtrip preserves all state (US-008)

## Story-to-Scenario Coverage Map

| Story | Acceptance Criteria Count | Scenarios | Coverage |
|---|---|---|---|
| US-001: NorbertAPI Contract | 6 | 10 | Full |
| US-002: Plugin Loader | 6 | 9 | Full |
| US-003: Two-Zone Layout | 7 | 11 | Full |
| US-004: View Assignment | 5 | 8 | Full |
| US-005: Floating Panels | 7 | 9 | Full |
| US-006: Multi-Window | 7 | 10 | Full |
| US-007: Sidebar Customize | 7 | 8 | Full |
| US-008: Layout Presets | 7 | 10 | Full |
| US-009: norbert-session | 7 | 10 | Full |

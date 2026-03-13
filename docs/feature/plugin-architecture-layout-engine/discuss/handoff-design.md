# DESIGN Wave Handoff: Plugin Architecture and Layout Engine (Phase 3)

## Handoff Status: READY

- DoR: All 9 stories PASSED (see dor-validation.md)
- Peer Review: APPROVED, 0 critical / 2 high (remediated) (see peer-review.md)
- Feature type: Cross-cutting platform investment
- Estimated total effort: 21 days across 9 stories

---

## Artifact Inventory

| Artifact | Path | Purpose |
|----------|------|---------|
| JTBD Analysis | `jtbd-analysis.md` | Job stories, four forces, opportunity scoring, personas |
| Journey Visual | `journey-plugin-layout-visual.md` | ASCII mockups, emotional arc, step-by-step flow |
| Journey Schema | `journey-plugin-layout.yaml` | Structured YAML schema with integration validation |
| Gherkin Scenarios | `journey-plugin-layout.feature` | 35+ testable BDD scenarios across all journey steps |
| Shared Artifacts Registry | `shared-artifacts-registry.md` | 9 tracked artifacts with sources, consumers, risk levels |
| User Stories | `user-stories.md` | 9 LeanUX stories with BDD acceptance criteria |
| DoR Validation | `dor-validation.md` | Per-story 8-item validation results |
| Peer Review | `peer-review.md` | Review dimensions assessment, approval |
| This Document | `handoff-design.md` | Handoff summary for solution-architect |

---

## Story Delivery Order (Recommended)

Based on dependency graph and MoSCoW:

```
Sprint 1 (Foundation):
  US-001  NorbertAPI Contract Definition           3 days  Must
  US-002  Plugin Loader and Dependency Resolver     2 days  Must

Sprint 2 (Layout Core):
  US-003  Two-Zone Layout Engine + Divider          3 days  Must
  US-004  View Assignment Mechanisms                2 days  Must
  US-007  Sidebar Icon Visibility and Reorder       1 day   Must

Sprint 3 (Placement + Persistence):
  US-005  Floating Panel with Pill Minimize         2 days  Should
  US-006  Multi-Window with Independent Layouts     3 days  Must
  US-008  Layout Persistence and Named Presets      2 days  Must

Sprint 4 (Validation):
  US-009  norbert-session Migration + Validation    3 days  Must
```

---

## Key Design Constraints for Solution Architect

1. **Zone abstraction must be count-agnostic.** Layout.json stores zone assignments as `Map<zoneName, viewId>`. No hardcoded "main"/"secondary" in plugin API. Adding a third zone must require only layout engine changes.

2. **Single backend process for multi-window.** Windows are pure UI shells subscribing via Tauri IPC. No SQLite contention. Reads direct to WAL-mode DB. Writes serialized through backend.

3. **Plugin sandbox is enforced at API layer.** Plugins cannot write to core tables, modify hook config, or access filesystem outside their directory. This is not OS-level sandboxing; it is API-contract enforcement.

4. **norbert-session is the validation gate.** The plugin API is not ready for Phase 4 until norbert-session works flawlessly across all placement targets. Friction log from US-009 feeds back into API refinement.

5. **Right-click context menu items generated from zone registry.** Menu items like "Open in Main Panel" / "Open in Secondary Panel" are generated dynamically from the zone registry, not hardcoded. When a future "Bottom" zone is added, it appears in the menu automatically.

6. **Layout persistence schema is future-proof.** Presets and layout state store zones as keyed maps. Adding zones extends the schema without restructuring it.

---

## Personas for DESIGN Wave Reference

| Persona | Key Characteristic | Primary Jobs |
|---------|-------------------|--------------|
| Kai Nakamura | Single monitor, daily observer, glance-and-go | JS-01 (arrange), JS-02 (persist), JS-04 (sidebar) |
| Reina Vasquez | Dual monitor, 3-4 sessions, power layout user | JS-01 (arrange), JS-02 (persist), JS-03 (multi-window) |
| Tomasz Kowalski | Plugin developer, builds team extensions | JS-05 (stable API), JS-06 (validation) |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| NorbertAPI surface too large for US-001 scope | Medium | Medium | Monitor during implementation; split if api.mcp or api.events prove complex |
| Zone toolbar rendering complexity | Medium | Medium | Product spec fully specifies; defer visual polish to separate story if needed |
| Multi-window IPC event subscription latency | Low | High | Architecture proven by VS Code pattern; benchmark during US-006 |
| norbert-session migration reveals API gaps | High | Low | This is the intended outcome -- friction log in US-009 feeds back to refinement |
| Layout.json corruption on crash | Low | Medium | "Reset to Default" serves as recovery; consider atomic write (write-then-rename) |

---

## Exit Criteria Traceability

From Phase 3 product spec:

| Exit Criterion | Covered By |
|----------------|------------|
| norbert-session is a functioning first-party plugin | US-009 |
| View assignable to any named zone | US-003, US-004, US-009 |
| View assignable to floating panel | US-005, US-009 |
| View assignable to new window | US-006, US-009 |
| Right-click and drag-and-drop assignment | US-004 |
| Two windows open with independent layouts | US-006 |
| No performance degradation with two windows | US-006 (@property scenario) |
| Sidebar icons hidden and reordered via right-click | US-007 |
| Layout and window state restores after restart | US-008, US-006 |
| Zone abstraction handles N zones | US-003 (AC item), Gherkin @property scenario |
| Adding third zone requires only layout engine changes | US-003 (count-agnostic AC), shared-artifacts-registry checkpoint 6 |

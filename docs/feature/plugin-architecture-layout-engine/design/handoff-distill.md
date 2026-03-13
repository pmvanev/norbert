# DESIGN Wave Handoff: Plugin Architecture and Layout Engine (Phase 3)

## Handoff Status: READY FOR DISTILL

---

## Artifact Inventory

| Artifact | Path | Purpose |
|---|---|---|
| Architecture Design | `design/architecture-design.md` | C4 diagrams (L1+L2+L3), component architecture, integration patterns, quality attribute strategies |
| Technology Stack | `design/technology-stack.md` | Stack decisions with rationale, new dependencies, license compliance |
| Component Boundaries | `design/component-boundaries.md` | 5 component boundaries with ports, data contracts, invariants |
| Data Models | `design/data-models.md` | Persistence schemas (layout, sidebar, plugins, windows), in-memory models, validation rules |
| ADR-011 | `docs/adrs/ADR-011-plugin-loading-mechanism.md` | Bundled first-party + npm global scan |
| ADR-012 | `docs/adrs/ADR-012-multi-window-ipc-architecture.md` | Tauri event system for multi-window |
| ADR-013 | `docs/adrs/ADR-013-layout-persistence-format.md` | JSON files with atomic writes |
| ADR-014 | `docs/adrs/ADR-014-plugin-sandbox-enforcement.md` | API-layer scoping |

---

## Key Architecture Decisions Summary

| Decision | Rationale | ADR |
|---|---|---|
| Hybrid plugin loading (bundled + npm global) | First-party plugins always present; third-party via npm ecosystem | ADR-011 |
| Tauri event system for multi-window IPC | Zero backend overhead per window; sub-ms delivery; built-in lifecycle | ADR-012 |
| JSON files with atomic write for layout persistence | Crash-safe; human-readable; zone-count-agnostic schema | ADR-013 |
| API-layer sandbox enforcement | Simple, testable, same trust model as VS Code extensions | ADR-014 |
| Zone registry as named map | Count-agnostic; adding zones requires only layout engine changes | Architecture Design |
| Single backend process for multi-window | Windows are pure UI shells; no data duplication or contention | Architecture Design |

---

## Development Paradigm

**Functional programming** (from CLAUDE.md and ADR-004).

- Types-first: algebraic data types for LayoutState, ZoneState, PluginManifest, ViewRegistration before implementation
- Composition pipelines: plugin loading as scan -> validate -> resolve -> load pipeline
- Pure core / effect shell: zone assignment logic pure; persistence at boundary
- Effect boundaries at adapter layer (JSON file I/O, Tauri IPC, SQLite access)

---

## Component Boundaries for Roadmap Decomposition

| # | Boundary | US Coverage | Estimated Production Files |
|---|---|---|---|
| 1 | Plugin Host (Loader, Dep Resolver, API Factory, Sandbox, Registry, Lifecycle) | US-001, US-002 | 8-12 |
| 2 | Layout Engine (Zone Registry, Renderer, Divider, Float Manager, Assignment, Persistor) | US-003, US-004, US-005, US-008 | 10-15 |
| 3 | Multi-Window Manager (Window Factory, IPC Router, State Manager) | US-006 | 4-6 |
| 4 | Sidebar Manager (Renderer, Visibility, Order, Persistor) | US-007 | 4-6 |
| 5 | norbert-session Plugin (Entry, Views, Hook Processor) | US-009 | 4-6 |

**Total estimated production files**: 30-45

---

## Constraints for DISTILL Wave

1. **Zone abstraction must be count-agnostic** -- no hardcoded "main"/"secondary" in plugin API, layout persistence, or view assignment
2. **Single backend process** -- windows are UI shells subscribing via Tauri IPC
3. **Plugin sandbox at API layer** -- enforce namespace scoping, not OS-level isolation
4. **norbert-session is the validation gate** -- API not ready until norbert-session works across all placement targets
5. **Context menus generated from zone registry** -- dynamic, not hardcoded
6. **Atomic writes for layout files** -- write-then-rename pattern
7. **Functional paradigm** -- types-first, composition pipelines, pure core / effect shell

---

## Existing Code That Must Be Preserved or Migrated

| File | Phase 2 Role | Phase 3 Impact |
|---|---|---|
| `src/views/SessionListView.tsx` | Core session list view | Migrates into norbert-session plugin |
| `src/views/EventDetailView.tsx` | Core event detail view | Migrates into norbert-session plugin |
| `src/domain/status.ts` | Session/status domain types | Types remain in core; view code moves to plugin |
| `src/domain/eventDetail.ts` | Event formatting | Moves to plugin or stays shared |
| `src/App.tsx` | Monolithic app with hardcoded views | Refactored to Layout Engine + plugin view rendering |
| `src-tauri/src/lib.rs` | App state, IPC commands, window management | Extended with plugin host init, multi-window support |
| `src-tauri/src/ports/mod.rs` | EventStore, EventProvider traits | Unchanged; plugins access via api.db wrapper |

---

## Quality Gates Checklist

- [x] Requirements traced to components (US-001 through US-009 mapped to 5 boundaries)
- [x] Component boundaries with clear responsibilities (5 boundaries documented)
- [x] Technology choices in ADRs with alternatives (ADR-011 through ADR-014)
- [x] Quality attributes addressed (performance, security, reliability, maintainability, usability)
- [x] Dependency-inversion compliance (ports/adapters maintained, NorbertAPI as port)
- [x] C4 diagrams (L1 System Context + L2 Container + L3 Plugin Host + L3 Layout Engine)
- [x] Integration patterns specified (plugin-to-core, multi-window events, layout state flow)
- [x] OSS preference validated (no proprietary dependencies; all MIT/Apache-2.0/ISC/Public Domain)
- [x] AC behavioral, not implementation-coupled (verified across all component boundaries)
- [x] Functional paradigm guidance included (types-first, composition, pure core/effect shell)

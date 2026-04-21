# C4 Diagrams — config-cross-references

All diagrams are Mermaid. Labels on arrows are verbs. Three levels included:

- **L1 System Context** — Norbert desktop app in Ravi's environment (reused from parent plugin, cross-ref module annotated).
- **L2 Container** — the Tauri + React containers, emphasising where this feature's code sits inside the `norbert-config` plugin.
- **L3 Component** — internal modules of the cross-reference feature. Warranted because 6 cooperating components.

---

## L1 — System Context

```mermaid
C4Context
  title System Context — Norbert (with config cross-references)

  Person(ravi, "Ravi Patel", "Claude Code power user. Navigates configs in the Configuration viewer.")

  System(norbert, "Norbert Desktop App", "Local-first observability + configuration management for Claude Code users. Includes the norbert-config plugin with cross-reference navigation.")

  System_Ext(fs, "Local Filesystem", "~/.claude, project .claude, plugin .claude directories. Source of truth for all config items.")
  System_Ext(cc, "Claude Code", "Produces and consumes the same config items. Not called at runtime by cross-ref navigation; filesystem is the contract.")

  Rel(ravi, norbert, "Reads configs; follows references between items via")
  Rel(norbert, fs, "Reads agents, commands, skills, hooks, MCP, rules, plugins, env from")
  Rel(cc, fs, "Writes configs to (out-of-band)")
```

Notes:
- Cross-reference navigation is **pure read**: no writes to the filesystem, no calls to Claude Code. This is a hard feature constraint (System Constraint #2 in user-stories.md).
- No external web services, no third-party APIs. No contract tests needed (confirmed below).

---

## L2 — Container

```mermaid
C4Container
  title Container Diagram — Norbert (cross-ref feature scope)

  Person(ravi, "Ravi Patel")

  System_Boundary(norbert, "Norbert Desktop App") {
    Container(reactUi, "React UI (renderer)", "TypeScript, React 18, Vite", "All views including the Configuration view.")
    Container(tauriBackend, "Tauri Backend", "Rust, Tauri 2", "Reads config files, serialises to IPC responses. Already implements read_claude_config.")
    ContainerDb(sqlite, "SQLite", "bundled", "Observability data (sessions, events, metrics). NOT used by cross-ref feature.")
  }

  System_Boundary(claudefs, "Local Filesystem") {
    ContainerDb_Ext(userCfg, "~/.claude/", "user-scope config")
    ContainerDb_Ext(projCfg, "./.claude/", "project-scope config")
    ContainerDb_Ext(plugCfg, "plugin .claude/", "plugin-scope config")
  }

  Rel(ravi, reactUi, "Clicks references, presses Alt+Left/Right via")
  Rel(reactUi, tauriBackend, "Invokes read_claude_config on")
  Rel(tauriBackend, userCfg, "Reads from")
  Rel(tauriBackend, projCfg, "Reads from")
  Rel(tauriBackend, plugCfg, "Reads from")

  UpdateRelStyle(reactUi, tauriBackend, $offsetY="-20")
```

Notes:
- Cross-ref feature lives **entirely inside the React UI container**. No backend changes.
- No new IPC commands. No new Rust code. Feature consumes the existing `read_claude_config` response.
- SQLite is mentioned for completeness but is not on the cross-ref feature's critical path.

---

## L3 — Component (cross-reference feature)

Detailed view of the React-UI container, zoomed into the `norbert-config` plugin with the new cross-reference module boundaries.

```mermaid
C4Component
  title Component Diagram — Cross-Reference Module (inside norbert-config plugin)

  Container_Boundary(ui, "React UI / norbert-config plugin") {
    Component(configView, "ConfigurationView", "React FC (existing, minor changes)", "Owns Tauri IPC (read_claude_config) and loadState. Passes aggregatedConfig and isActive down to the provider.")
    Component(navProvider, "ConfigNavProvider", "React FC (new)", "Owns state via useReducer; installs Alt+Left/Right window listener; emits instrumentation. Derives ReferenceRegistry from the aggregatedConfig prop.")
    Component(announcer, "NavAnnouncer", "React FC (new, small)", "Owns the aria-live=polite region. Derives announcement text from the pure announcementFor(prev, next) helper on each committed state transition.")

    Boundary(domain, "domain/ — pure logic (no IO, no React)") {
      Component(registry, "ReferenceRegistry", "TS module (new)", "Derived index {name, type, scope → item}. Rebuilt from AggregatedConfig.")
      Component(detection, "DetectionPipeline", "TS module (new)", "Pure AST visitor. Strategy array. Produces AnnotatedMdast.")
      Component(resolver, "ReferenceResolver", "TS module (new)", "Resolves Reference → ResolvedItem | AmbiguousMatch | Unresolvable.")
      Component(reducer, "ConfigNavReducer", "TS module (new)", "Pure state transition. Discriminated-union actions. Appends history entries per ADR-008.")
      Component(history, "NavHistory", "TS module (new)", "Pure LRU-50 stack: pushEntry, goBack, goForward.")
      Component(scope, "ScopePrecedence", "TS module (new)", "Const array + pure helpers for OQ-5 pre-highlight order.")
    }

    Boundary(views, "views/ — UI components") {
      Component(listPanel, "ConfigListPanel", "React FC (existing, extended)", "Reads activeSubTab, selectedItemKey, filter from ConfigNavStore via hooks.")
      Component(detailPanel, "ConfigDetailPanel", "React FC (existing, extended)", "Renders top pane + optional split bottom. Passes remarkPlugins=[detectionPlugin]. Renders referenceToken via custom component map.")
      Component(token, "ReferenceToken", "React FC (new)", "Renders 4 variants (live, dead, ambiguous, unsupported). Handles click, Ctrl+click, keyboard Enter/Ctrl+Enter.")
      Component(popover, "DisambiguationPopover", "React FC (new)", "Accessible dialog; focus trap; arrow-key navigation.")
      Component(splitLayout, "SplitLayout", "React FC (new)", "Two-pane flex layout; divider; Close button; Esc handler.")
      Component(statusLine, "FilterResetStatusLine", "React FC (new, small)", "3-second status line per ADR-007.")
    }
  }

  System_Ext(tauriBackend, "Tauri Backend", "read_claude_config IPC")

  Rel(configView, tauriBackend, "Invokes read_claude_config on (existing)")
  Rel(configView, navProvider, "Wraps subtree with; passes aggregatedConfig + isActive as props")
  Rel(navProvider, reducer, "Drives state transitions using")
  Rel(navProvider, history, "Reads history slice from state via")

  Rel(navProvider, registry, "Rebuilds on new aggregatedConfig via")
  Rel(navProvider, announcer, "Flushes committed state transitions to")
  Rel(listPanel, navProvider, "Subscribes to activeSubTab, selectedItemKey, filter from")
  Rel(listPanel, navProvider, "Dispatches selectItem, switchSubTab, setFilter to")

  Rel(detailPanel, navProvider, "Subscribes to splitState, selectedItemKey from")
  Rel(detailPanel, detection, "Passes registry + AST to")
  Rel(detection, registry, "Looks up names in")
  Rel(detailPanel, token, "Renders referenceToken nodes via")

  Rel(token, resolver, "Resolves clicks via")
  Rel(resolver, registry, "Queries")
  Rel(resolver, scope, "Pre-highlights via")
  Rel(token, navProvider, "Dispatches refSingleClick / refCtrlClick / openDisambiguation to")

  Rel(popover, navProvider, "Dispatches confirmDisambiguation / cancelDisambiguation to")

  Rel(splitLayout, navProvider, "Dispatches closeSplit to")

  Rel(statusLine, navProvider, "Reads transient filter-reset flag from")
```

### Component responsibilities (one sentence each)

| Component | Responsibility |
|-----------|---------------|
| **ConfigurationView** | Mount point; existing; owns Tauri IPC + `loadState`; passes `aggregatedConfig: AggregatedConfig \| null` and `isActive: boolean` props to the provider. |
| **ConfigNavProvider** | Owns reducer state; installs window keydown listener (ADR-003); isolates effects (focus management, instrumentation, end-of-history timer, live-region flush). Derives `ReferenceRegistry` from the `aggregatedConfig` prop via `useMemo`. |
| **NavAnnouncer** | Owns the single `aria-live="polite"` region for the Configuration view. Derives text from the pure `announcementFor(prev, next)` helper. WCAG 2.2 AA / SC 4.1.3. |
| **ConfigNavReducer** | Pure state transition for all cross-reference actions. Tested without React. |
| **NavHistory** | Pure LRU-50 stack (ADR-006). `fast-check` property tests. |
| **ReferenceRegistry** | Derived `(name, type, scope → item)` index, plus reverse `filePath → item`. Rebuilt when `AggregatedConfig` changes (memoised). |
| **DetectionPipeline** | Remark AST visitor; strategy array; returns annotated root. Pure (ADR-001). |
| **ReferenceResolver** | Classifies a `Reference` as `live` / `ambiguous` / `dead` / `unsupported`. Pure. |
| **ScopePrecedence** | Const array `['project','plugin','user']` + pure `preHighlight(candidates)` (ADR-004). |
| **ConfigListPanel** | Existing component, extended: reads state from provider via hooks, emits actions via dispatch. No longer owns `useState` for `activeSource`/`sortMode`. |
| **ConfigDetailPanel** | Existing, extended: routes through DetectionPipeline, renders split via SplitLayout when `splitState` is non-null. |
| **ReferenceToken** | New; renders 4 variants; handles click/keyboard; dispatches actions. |
| **DisambiguationPopover** | New; accessible dialog (ADR-004). |
| **SplitLayout** | New; two-pane flex layout + divider + Close button + Esc handler. |
| **FilterResetStatusLine** | New; 3-second transient status line (ADR-007). |

### Why L3 is warranted

Six new cooperating components around a shared store justify an L3 diagram. Without it, the coupling between `DetectionPipeline` and `ReferenceRegistry` (rendering) versus `ReferenceResolver` and `ReferenceRegistry` (click-time resolution) is easy to miss — and that coupling is the subject of the highest-risk shared artifact (`reference_registry`, HIGH risk per shared-artifacts-registry).

---

## Arrow-label hygiene check

Every arrow in every diagram above uses a verb. Spot check:
- "Clicks references, presses Alt+Left/Right via" ✓
- "Invokes read_claude_config on" ✓
- "Dispatches selectItem, switchSubTab, setFilter to" ✓
- "Subscribes to activeSubTab, selectedItemKey, filter from" ✓
- "Rebuilds on new AggregatedConfig via" ✓

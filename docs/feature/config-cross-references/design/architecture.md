# Architecture — config-cross-references

Wave: DESIGN
Feature: `config-cross-references` (extends `norbert-config` plugin)
Paradigm: **Functional** (per CLAUDE.md). All domain modules are pure; effects are isolated at the Provider edge.
Author: Morgan (solution-architect)
Date: 2026-04-21

This document is the single technical specification for the feature. It references ADRs for decision rationale, the journey YAML for behavioural contracts, and user-stories.md for acceptance criteria.

---

## 1. Requirements Summary (traced to components)

| Story | Component(s) owning behaviour | ADR |
|-------|-------------------------------|-----|
| US-101 Detect + style tokens | DetectionPipeline, ReferenceRegistry, ReferenceResolver, ReferenceToken | ADR-001, ADR-010 |
| US-102 Single-click split preview | ConfigNavReducer, SplitLayout, ReferenceToken | ADR-002, ADR-009 |
| US-103 Ctrl+click commit+sync | ConfigNavReducer (atomic action), ConfigListPanel, ConfigDetailPanel | ADR-002, ADR-007 |
| US-104 Alt+Left/Right history | ConfigNavProvider (listener), NavHistory | ADR-003, ADR-006 |
| US-105 Close split | ConfigNavReducer, SplitLayout (Esc) | ADR-002, ADR-008 |
| US-106 Single-click in split replaces bottom | ConfigNavReducer (fixed 2-slot invariant) | ADR-009 |
| US-107 Dead reference no-op + tooltip | ReferenceResolver, ReferenceToken | ADR-001 |
| US-108 Ambiguous disambiguation popover | DisambiguationPopover, ConfigNavReducer, ScopePrecedence | ADR-004 |
| US-109 Deleted-mid-click / permission (R2) | ReferenceResolver (re-check at click time), error-panel component | — (R2) |
| US-110 Keyboard-only path (R2) | ConfigNavProvider (focus mgmt), ReferenceToken, DisambiguationPopover | ADR-003 |

Walking skeleton = US-101/102/103/104/107.

NFRs map to components:
- NFR-1 click responsiveness ≤ 250 ms p95 → `ConfigNavReducer` O(1) action handling + `ReferenceRegistry` O(1) lookup.
- NFR-2 registry build ≤ 500 ms p95 for 500 items → `ReferenceRegistry.build(AggregatedConfig)` single-pass indexing.
- NFR-3 LRU 50 → `NavHistory` (ADR-006).
- NFR-4 WCAG 2.2 AA → `ReferenceToken`, `DisambiguationPopover`, `SplitLayout` all expose keyboard paths; focus rings from theme.
- NFR-5 Alt+Left/Right scoping → `ConfigNavProvider` ref-gated window listener (ADR-003). **Verified no collision with existing shortcuts.**

---

## 2. Existing System Analysis (survey summary)

Surveyed files (read before design):

- `src/plugins/norbert-config/views/ConfigurationView.tsx` — mounts sub-tab nav + list panel. Owns `activeTab` and `selectedKey` locally. Will lose local state in favour of the new Provider (state lifted INTO the plugin, not out of it).
- `src/plugins/norbert-config/views/ConfigListPanel.tsx` — list renderer per sub-tab with filter bar + sort. Today holds `activeSource`/`sortMode` in local `useState`. This feature moves those into `ConfigNavState.filter.bySubTab[tab]` so filter state survives a round-trip through Ctrl+click + Alt+Left.
- `src/plugins/norbert-config/views/ConfigDetailPanel.tsx` — current detail renderer uses `react-markdown` + `remark-gfm` for `AgentDefinition.systemPrompt`, `CommandDefinition.content`, `SkillDefinition.content`, `PluginInfo.readme`, and markdown `RuleEntry.text`. The cross-ref detection pipeline inserts a third `remarkPlugin` in each of these call sites (one helper function in a new module).
- `src/plugins/norbert-config/domain/types.ts` — provides all the input types. No changes.
- `src/plugins/norbert-config/domain/configAggregator.ts` — `aggregateConfig(raw)` is the existing derivation. The new `ReferenceRegistry.build(config)` is a second derivation.
- `src/plugins/norbert-config/views/shared.tsx` — has `ScopeBadge`, `formatAgentDisplayName`, `deriveFilename`. Will add `sourceLabel` (currently duplicated in ConfigListPanel) when moved here.
- `src/plugins/norbert-config/views/AgentsTab.tsx` and the other `*Tab.tsx` are flagged **legacy unused** — not touched.
- `src/plugins/types.ts` — plugin API contract; no extension needed. Cross-ref is internal to the plugin.
- `src/App.tsx` — supplies `ConfigurationView onItemSelect={...}` and renders `ConfigDetailPanel` in the secondary zone. Needs a one-line change: pass `isActive={layout.zones.get("main")?.viewId === "configuration"}` down. The app already holds the selection state via `selectedConfigItemRef`; this continues to work as a read-only mirror.
- `src/main.tsx` / `src/domain/keyboardShortcuts.ts` — NFR-5 verification: no Alt-combination shortcuts exist. Alt+Left/Right are free.

**Reuse decisions**:
- Reuse `react-markdown` + `remark-gfm` (already present).
- Reuse `ScopeBadge`, `formatAgentDisplayName`, `deriveFilename` from `shared.tsx`.
- Reuse `AggregatedConfig` and `SelectedConfigItem` types unchanged.
- Reuse `dependency-cruiser` for architectural rule enforcement (already in `package.json`).
- Reuse `fast-check` for property tests (already in dev deps).
- **No tooltip/popover primitive exists in norbert-config** — introduce small, feature-local components. `PhosphorHoverTooltip` in norbert-usage is not reusable (specific to canvas hit-testing). Keep cross-ref tooltip/popover inside this plugin.

---

## 3. Architectural Style

**Modular monolith with dependency inversion (ports-and-adapters) inside an FP paradigm.**

- The Tauri app is already a monolith (one renderer process + one backend).
- The plugin system gives us the module boundary; cross-ref stays inside one plugin.
- Within the plugin: `domain/` (pure) is the core; `views/` (React) is the driving adapter; the existing Tauri `invoke("read_claude_config")` is the driven adapter (unchanged).
- Dependency direction: `views/*` → `domain/*`; `domain/*` imports nothing from `views/*` or Tauri.

Team size / Conway check: one developer (per CLAUDE.md context). Monolith + plugin boundary is exactly right. No microservice ambition is justified.

Simpler alternatives rejected:
- **No new module** (put everything in `ConfigDetailPanel`): rejected because US-103 Ctrl+click atomicity requires a state container above both panels.
- **Move state to App.tsx**: rejected (ADR-002 Alt B) — pollutes app shell with plugin-specific state.

---

## 4. Technology Stack

All choices OSS, already present in the repository or transitively.

| Choice | Version | License | Rationale | ADR |
|--------|---------|---------|-----------|-----|
| React 18 | 18.3.1 | MIT | Existing. useReducer + Context natural fit. | ADR-002 |
| TypeScript 5 | 5.6.3 | Apache-2.0 | Existing. Discriminated unions enforce action/state shapes. | — |
| react-markdown | 10.1.0 | MIT | Existing. Accepts `remarkPlugins` prop. | ADR-001 |
| remark-gfm | 4.0.1 | MIT | Existing. | — |
| unist-util-visit | ~5.0 (transitive already) | MIT | AST traversal for detection plugin. | ADR-001 |
| fast-check | 4.6.0 | MIT | Existing dev. Property tests for reducer + history. | — |
| vitest | 4.0.18 | MIT | Existing. Unit + integration tests. | — |
| @testing-library/react | 16.3.2 | MIT | Existing. Component-level tests. | — |
| dependency-cruiser | 17.3.10 | MIT | Existing. Enforce `domain/` ⇎ `views/` boundary rules. | — |

**No new runtime dependencies.** `unist-util-visit` is already transitive via `remark-gfm`; adding it as a direct dep is a lockfile housekeeping item only.

**Proprietary tech**: none.

### Architectural rule enforcement (mandatory per Core Principle 11)

Extend `.dependency-cruiser.cjs` with the following rules, all language-appropriate for the TypeScript codebase:

1. `no-tauri-from-domain`: forbid `@tauri-apps/*` imports under `src/plugins/norbert-config/domain/**`.
2. `no-react-from-domain`: forbid `react`, `react-dom` imports under `src/plugins/norbert-config/domain/**`.
3. `no-views-from-domain`: forbid `../views/**` imports under `src/plugins/norbert-config/domain/**`.
4. `detection-strategies-isolated`: modules under `src/plugins/norbert-config/domain/references/detection/` import ONLY from the detection types module, `unist-util-visit`, and the registry types (no cross-strategy imports).

These rules must be part of the `lint:boundaries` check (already wired in `package.json`).

---

## 5. Integration Patterns

All integrations are **in-process** (single renderer). No remote calls added.

### 5.1 Existing integration: read_claude_config

Unchanged. `ConfigurationView` already calls `invoke<RawClaudeConfig>("read_claude_config", { scope: "both" })`. The result flows through `aggregateConfig` to `AggregatedConfig`. This feature additionally derives `ReferenceRegistry.build(aggregatedConfig)`.

### 5.2 Internal integration: state subscription

The Provider exposes three hooks:

```ts
// views/nav/hooks.ts
function useConfigNavState<T>(selector: (s: ConfigNavState) => T): T;  // memoised, uses useSyncExternalStore
function useConfigNavDispatch(): (action: ConfigNavAction) => void;
function useConfigNavIsActive(): boolean;  // for internal effects gating
```

Panel consumers call `useConfigNavState(s => s.activeSubTab)` — targeted re-render.

### 5.3 Instrumentation (for DEVOPS handoff)

Three events per `outcome-kpis.md`. Emission point is an effect inside `ConfigNavProvider`:

```ts
useEffect(() => {
  // subscribe to every state transition, translate to telemetry event
}, []);
```

Actual event sink is TBD by platform-architect (DEVOPS). This design only defines the emission contract:

| Event | Fields (minimum) | Triggered by |
|-------|------------------|--------------|
| `cross_ref_click` | `{ source_item_id, source_item_type, target_item_id \| null, target_item_type, target_scope, interaction, result, latency_ms }` | Every click / keyboard action on a reference token, regardless of variant |
| `nav_history_restore` | `{ direction: 'back'\|'forward', matched_snapshot: boolean, stack_depth }` | Alt+Left / Alt+Right handler execution |
| `ambiguous_ref_resolve` | `{ candidate_count, chosen_scope, method: 'popover'\|'silent_precedence' }` | Popover confirm / cancel |

Instrumentation is a **side effect at the edge**, not inside the reducer.

### 5.4 External APIs — absence

No external web APIs, no third-party services, no webhooks, no OAuth. Cross-reference navigation is local-filesystem-only.

**Contract test annotation (for platform-architect)**: **Not applicable** — this feature consumes only the existing `read_claude_config` IPC (first-party, in-process boundary). No consumer-driven contract tests required.

---

## 6. Component Architecture (details beyond C4)

### 6.1 Reference Registry

```ts
// domain/references/registry.ts

type RefType = 'agent' | 'command' | 'skill' | 'hook' | 'mcp' | 'rule' | 'plugin';

interface RegistryEntry {
  readonly type: RefType;
  readonly scope: ConfigScope;
  readonly source: string;          // plugin name when scope='plugin', else 'user'|'project'
  readonly name: string;
  readonly filePath: string;
  readonly itemKey: string;         // matches the List's selectedKey for direct navigation
}

interface ReferenceRegistry {
  readonly byName: ReadonlyMap<string, readonly RegistryEntry[]>;   // name → entries (multi-scope)
  readonly byFilePath: ReadonlyMap<string, RegistryEntry>;          // absolute or normalised path → entry
  readonly version: number;                                         // incremented on every rebuild, for memo keys
}

function buildRegistry(config: AggregatedConfig, prevVersion: number): ReferenceRegistry;
function lookupByName(reg: ReferenceRegistry, name: string): readonly RegistryEntry[];
function lookupByPath(reg: ReferenceRegistry, path: string): RegistryEntry | null;
```

**Rebuild trigger**: whenever `AggregatedConfig` changes (that is: when the user hits the reload button in `ConfigurationView`, or when the backend watcher — inherited from parent `norbert-config` — fires). Deferred rebuild through `useMemo` keyed by the config object reference.

**Integration-seam prop contract**: `ConfigurationView` owns the Tauri IPC (`invoke("read_claude_config", …)`) and the `loadState` discriminated union; it is the sole caller of the backend. It passes the resulting value down to `ConfigNavProvider` as `aggregatedConfig: AggregatedConfig | null`. `ConfigNavProvider` calls `buildRegistry(aggregatedConfig)` inside a `useMemo` keyed on `aggregatedConfig`. When `null` (idle/loading/error), the registry is an empty derived value — detection no-ops. This keeps the provider free of IPC coupling and preserves the existing `loadState` machinery in `ConfigurationView` unchanged.

**Name collisions**: intentional — the `byName` map returns a list, not a single entry. Multi-entry names power the ambiguous path (US-108).

**File-path matching**: `lookupByPath` normalises paths (expand `~/`, resolve `./`, strip trailing slash) and compares against a pre-normalised key. A bare `./foo.md` link resolves against the directory of the viewing item when that context is available (`DetectionContext.currentItemDir`).

### 6.2 Detection Pipeline

See ADR-001 for strategy selection. Module layout:

```
domain/references/detection/
├── types.ts                 // DetectionStrategy, DetectionContext, Reference
├── markdownLinkStrategy.ts  // detectMarkdownLink
├── inlineCodeStrategy.ts    // detectInlineCodeName
├── pipeline.ts              // const DETECTION_PIPELINE + composePipeline(...)
└── remarkPlugin.ts          // glue: produces a unified-compatible plugin
```

Output: the MDAST is transformed (existing nodes replaced with `mdast-util`-compatible nodes carrying additional data). Because `react-markdown` v10's `components` map keys on HTML element names rather than arbitrary MDAST node types, the strategy is:

- Replace matched `link`/`inlineCode` nodes with the **same** HAST-bound node type (`link` or `inlineCode`) but attach a distinguishing `data.hName: 'reference-token'` and `data.hProperties: { 'data-ref-variant': variant, 'data-ref-target-key': targetKey, 'data-ref-raw-text': raw }`.
- The `components` map in `ConfigDetailPanel` then provides a custom renderer for `'reference-token'` (via the `components={{ 'reference-token': ReferenceToken }}` prop supported by `react-markdown` v10 for custom element names produced by remark plugins).
- Fallback: if a plugin-incompatibility surfaces during implementation, the alternative is rehype-stage transformation (`rehypePlugins`) producing HAST elements directly — identical effect, different pipeline stage. Both paths are pure.

Reference for this pattern: the `remark-toc`, `remark-gh-link`, and `remark-external-links` plugins all use the `data.hName` mechanism to produce custom renderable nodes from an MDAST transform. Implementation should mirror their shape.

**Memoisation**: `useMemo(() => detect(markdownContent, registry), [markdownContent, registry.version])` inside the detail renderer path. O(1) cache hit on subsequent renders of the same item.

**Performance budget** (NFR-2): AST walk is O(nodes). For a 2000-line command body ~ 10-20 k AST nodes; strategies do one Map lookup per node ≈ 10-20 k lookups → well under 1 ms on modern hardware. Registry build is one pass over `AggregatedConfig` ≈ O(N) where N = total items; 500 items → sub-millisecond.

### 6.3 Reference Resolution

```ts
// domain/references/resolver.ts

type Reference = Readonly<
  | { kind: 'name'; value: string }
  | { kind: 'path'; value: string }
>;

type ResolvedRef =
  | { tag: 'live';        entry: RegistryEntry }
  | { tag: 'ambiguous';   candidates: readonly RegistryEntry[] }
  | { tag: 'dead';        searchedScopes: readonly ConfigScope[] }
  | { tag: 'unsupported'; path: string; category: string; reason: string };

function resolve(ref: Reference, reg: ReferenceRegistry): ResolvedRef;
```

Pure. The `kind` discriminator selects the **lookup strategy** (which registry surface to query) — `name` dispatches to `lookupByName`, `path` dispatches to `lookupByPath`. `ambiguous` when name lookup returns `candidates.length >= 2`. `dead` when the lookup misses; `searchedScopes` is sourced from the shared `REGISTRY_SCOPES` constant exported by `registry.ts`. `unsupported` when a path-shaped reference points under `.claude/<category>/` where `<category>` is not one of the surfaces the plugin exposes (the location is recognised but the item type cannot be surfaced — US-101 AC bullet 4); `category` carries the unrecognised segment as a first-class typed datum so UI consumers do not have to parse `reason`. The plugin's exposed categories are sourced from the shared `REGISTRY_CATEGORIES` constant exported by `registry.ts`.

**Click-time re-resolution** (US-109 R2): the reducer's `refSingleClick`/`refCtrlClick` actions carry the ResolvedRef captured at render time. The provider additionally re-checks `lookupByPath` / `lookupByName` at click dispatch time using the current registry; if the item has vanished, it dispatches a soft-failure action instead (R2).

#### Changed Assumptions

The shipped `Reference` shape diverges from the original §6.3 spec — `{ kind: 'markdown-link' | 'inline-code', rawText, resolveHint }` was replaced by `{ kind: 'name' | 'path', value }` during Phase 02 implementation. The `unsupported` arm gained a typed `category` field.

- **Why the change**: the original shape conflated **source-syntax** (markdown-link vs inline-code, an ADR-001 detection-layer concern) with **lookup strategy** (which registry surface to query, the resolver's only concern). The shipped shape gives a cleaner, more composable resolver: the resolver does not need to know which markdown construct produced a reference, only how to look it up. Symmetrically, the typed `category` field on `unsupported` removes the need for UI consumers to parse the human-readable `reason` string to learn the unrecognised category name (types-as-documentation).
- **Reference**: `roadmap-review-phase-02.yaml` (reviewer agreement), `review-pass-2-phase-02.yaml` (typed-category recommendation), commit `156c93d` module docstring (deviation guard), and the Phase 02 entry in `docs/evolution/config-cross-references-evolution.md`.
- **Detection consumer**: when the detection pipeline (§6.2) lands, it constructs `Reference` values directly from MDAST nodes — an `inlineCode` node's `value` becomes `{ kind: 'name', value }`; a `link` node's `url` becomes `{ kind: 'path', value: url }`. No adapter layer is required between detection and the resolver.

### 6.4 State and Reducer

See ADR-002. Reducer signature:

```ts
function reduce(state: ConfigNavState, action: ConfigNavAction): ConfigNavState;
```

Key action behaviours (illustrative, not implementation):

| Action | State changes | History push |
|--------|---------------|--------------|
| `selectItem` | `activeSubTab, selectedItemKey` | **no** (ADR-008) |
| `switchSubTab` | `activeSubTab, selectedItemKey=null, splitState=null` | no |
| `refSingleClick` | `splitState = {topRef: current, bottomRef: ref, ratio: 0.5}`. When the split is already open and the click originates from the bottom pane, the same action applies — `bottomRef` is replaced, `topRef` is unchanged. The action carries no click-origin metadata; the reducer's split-open invariant (2-slot fixed shape, ADR-009) enforces the correct write slot regardless of which pane emitted the click. | **yes** |
| `refCtrlClick` (same sub-tab) | `selectedItemKey=ref.key, splitState=null`, filter may reset (ADR-007) | **yes** |
| `refCtrlClick` (cross sub-tab) | `activeSubTab=ref.subTab, selectedItemKey=ref.key, splitState=null`, filter may reset | **yes** |
| `closeSplit` | `splitState=null` | yes |
| `historyBack`/`historyForward` | restore entry at new headIndex | no (restore only) |
| `openDisambiguation` | `popover = { ... }` | no (popover itself does not push) |
| `confirmDisambiguation` | applies `refSingleClick` or `refCtrlClick` semantics on chosen candidate | yes |
| `cancelDisambiguation` | `popover = null` | no |
| `setFilter` | `filter.bySubTab[tab] = { source, sort }` | no |

Reducer is **total** — every action has an explicit case; TypeScript's exhaustiveness check forbids missing cases.

**R2 extension path**: US-109 (deleted-mid-click / permission-denied) introduces two additional actions (e.g. `refClickSoftFail_deleted`, `refClickSoftFail_permission`). These append to the `ConfigNavAction` union without altering the existing action cases; the exhaustiveness check forces handling on add. No walking-skeleton behaviour changes when R2 lands.

### 6.5 History (LRU 50)

See ADR-006. Pure module `domain/nav/history.ts` with signatures given there.

### 6.6 Keyboard scope

See ADR-003. The window-level Alt+Left/Right listener is in `ConfigNavProvider`. Esc-to-close is `onKeyDown` on `SplitLayout`. Neither touches `main.tsx`.

### 6.7 Ctrl+Click Atomicity

US-103 requires sub-tab + list selection + detail + split-reset + filter-bar-decision to occur in one state transition. The `refCtrlClick` case in the reducer constructs the next state in a single immutable update — there is no intermediate render between the four field changes. React's reconciliation then flushes the panels in one frame.

Focus management (US-110) is an effect that runs AFTER commit using `useEffect` depending on `state.selectedItemKey`. The effect writes focus to the list-row ref when the transition is a `refCtrlClick`. This sequencing (state → DOM → focus) is the reason a pure reducer is used (ADR-002 rejected Alt A Zustand partially on this point).

### 6.8 NavAnnouncer (accessibility — WCAG 2.2 AA / SC 4.1.3)

Pane transitions and cross-reference navigation must be announced to assistive technology. A dedicated `NavAnnouncer` component is owned by `ConfigNavProvider` (already the effect boundary) and renders a single visually-hidden live region at the provider root:

```tsx
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {announcementText}
</div>
```

`aria-live="polite"` is chosen over `assertive` because navigation transitions are user-initiated and do not interrupt active content; `assertive` would be inappropriately forceful (WCAG guidance for SC 4.1.3).

The announcement text is derived from a pure `announcementFor(prev, next)` helper in `domain/nav/announcements.ts`:

| Transition | Announcement template |
|-----------|-----------------------|
| Split open (`refSingleClick` without existing split) | `Preview open: {type} {name}, {scope} scope` |
| Bottom-pane replace (`refSingleClick` with existing split) | `Preview replaced: {type} {name}, {scope} scope` |
| Split close (`closeSplit`) | `Preview closed` |
| Ctrl+click commit same sub-tab (`refCtrlClick`) | `Navigated to {type} {name}` |
| Ctrl+click commit cross sub-tab (`refCtrlClick`) | `Switched to {targetSubTab}; now viewing {type} {name}` |
| History back / forward | `Back to {type} {name}` / `Forward to {type} {name}` |
| History boundary hit (end-of-history flag set) | `No further history in {direction} direction` |
| Ambiguous popover opened | `Disambiguation required: {count} candidates for {name}` |
| Dead-ref click (no-op, tooltip already visible) | silent — tooltip carries the information |

The helper is pure and unit-tested; the Provider flushes the latest announcement into the live region via a `useEffect` keyed on `(state.selectedItemKey, state.splitState, state.popover, state.endOfHistory)`. Because multiple state fields can change in one reducer pass (e.g. `refCtrlClick` cross-tab touches 4 fields), the derivation must run on the committed state after React's batched flush — not mid-reducer.

### 6.9 Integration with existing panels

`ConfigListPanel` changes:
- Remove local `useState` for `activeSource`, `sortMode`.
- Remove the `useEffect(() => { setActiveSource(null); setSortMode("name"); }, [tab]);` (handled by reducer on `switchSubTab`).
- Add selectors: `useConfigNavState(s => s.activeSubTab)`, `...filter.bySubTab[activeSubTab]`.
- `onSelect` handler dispatches `selectItem` instead of calling prop.
- Add status line (ADR-007) when `state.filterResetCue === targetSubTab`.

`ConfigDetailPanel` changes:
- Reads `splitState` and `selectedItemKey` from provider.
- Wraps existing detail components in `SplitLayout` when `splitState !== null`.
- Bottom-pane rendering reuses the existing detail components with a new `mode: 'preview'` prop (truncation + header chrome).
- Passes `detectionRemarkPlugin(registry, ctx)` into every `<Markdown>` invocation.

`App.tsx` changes: one prop — `isActive={layout.zones.get("main")?.viewId === "configuration"}` — passed to `ConfigurationView`, which threads it to `ConfigNavProvider`.

---

## 7. Quality Attribute Strategies (ISO 25010)

| Attribute | Strategy | Verification |
|-----------|----------|--------------|
| Functional suitability | Reducer actions map 1:1 with US-101..US-110 AC | Unit tests per AC |
| Performance efficiency (NFR-1, NFR-2, NFR-4) | Pure functions; memoised detection; indexed registry lookup; capped history | p95 latency telemetry (KPI #6); property test on registry build under 500 items |
| Compatibility | Additive to `norbert-config`; no IPC changes | Existing tests remain green |
| Usability (NFR-4 WCAG 2.2 AA) | Keyboard parity for every click action; visible focus rings (theme); `NavAnnouncer` owns a single `aria-live="polite"` region (§6.8) driven by the pure `announcementFor(prev, next)` helper — announcement contract is concrete, not hand-waved | Automated a11y tests via @testing-library + axe; unit tests on `announcementFor`; manual keyboard + screen-reader walkthrough |
| Reliability | Dead refs never crash (D2); deleted-mid-click soft-fails (US-109 R2); invariants enforced by types (ADR-009) | Property tests; error boundary in place; invariant assertions in reducer (dev-mode) |
| Security | Read-only; no new IPC; no external APIs | No new attack surface |
| Maintainability | Pure `domain/` modules; dependency-cruiser enforces direction; reducer exhaustiveness checked by TS | `npm run lint:boundaries`; `npm run check` |
| Portability | No platform-specific code in the feature | N/A change vs existing |

Sensitivity points (ATAM terms):
- **Registry version field** — sensitive to the detection memoisation invalidation correctness. If we increment on every rebuild but the content hasn't changed, detection runs repeatedly (perf hit). If we forget to increment, stale detection (correctness hit). Covered by unit test.
- **`selectedItemKey` ⇌ `topRef.itemKey` invariant** — sensitive to split-open + manual-select coordination. Dev-mode invariant assertion.

Trade-off points:
- **Popover always-on vs silent precedence** — security/trust vs efficiency. ADR-004 chose trust.
- **History cap** — memory vs continuity. ADR-006 chose continuity up to 50.

---

## 8. Deployment Architecture

Unchanged. No new containers, no new IPC, no new filesystem access. The feature ships as additional TypeScript modules under `src/plugins/norbert-config/` that are bundled into the existing Vite build and loaded at plugin registration (`norbertConfigPlugin` in `src/plugins/norbert-config/index.ts`).

Feature-flag posture: ship directly; kill-switch is not code-gated. Per R1 risk (DISCUSS), the sub-set of R1 stories can be reverted as a single commit if week-1 KPIs fail — supported by the git workflow, not by runtime config.

---

## 9. Observability

| Concern | Strategy |
|---------|----------|
| Click events | `cross_ref_click` emitted by Provider effect |
| History usage | `nav_history_restore` emitted by Provider effect |
| Disambiguation resolution | `ambiguous_ref_resolve` emitted by Provider effect |
| Latency (KPI #6) | `cross_ref_click.latency_ms` = `performance.now()` delta from the **user event timestamp** (captured at click handler entry on ReferenceToken) to next paint (measured via `requestAnimationFrame` callback after dispatch). This captures the full perceived delay, not just reducer-to-flush time. |
| `matched_snapshot` computation | After `historyBack`/`historyForward` dispatches, the Provider reads the resulting `state` and compares it (deep-equal on `{subTab, selectedItemKey, splitState}`) to the `entries[headIndex]` snapshot. Mismatch indicates a bug; emit `matched_snapshot: false` and log. Fast because snapshots are in-memory. |
| Errors | Existing ErrorBoundary catches render errors; dead-reference/permission paths are non-exceptional (soft-fail via dedicated UI, not exceptions) |

Platform-architect owns the event sink and dashboard panel (per outcome-kpis.md).

---

## 10. Risks (carried from DISCUSS and newly identified)

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | No DIVERGE/DISCOVER; feature may miss the real pain | Low-Med | Ship thin R1; week-1 retention KPI gates R2 |
| R2 | Bare-prose false positives | Med | Deferred to R3; OFF by default (ADR-010) |
| R3 | State coordination across panels | Low | Resolved by ADR-002 (Context+Reducer) |
| R4 | Perf of detection on long markdown | Low | Memoised by `(content, registryVersion)`; AST walk is O(nodes) |
| NEW R5 | Name collision between `selectedKey` (existing list state) and `selectedItemKey` (new reducer state) | Low | Reducer owns; list reads from reducer; remove local `useState` |
| NEW R6 | Memoisation staleness if `registry.version` miscounts | Low | Single write site inside `buildRegistry`; unit test asserts increment on semantic change |
| NEW R7 | Keyboard listener leak across ConfigurationView remounts | Low | `useEffect` cleanup removes listener; tested |
| NEW R8 | Selector-driven re-render hot spots (ADR-002 Negative) | Low | Profile via React DevTools after integration; introduce `useSyncExternalStore`-based selectors only if measured impact. Watch item, not pre-optimisation. |
| NEW R9 | `matched_snapshot` correctness (KPI #4 guardrail) | Low | Deep-equal compare of restored `{subTab, selectedItemKey, splitState}` against the history entry at `headIndex` inside the Provider's post-restore effect; emit `false` + log on mismatch. Property-test the reducer's restore correctness at the fast-check layer. |

No Residuality stressor pass requested (`--residuality` flag absent).

---

## 11. Implementation Order (handoff guidance)

Recommended order for software-crafter, aligned with the walking skeleton:

1. **Domain foundations**: `ReferenceRegistry`, `ScopePrecedence`, `NavHistory`, `ConfigNavState`/`Action`/`Reducer` with exhaustive tests. Pure, no React.
2. **Detection pipeline**: strategies + plugin glue. Test with fixture AST trees.
3. **Provider + hooks**: `ConfigNavProvider`, `useConfigNavState`, `useConfigNavDispatch`, plus the Alt+Left/Right listener effect.
4. **ReferenceToken + DisambiguationPopover + SplitLayout + NavAnnouncer** components. `SplitLayout` ships in R1 **with** its Close button and Esc handler — this pulls US-105 from R2 into R1 because the split mechanism (US-102) is incoherent without a close affordance. DISTILL should target US-105 AC for R1 test coverage accordingly. The remaining US-105 R2 work (if any beyond Close-button ergonomics) stays deferred; current scope of US-105 is Close button + Esc key, both R1.
5. **Integrate into `ConfigDetailPanel` and `ConfigListPanel`** (lift state, dispatch actions).
6. **Add `isActive` plumbing from App.tsx**.
7. **Instrumentation emission** hook.
8. **Accessibility polish + focus management** (US-110, R2).

Each step is independently testable. BDD scenarios from user-stories.md map to integration tests under `tests/integration/plugins/norbert-config/cross-refs/`.

---

## 12. Glossary

- **Reference**: a token in markdown that the detection pipeline identifies as pointing to a config item.
- **ResolvedRef**: the result of resolving a Reference against the registry (`live`/`ambiguous`/`dead`/`unsupported`).
- **SplitState**: exactly-two-pane detail-pane state (ADR-009).
- **Navigation history**: LRU-50 stack of `{subTab, selectedItemKey, splitState}` snapshots (ADR-006).
- **Provider**: `ConfigNavProvider` — Context+Reducer owner and effect edge.

---

## 13. Changelog

- 2026-04-21: Initial DESIGN wave deliverable. Ten ADRs, three C4 levels, one architecture document, one wave-decisions.
- 2026-04-22: §6.3 back-propagation from DELIVER Phase 02 (resolver). `Reference` shape switched from source-syntax discriminant (`markdown-link | inline-code`) to lookup-strategy discriminant (`name | path`); `unsupported` arm gained typed `category` field. Added §6.3 "Changed Assumptions" block documenting rationale and forward references.

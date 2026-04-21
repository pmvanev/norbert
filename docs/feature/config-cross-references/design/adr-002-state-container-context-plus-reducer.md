# ADR-002: React Context + Reducer for Configuration-View-Scoped Navigation State

- **Status**: Accepted
- **Date**: 2026-04-21
- **Deciders**: Morgan, Phil
- **Scope**: config-cross-references feature
- **Supersedes**: none

## Context

Cross-reference navigation requires coordinating four pieces of state that today live in three different components:

- `activeTab: ConfigSubTab` — today inside `ConfigurationView` (`useState`)
- `selectedKey: string | null` — today inside `ConfigurationView` (`useState`)
- `selection: SelectedConfigItem | null` — today lifted to `App.tsx`
- `split_state`, `nav_history_stack` — new, feature-introduced

R3 risk (from DISCUSS) flags that `ConfigDetailPanel` and `ConfigListPanel` are independently controlled by ConfigurationView/App, and US-103 (Ctrl+click) and US-104 (history restore) require **atomic** updates across all four fields. Partial updates are journey-documented bugs (integration_validation: `active_sub_tab + selected_list_item + split_state` tuple must match).

Constraints:

- Functional paradigm: pure reducer, immutable state, typed discriminated unions for actions.
- Scope of state is the Configuration view only. Other Norbert views must not read/write.
- State must not leak across Norbert restarts (OQ-7 decision: no persistence v1).
- No new dependency unless justified (the codebase has no state library today — state is colocated in components + `useRef` at the App level).

## Decision

Introduce **a single React Context per mount of ConfigurationView** named `ConfigNavStore`, whose value is `{ state: ConfigNavState, dispatch: (action: ConfigNavAction) => void }`, produced by a `useReducer` inside a new `ConfigNavProvider` component.

### State shape

```ts
interface ConfigNavState {
  readonly activeSubTab: ConfigSubTab;
  readonly selectedItemKey: string | null;          // matches existing List selectedKey
  readonly splitState: SplitState | null;           // { topRef, bottomRef, dividerRatio }
  readonly history: NavHistory;                     // { entries, headIndex }
  readonly filter: FilterState;                     // { bySubTab: Record<ConfigSubTab, { source: string|null, sort: 'name'|'source' }> }
  readonly popover: DisambiguationState | null;     // { trigger, candidates, highlightedIndex, triggerInteraction }
}
```

### Action shape (discriminated union)

```ts
type ConfigNavAction =
  | { tag: 'selectItem'; subTab: ConfigSubTab; itemKey: string; item: SelectedConfigItem }   // manual list click
  | { tag: 'switchSubTab'; subTab: ConfigSubTab }                                             // manual tab click
  | { tag: 'refSingleClick'; ref: ResolvedRef }                                               // US-102
  | { tag: 'refCtrlClick'; ref: ResolvedRef }                                                 // US-103
  | { tag: 'closeSplit' }                                                                     // US-105
  | { tag: 'historyBack' } | { tag: 'historyForward' }                                        // US-104
  | { tag: 'openDisambiguation'; candidates: readonly ResolvedItem[]; interaction: 'single'|'ctrl' }
  | { tag: 'confirmDisambiguation' } | { tag: 'cancelDisambiguation' }                        // US-108
  | { tag: 'setFilter'; subTab: ConfigSubTab; source: string|null; sort: 'name'|'source' };
```

### Reducer

A pure function `reduce(state, action): ConfigNavState`. Every cross-reference action returns a new immutable state AND (when applicable) appends a history entry. History snapshot construction is inside the reducer — no effect needed.

### Side effects (kept at the edge)

Three effectful operations are isolated outside the reducer via `useEffect` hooks in `ConfigNavProvider`:

1. **Keyboard listener**: Alt+Left/Right (NFR-5). See ADR-003.
2. **Focus management**: imperative refs written when the restored state indicates a specific focal element.
3. **Instrumentation emission**: subscribe to each state transition and emit `cross_ref_click`, `nav_history_restore`, `ambiguous_ref_resolve` events.

## Considered Alternatives

### Alt A: Zustand (or any external store library)
- **Pros**: Battle-tested, less React-idiom overhead, easy selectors.
- **Cons**: New dependency. Bypasses React's render cycle by design, which can conflict with the `useRef`-heavy patterns in `App.tsx` and with the focus-management requirements (need deterministic ordering of state → DOM → focus). Overkill for a single-view-scoped store.
- **Rejected**: new dep not justified for the scope.

### Alt B: Lift state further up into App.tsx
- **Pros**: No new module.
- **Cons**: Puts feature-specific state (history, split, disambiguation popover) in the app shell. Contaminates the App's concerns with plugin-specific logic. Violates the norbert-config plugin boundary.
- **Rejected**: plugin boundary violation.

### Alt C: Two independent state containers (one for list+tab, one for detail+split+history)
- **Pros**: Separation of concerns.
- **Cons**: Ctrl+click must write to both atomically. Two reducers = impossible to make atomic without wrapping them in a higher-level coordinator, which is exactly the Context we're introducing anyway.
- **Rejected**: re-creates the original problem at a different layer.

### Alt D: React Context + useReducer (chosen)
- **Pros**: No new dependency. Reducer is a pure function → testable without React. Atomic updates by construction. Scoped to ConfigurationView mount. Typed via discriminated unions (matches existing plugin's domain patterns in `types.ts`).
- **Cons**: Consumer components that use many fields will re-render on any state change; mitigate by selector hooks (`useConfigNavSelector((s) => s.activeSubTab)`) using `useSyncExternalStore` — this is a local optimisation, not a blocker.
- **Chosen**.

## Consequences

### Positive
- Atomic Ctrl+click / history-restore updates by construction.
- Reducer is pure → property-testable with `fast-check` (existing pattern). The Alt+Left × N → Alt+Right × N → identity property is a natural fit.
- No dependency growth.
- Plugin-boundary-clean: all new state lives inside `src/plugins/norbert-config/`.

### Negative
- Selector optimisation required if profiling shows unnecessary re-renders; acceptable additional complexity.
- Developers new to the code need to learn one reducer and one context — standard React.

### Quality-attribute trade-offs
- **Maintainability** ↑ (one state transition function, exhaustive action union).
- **Testability** ↑ (pure reducer, pure selectors).
- **Performance**: equivalent to Zustand for this scope; selectors keep renders targeted.
- **Conway's Law**: stays inside the norbert-config plugin boundary — one owner.

## Implementation Notes (for software-crafter)

- File layout:
  - `src/plugins/norbert-config/domain/nav/state.ts` — state, action types, initial state
  - `src/plugins/norbert-config/domain/nav/reducer.ts` — pure reducer
  - `src/plugins/norbert-config/domain/nav/history.ts` — pure history stack helpers (push, back, forward, clearForward)
  - `src/plugins/norbert-config/views/nav/ConfigNavProvider.tsx` — Provider + effects
  - `src/plugins/norbert-config/views/nav/hooks.ts` — `useConfigNavState`, `useConfigNavDispatch`, selector hook
- No direct filesystem imports in `domain/nav/` (enforced by dependency-cruiser rule — extend the existing config to forbid Tauri/IPC imports from `domain/`).

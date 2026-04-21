# ADR-009: Split Depth Capped at 2 Panes, Enforced at Type Level (Resolves OQ-3)

- **Status**: Accepted (confirms D1 and D6 from DISCUSS)
- **Date**: 2026-04-21
- **Deciders**: Morgan, Phil
- **Scope**: config-cross-references feature v1

## Context

OQ-3 asked whether the split should cap at 2 panes or support arbitrary nesting. D1 and D6 locked the cap at 2. This ADR documents the type-level enforcement that makes OQ-3 structurally impossible to violate.

## Decision

`SplitState` is a fixed-shape record with exactly two named slots:

```ts
// in domain/nav/split.ts
type SplitState = Readonly<{
  topRef: ConfigItemRef;
  bottomRef: ConfigItemRef;
  dividerRatio: number;  // 0.2..0.8, default 0.5
}>;
type DetailLayout = null | SplitState;  // null = single-pane
```

There is no `panes: readonly ConfigItemRef[]` array. There is no recursive `SplitState.bottom: DetailLayout`. Adding a third pane requires a type-level change — caught at compile time.

### Pane role invariants

- `topRef` is the **anchor** (the source item).
- `bottomRef` is the **preview slot** (where single-click / bottom-replacement writes).
- Ctrl+click collapses the split (sets `DetailLayout = null`) and renders the target as the new single pane.
- The invariant `splitState !== null ⇒ selectedItemKey === topRef.key` must hold at all times. Violation = bug.

## Considered Alternatives

### Alt A: Dynamic array of panes
- **Cons**: Adds nothing over fixed-shape for the 2-pane case. Makes invariant "no third pane" into a runtime rule that can break.
- **Rejected**.

### Alt B: Recursive `SplitState { top, bottom: DetailLayout }` (tree)
- **Cons**: Permits arbitrary nesting. Rejected by D1. Adds UI complexity (where does focus go? resize UX?) for no demonstrated use case.
- **Rejected**.

### Alt C: Fixed 2-slot record (chosen)
- **Chosen**.

## Consequences

### Positive
- `US-106` AC "pane structure stays 1 top + 1 bottom" is structurally impossible to violate.
- Reducer implementation simpler: `refSingleClick` writes `splitState = { topRef, bottomRef: newRef, dividerRatio: ... }`.
- Swap-top-and-bottom (US-115, R3) is a one-line transformation `{ topRef: s.bottomRef, bottomRef: s.topRef, dividerRatio: s.dividerRatio }`.

### Negative
- Any future demand for 3-pane will require a type-system change. Acceptable; R3 deferred.

### Quality-attribute trade-offs
- **Correctness** ↑↑ (invariant at compile time).
- **Simplicity** ↑.

## Implementation Notes (for software-crafter)

- `ConfigItemRef` is a narrow structural ref: `{ subTab: ConfigSubTab; itemKey: string }`. Do NOT embed the full `SelectedConfigItem` into `SplitState` — it causes deep copies in history entries and couples history shape to item-shape evolution.
- Preview rendering resolves `ConfigItemRef → SelectedConfigItem` by registry lookup at render time. If the item is gone, render the "item was removed" error panel (US-109; R2).
- `dividerRatio` is clamped to `[0.2, 0.8]` in a pure helper.

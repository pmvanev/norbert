# ADR-007: Filter-Bar Reset Only When Filter Would Hide the Target (Resolves OQ-1)

- **Status**: Accepted
- **Date**: 2026-04-21
- **Deciders**: Morgan, Phil
- **Scope**: config-cross-references feature v1

## Context

On Ctrl+click that crosses sub-tabs (US-103), the destination sub-tab may have an active source filter from a prior session (e.g. filtering Skills to `user` scope). If the Ctrl+click target is a plugin-scope skill, naive preservation would cause the list to not show the target, breaking the US-103 AC "list pane scrolls so the selected row is visible".

Three options from OQ-1:

1. Always preserve filter (respect user intent).
2. Always reset filter (reveal the target).
3. Reset only if the filter would hide the target.

## Decision

**Option 3: Reset only if the filter would hide the target.**

### Algorithm (pure function)

```ts
// in domain/nav/filter.ts
function resolveFilterOnNav(
  currentFilter: FilterState,
  targetSubTab: ConfigSubTab,
  targetItem: ResolvedItem,
): FilterState {
  const currentSubTabFilter = currentFilter.bySubTab[targetSubTab];
  const itemSourceLabel = sourceLabel(targetItem.scope, targetItem.source);
  const wouldHide =
    currentSubTabFilter.source !== null &&
    currentSubTabFilter.source !== itemSourceLabel;

  return wouldHide
    ? { ...currentFilter, bySubTab: { ...currentFilter.bySubTab, [targetSubTab]: { ...currentSubTabFilter, source: null } } }
    : currentFilter;
}
```

Sort mode is **never** reset — it only affects display order.

The reducer calls `resolveFilterOnNav` as part of the `refCtrlClick` action handler.

### UX affordance

When the filter is reset by this rule, a subtle inline status line appears at the top of the list pane for 3 seconds: "Filter cleared to show target." This preserves the "nothing happens silently" property of the design without adding a modal or requiring a click.

## Considered Alternatives

### Alt A: Always preserve (OQ-1 option 1)
- **Cons**: Violates US-103 "scrolls so the selected row is visible" — there's no row to scroll to if the filter hides it.
- **Rejected**.

### Alt B: Always reset (OQ-1 option 2)
- **Cons**: Power users who intentionally filter a tab and then Ctrl+click within it (same sub-tab) lose their filter unnecessarily.
- **Rejected**.

### Alt C: Conditional reset (OQ-1 option 3, chosen)
- **Pros**: Respects intent when possible, guarantees target visibility otherwise. Transparent via status line.
- **Chosen**.

### Alt D: Open a confirmation modal
- **Cons**: Friction. Breaks the Ctrl+click atomicity contract.
- **Rejected**.

## Consequences

### Positive
- US-103 AC "list pane scrolls so the selected row is visible" trivially satisfied.
- User's explicit filter intent honoured in the 95% case (within-sub-tab navigation, or cross-sub-tab where target matches current filter).
- Pure function, testable in isolation.

### Negative
- One subtle UI element (3-second status line) to design and implement.
- Adds one more test case per sub-tab in the state machine coverage.

### Quality-attribute trade-offs
- **Usability** ↑ (user never sees "the item isn't in the list" after Ctrl+click).
- **Transparency** ↑ (status line explains the reset).
- **Complexity**: slight increase.

## Implementation Notes (for software-crafter)

- `sourceLabel` helper already exists in `src/plugins/norbert-config/views/ConfigListPanel.tsx` — extract to `views/shared.tsx` or `domain/nav/filter.ts` for reuse.
- Status line: a new small component. Uses `sec-hdr` style. Auto-dismiss timer lives in Provider effect (clearable on unmount).

# ADR-008: Manual Navigation Does Not Push History (Resolves OQ-2)

- **Status**: Accepted
- **Date**: 2026-04-21
- **Deciders**: Morgan, Phil
- **Scope**: config-cross-references feature v1

## Context

OQ-2 asked whether manual navigation — clicking a row in the list pane, or clicking a sub-tab directly — should push a history entry.

The feature's core promise is retracing a **reference chain**. Alt+Left/Right exist to let the user travel back along the chain of references they clicked. Treating sub-tab clicks or list-row clicks as "history" would:

- Conflate mode switches with navigation (a sub-tab click is a category switch, not following a reference).
- Require Alt+Left to replay list-scrolling, which has no semantic value.
- Make the history stack fill with low-value entries, evicting the actually-useful reference-click entries faster.

## Decision

**Only these actions push history entries:**

| Action | Story | Push? |
|--------|-------|-------|
| `refSingleClick` (single-click on live reference) | US-102 | **yes** |
| `refCtrlClick` (Ctrl+click on live reference) | US-103 | **yes** |
| Single-click replacing bottom pane in an open split | US-106 | **yes** |
| `closeSplit` (Esc or Close button) | US-105 | **yes** |
| Disambiguation popover confirmed | US-108 | **yes** (inherits triggering interaction's semantics) |
| `selectItem` (manual list-row click) | existing | **no** |
| `switchSubTab` (manual sub-tab click) | existing | **no** |
| Dead-reference click | US-107 | **no** (no-op) |
| Filter change | existing | **no** |

Sub-tab or list-row selection performed as a side-effect of a reference action (Ctrl+click) does push — because the push is attributed to the reference action, not the selection.

### Provenance guarantee

Every history entry carries provenance: `{ source: 'refSingleClick' | 'refCtrlClick' | 'bottomReplace' | 'closeSplit' | 'disambiguation' }`. Instrumentation emits this so post-release analysis can validate that no non-reference action sneaked a push.

## Considered Alternatives

### Alt A: Browser-like — every navigation pushes
- **Pros**: Familiar mental model.
- **Cons**: Alt+Left would replay sub-tab clicks users never intended as "navigation". Dilutes reference-chain value. Cap fills too fast.
- **Rejected**.

### Alt B: Push list-row clicks, not sub-tab clicks
- **Pros**: Arguably list-row clicks are navigation.
- **Cons**: Creates an arbitrary distinction. When is a manual click "navigation" vs "mode switch"? No clean answer. Users would be confused about what Alt+Left does after a sequence.
- **Rejected**.

### Alt C: Only reference actions push (chosen)
- **Pros**: Alt+Left has one meaning: "take me back along the reference chain I clicked." Easy to explain. Easy to predict.
- **Chosen**.

## Consequences

### Positive
- Crisp mental model: Alt+Left is the reference-chain timeline, nothing else.
- History entries are high-value by construction.
- Minimal surprise: users who explore sub-tabs manually don't get Alt+Left taking them back to a random list position.

### Negative
- A user who Ctrl+clicks to a skill, then manually scrolls the list to a different skill and reads it, cannot Alt+Left to return to the first skill — they have to remember the path. Mitigation: the Ctrl+click action is documented as the way to preserve back-traversability. This is a small friction for a clear mental model.

### Quality-attribute trade-offs
- **Usability**: clearer model ↑, small corner-case friction ↓. Net positive.
- **Predictability** ↑.

## Implementation Notes (for software-crafter)

- The reducer's `selectItem` and `switchSubTab` actions explicitly do NOT call `pushEntry` on the history slot.
- Unit test: for every action in the `ConfigNavAction` union, assert whether `state.history.entries.length` increases — encoded as a truth table in the test file.
- Property test: `|history.entries|` only changes on the actions listed in the "yes" column of the table above.

# ADR-003: Alt+Left / Alt+Right Scoping via Ref-Gated Window Listener

- **Status**: Accepted
- **Date**: 2026-04-21
- **Deciders**: Morgan, Phil
- **Scope**: config-cross-references feature
- **Supersedes**: none

## Context

D4 (from DISCUSS): Alt+Left / Alt+Right must act ONLY when the Configuration view is the active top-level Norbert view. NFR-5 asks DESIGN to verify there is no collision with existing shortcuts.

Survey findings:

- `src/main.tsx` registers a single `document.addEventListener("keydown", …)` that calls `resolveShortcut` from `src/domain/keyboardShortcuts.ts`.
- `resolveShortcut` handles: Ctrl/Cmd+Shift+N (new window), Ctrl/Cmd+Shift+Q (quit-all), Ctrl/Cmd+q (close-window), Ctrl/Cmd + `=`/`-`/`0` (zoom). No Alt combinations. No Left/Right arrow combinations.
- Sidebar click in `App.tsx` assigns a view to the main zone and tracks it via `layout.zones.get("main")?.viewId`. This is the authoritative "which top-level view is active" state.
- Nothing else in `src/` calls `addEventListener("keydown", …)` or handles Alt/ArrowLeft/ArrowRight.

**Verdict**: No existing binding conflicts with Alt+Left / Alt+Right. NFR-5 passes without modification.

## Decision

Scoping mechanism: a **window-level keydown listener** installed inside `ConfigNavProvider` via `useEffect`, gated by two conditions evaluated synchronously at event time:

1. The Configuration view must be mounted (guaranteed because the listener is installed in the Provider's effect — unmounting removes it).
2. The Configuration view must be the **active top-level view**. This is signalled via an `isActive: boolean` prop passed down to `ConfigNavProvider` from the app shell, derived from `layout.zones.get("main")?.viewId === "configuration"`.

The listener reads `isActive` from a ref (not closure) to avoid re-binding on every `isActive` change. Pseudo-contract:

```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (!isActiveRef.current) return;
    if (!(e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))) return;
    if (shouldIgnoreTarget(e.target)) return;  // skip when typing in input/textarea/contenteditable
    e.preventDefault();
    dispatch(e.key === 'ArrowLeft' ? { tag: 'historyBack' } : { tag: 'historyForward' });
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);  // stable: handler reads from refs
```

`shouldIgnoreTarget` is a pure helper: `(t: EventTarget) => boolean`.

Esc for split-close (US-105) is handled by an element-level `onKeyDown` on the split container — NOT window-level — so it only fires when focus is inside the split.

## Considered Alternatives

### Alt A: Global registry + dispatcher (extend `resolveShortcut`)
- **Pros**: Single source of truth for keybindings.
- **Cons**: Feature-specific bindings pollute the app-shell shortcut module. Couples `norbert-config` plugin to `src/domain/keyboardShortcuts.ts`. Every plugin would need to add cases → shortcut explosion.
- **Rejected**: plugin boundary violation.

### Alt B: Element-level `onKeyDown` on the Configuration-view root
- **Pros**: Naturally scoped — only fires when focus is inside the view.
- **Cons**: Alt+Left/Right must work even if focus is on the **list pane** or on a **sidebar button** inside the Configuration view region — we need the shortcut regardless of which element has focus, provided the top-level view is Configuration. React's `onKeyDown` only fires when focus is actually inside the element (bubbling). Also breaks when focus is briefly on `document.body`.
- **Rejected**: user-story AC ("Alt+Left/Right work regardless of current focus within Configuration view" — US-110 AC) fails.

### Alt C: Window listener gated by `isActive` (chosen)
- **Pros**: Works regardless of focus element inside the active view. Cleanly de-scopes to other top-level views (falls through). Minimal coupling — one prop (`isActive`) passed down.
- **Cons**: Must be careful with input/textarea/contenteditable elements (user typing in a filter bar shouldn't see Alt+Left hijacked). Handled via `shouldIgnoreTarget`.
- **Chosen**.

### Alt D: Register via main.tsx like existing shortcuts
- **Pros**: Consistency with existing pattern.
- **Cons**: Pattern is app-level (zoom, windowing). This binding is plugin-level. Wrong layer.
- **Rejected**.

## Consequences

### Positive
- Clean plugin boundary — no changes to `src/domain/keyboardShortcuts.ts` or `src/main.tsx`.
- Passes US-104 AC: "Alt+Left/Right work regardless of current focus (within Configuration view)".
- Falls through when another view is active — passes "Alt+Left only acts within Configuration view" scenario.
- Unit-testable: the handler is a pure function of `(event, isActiveRef, dispatch)` — tested by dispatching synthetic `KeyboardEvent` objects against mocked refs.

### Negative
- Requires the app shell to pass `isActive` down to the provider. This is one new prop on `ConfigurationView`. Low cost.

### Quality-attribute trade-offs
- **Usability** ↑ (shortcut works as power users expect — focus-agnostic).
- **Maintainability** ↑ (plugin-scoped; no app-shell entanglement).
- **Security**: no new attack surface (Alt+Left/Right is a read-only op; does not invoke external APIs).

## Implementation Notes (for software-crafter)

- `shouldIgnoreTarget` should treat as "ignore" when target is: `<input>`, `<textarea>`, `<select>`, or any element with `contenteditable="true"`. Reuse the pattern from any existing Norbert shortcut code if one emerges; otherwise introduce in `domain/nav/keyboardUtils.ts`.
- End-of-history cue (US-104 AC): when Alt+Left at index 0 or Alt+Right at `history.length-1` is dispatched, the reducer emits a transient `endOfHistory: 'back'|'forward'` flag that the Provider subscribes to and triggers a CSS `animation` class on the detail pane root for ~300 ms. The flag auto-clears via a timer effect. **The `setTimeout` that dispatches `{ tag: 'clearEndOfHistory' }` lives in a `useEffect` inside `ConfigNavProvider` that watches `state.endOfHistory`; the reducer itself never calls `setTimeout` or any side-effectful API. This keeps the reducer pure and preserves the FP paradigm constraint (CLAUDE.md).** The effect cleans up its timeout on unmount or on the next `endOfHistory` change to avoid overlapping timers.

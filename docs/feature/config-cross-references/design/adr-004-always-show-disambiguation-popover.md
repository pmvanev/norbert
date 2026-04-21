# ADR-004: Always Surface the Disambiguation Popover (No Silent Precedence Resolution)

- **Status**: Accepted (confirms D3 from DISCUSS and resolves OQ-5)
- **Date**: 2026-04-21
- **Deciders**: Morgan, Phil
- **Scope**: config-cross-references feature

## Context

Claude Code configs idiomatically allow the same name across scopes (a project-scope `release` command alongside a user-scope `release` command is common). When a markdown reference resolves to multiple items, the feature must choose.

KPI #5 is an explicit trust guardrail: **100% of ambiguous reference interactions must route through the disambiguation popover; 0% silent precedence picks.**

OQ-5 asked for the precedence order. OQ-5 did NOT ask whether we should surface or pick silently (that was already locked as D3).

## Decision

Two-part decision, both locked:

1. **Scope precedence order**: `project > plugin > user` (matches Claude Code's own resolution order). This only affects **which candidate is pre-highlighted** in the popover — never a silent navigation.
2. **Always show the popover** for references resolving to ≥2 items. Single-click, Ctrl+click, Enter, Ctrl+Enter all route through the popover. Arrow keys change the highlight; Enter confirms; Esc cancels.

No silent fallback. The pre-highlight is a keyboard-efficiency aid: pressing Enter immediately confirms the Claude-Code-default resolution without the user having to navigate the popover. Nothing about this is hidden from the user.

## Considered Alternatives

### Alt A: Silent precedence with a subtle visual cue (e.g. a small scope badge next to the token)
- **Pros**: Fewer clicks for power users.
- **Cons**: Scope badge reads as metadata, not a choice. Users learn to ignore it. First time a user expects the user-scope `release` and gets the project-scope one, they blame the feature. Breaks the "I can trust the UI" emotional promise.
- **Rejected** by D3. This ADR reaffirms that rejection.

### Alt B: Configurable behaviour (user setting: silent vs always-popover)
- **Pros**: Power users who understand precedence can turn the popover off.
- **Cons**: Adds a setting. Setting means documentation, a default, and a support question: "why did it navigate to the wrong one?" — answered by "check the setting." Doubles the number of navigation behaviours to test.
- **Rejected** for v1. Revisit post-R2 if data shows popover friction.

### Alt C: Remember-my-choice per session (US-112 R3 story)
- **Pros**: Reduces friction after first choice.
- **Cons**: Creates "why did it navigate somewhere different from last time?" confusion when a session-state expires. Deferred to R3 where its own dedicated story can explore the UX.
- **Deferred** — appropriate for a later release, not a swap for the always-popover default.

### Alt D: Always popover with project>plugin>user pre-highlight (chosen)
- **Pros**: Zero silent surprises. Power users can press Enter immediately if the pre-highlight is right (which matches Claude Code's default for 80% of cases). Keyboard-first workflow (Ravi persona) is not taxed.
- **Chosen**.

## Consequences

### Positive
- KPI #5 guardrail trivially satisfied (no code path can silently resolve).
- Instrumentation: `ambiguous_ref_resolve` event with `method: popover` always, `method: silent_precedence` impossible.
- Scope precedence order is a single constant `SCOPE_PRECEDENCE: readonly ConfigScope[] = ['project', 'plugin', 'user']` living in `domain/nav/scope.ts`. Unit-testable in isolation.

### Negative
- Power users may find the popover mildly friction-adding for trivial cases. Mitigated by pre-highlight + Enter.
- Keyboard flow: Tab-focus → Enter opens popover → (arrow keys) → Enter confirms. Two Enter presses for non-default choice. Acceptable.

### Quality-attribute trade-offs
- **Usability / trust** ↑↑ (core feature promise).
- **Efficiency** ↓ slightly for power users; mitigated.
- **Correctness**: unambiguous behaviour contract.

## Implementation Notes (for software-crafter)

- Popover is a new controlled component in `views/references/DisambiguationPopover.tsx`.
- Does NOT require a new dependency — can be a plain absolutely-positioned `<div role="dialog">` with focus trap.
- Focus trap: on open, focus first candidate; Tab and Shift+Tab cycle within candidates; Esc returns focus to the triggering token.
- Positioning: bottom-left of trigger, flip to top-left if viewport clipping detected. Pure function `computePopoverPosition(triggerRect, popoverSize, viewport): { top, left }` testable in isolation.

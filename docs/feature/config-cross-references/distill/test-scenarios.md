# Test Scenarios Inventory: config-cross-references

Wave: DISTILL (revision cycle 1)
Feature: `config-cross-references` (extends `norbert-config` plugin)
Author: Quinn (acceptance-designer)
Date: 2026-04-21

> **Revision cycle 1 changes**: instrumentation event coverage (PA BLOCKER),
> resolver.test.ts + unsupported variant (SA HIGH + PO MEDIUM), 500-item
> registry build NFR-2 scenario (PA HIGH), matched_snapshot field check (PA
> HIGH), end-of-history timer effect (SA MEDIUM), Tab focus trap (PO+PA
> MEDIUM), reframed Ctrl+click atomicity Then step (SA MEDIUM), and the
> Architectural Enforcement (DEVOPS Wave) section (PA MEDIUM). Total scenario
> count rises from 49 to 64 (see Error path coverage section).

This document is the scenario inventory by story and the KPI tag mapping for
the acceptance tests under `tests/acceptance/config-cross-references/`.

## Files produced

### Feature files (Gherkin)

- `tests/acceptance/config-cross-references/walking-skeleton.feature`
- `tests/acceptance/config-cross-references/milestone-1-resolution-and-disambiguation.feature`
- `tests/acceptance/config-cross-references/milestone-2-robustness.feature`

### Vitest implementations

- `tests/acceptance/config-cross-references/registry.test.ts` -- pure ReferenceRegistry (driving port: `buildRegistry`, `lookupByName`, `lookupByPath`)
- `tests/acceptance/config-cross-references/resolver.test.ts` -- pure ReferenceResolver (driving port: `resolve(ref, registry)`) **[NEW in rev 1]**
- `tests/acceptance/config-cross-references/reducer.test.ts` -- pure ConfigNavReducer (driving port: `reduce(state, action)`)
- `tests/acceptance/config-cross-references/history.test.ts` -- pure NavHistory LRU stack (driving ports: `pushEntry`, `goBack`, `goForward`)
- `tests/acceptance/config-cross-references/detection.test.ts` -- pure detection remark plugin (driving port: `detectionRemarkPlugin(registry, ctx)`)
- `tests/acceptance/config-cross-references/announcements.test.ts` -- pure NavAnnouncer helper (driving port: `announcementFor(prev, next)`)
- `tests/acceptance/config-cross-references/scope-precedence.test.ts` -- pure ScopePrecedence (driving port: `preHighlight(candidates)`)
- `tests/acceptance/config-cross-references/provider.test.tsx` -- React component-level scenarios (driving ports: `<ConfigNavProvider>`, `<ReferenceToken>`, `<DisambiguationPopover>`)
- `tests/acceptance/config-cross-references/instrumentation.test.tsx` -- React-layer event-emission scenarios (driving port: `<ConfigNavProvider>` with the `eventSink` test seam) **[NEW in rev 1]**

### Event-sink test seam (chosen for instrumentation scenarios)

Per architecture sec 5.3, the three observability events
(`cross_ref_click`, `nav_history_restore`, `ambiguous_ref_resolve`) are emitted
from a `useEffect` inside `ConfigNavProvider` -- never from inside the pure
reducer. To assert event payloads at the acceptance layer without spying on
internal functions, the Provider exposes a public test seam:

```ts
type InstrumentationEvent =
  | { type: "cross_ref_click";       /* sec 5.3 fields */ }
  | { type: "nav_history_restore";   /* sec 5.3 fields */ }
  | { type: "ambiguous_ref_resolve"; /* sec 5.3 fields */ };

type EventSink = (e: InstrumentationEvent) => void;

// Either form is acceptable; DELIVER chooses one consistently.
//   (a) Prop:    <ConfigNavProvider eventSink={sink}>
//   (b) Setter:  setEventSink(sink) called once before render in tests
```

Default in production: a no-op sink (or one that forwards to the real
telemetry adapter). In tests the sink is a capturing `(e) => events.push(e)`.
This is a boundary-level seam, not an internal-function spy. The DELIVER
crafter picks one form and wires it through the Provider's `useEffect`.

### Helpers

- `tests/acceptance/config-cross-references/_helpers/tauriMock.ts` -- mock for `@tauri-apps/api/core`'s `invoke`
- `tests/acceptance/config-cross-references/_helpers/fixtures.ts` -- `AggregatedConfig` builders (skills, commands, agents, hooks, plugins, etc.)
- `tests/acceptance/config-cross-references/_helpers/markdownFixtures.ts` -- markdown bodies exercising every detection rule

## Scenario coverage by story

### R1 / Walking Skeleton

| Story | AC bullet | Scenario | File | Tag |
|-------|-----------|----------|------|-----|
| US-101 | markdown link -> live token | Markdown link to a known skill renders as a live cross-reference token | walking-skeleton.feature | @walking_skeleton @driving_port @kpi |
| US-101 | inline code matching known name | Inline code matching a known agent renders as a live cross-reference token | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-101 | fenced block excluded | Content inside fenced code blocks is never linkified | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-101 + ADR-010 | bare prose OFF v1 | Bare prose is not detected as a reference in v1 | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-101 | dead variant | Reference to a missing item renders as a dead token | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-101 | ambiguous variant | Reference resolving to multiple items renders as an ambiguous token | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-101 | unsupported variant **[rev 1]** | Reference to an unsupported item type renders as an unsupported token | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-101 + arch sec 6.3 | resolver: live | Resolving a reference whose name matches a single registry entry returns the live outcome | resolver.test.ts | @walking_skeleton @driving_port |
| US-101 + arch sec 6.3 | resolver: ambiguous | Resolving a reference whose name matches two or more registry entries returns the ambiguous outcome | resolver.test.ts | @walking_skeleton @driving_port |
| US-101 + arch sec 6.3 | resolver: dead | Resolving a reference that matches no registry entry returns the dead outcome with the searched scopes | resolver.test.ts | @walking_skeleton @driving_port |
| US-101 + arch sec 6.3 | resolver: unsupported **[rev 1]** | Resolving a file-path reference to an item type the plugin does not expose returns the unsupported outcome | resolver.test.ts | @walking_skeleton @driving_port |
| US-101 | detection: unsupported variant **[rev 1]** | Reference to an unsupported item type renders as an unsupported token | detection.test.ts | @walking_skeleton @driving_port |
| Architecture seam (sec 6.1) | aggregatedConfig=null | Loading state with no aggregated configuration renders no tokens and no crash | walking-skeleton.feature | @walking_skeleton @driving_port |
| NFR-2 (arch sec 7) | 500-item registry build **[rev 1]** | buildRegistry with 500 items completes synchronously and produces the correct entry count | registry.test.ts | @property @performance @driving_port |
| US-102 | single-click peek | Single-click on a live reference opens a vertical split with the target previewed | walking-skeleton.feature | @walking_skeleton @driving_port @kpi |
| US-102 | Enter == single-click | Keyboard Enter on a focused live reference behaves as single-click | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-106 (R1 enforcement) | bottom replaced from top | Single-click in an open split replaces the bottom pane only | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-106 (R1 enforcement) | bottom replaced from bottom | Single-click in the bottom pane replaces the bottom pane and preserves the top anchor | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-103 | atomic 4-field commit | Ctrl+click across sub-tabs switches sub-tab, list selection, and detail in one atomic update | walking-skeleton.feature | @walking_skeleton @driving_port @kpi |
| US-103 | within-sub-tab swap | Ctrl+click within the same sub-tab swaps only the list selection and detail | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-103 | split reset on Ctrl+click | Ctrl+click closes any open split as part of the commit | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-103 | Ctrl+Enter == Ctrl+click | Keyboard Ctrl+Enter on a focused live reference behaves as Ctrl+click | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-103 + ADR-007 | filter preserved when target visible | Ctrl+click preserves a filter that already shows the target | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-103 + ADR-007 | filter reset when target hidden | Ctrl+click resets the destination filter when it would hide the target | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-104 | Alt+Left restores | Alt+Left restores the previous navigation snapshot | walking-skeleton.feature | @walking_skeleton @driving_port @kpi |
| US-104 | Alt+Right re-advances | Alt+Right re-advances after going back | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-104 | new action clears forward | A new cross-reference action after Alt+Left clears the forward stack | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-104 | end-of-history cue | Alt+Left at the start of history is a no-op with end-of-history cue | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-104 | end-of-history cue (forward) **[rev 1]** | Alt+Right at the end of history is a no-op with end-of-history cue | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-104 (history.test.ts) | goForward at end **[rev 1 docs]** | Alt+Right at end of history is a no-op (goForward returns same history) | history.test.ts | @walking_skeleton @driving_port |
| US-104 + ADR-003 + arch sec 6.6 | end-of-history timer effect **[rev 1]** | Alt+Left at the start of history shows then auto-clears the end-of-history cue | provider.test.tsx | @walking_skeleton @driving_port |
| US-104 + ADR-003 | scoped to view | Alt+Left does not act when another top-level view is active | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-104 + ADR-008 | manual select no push | Manual list-row selection does not push a history entry | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-104 + ADR-008 | manual sub-tab no push | Manual sub-tab switch does not push a history entry | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-104 + ADR-006 | LRU 50 cap | For any sequence of navigation actions the history never exceeds 50 entries | walking-skeleton.feature | @walking_skeleton @driving_port @property |
| US-107 | dead single-click no-op | Single-click on a dead reference is a complete no-op | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-107 | dead Ctrl+click no-op | Ctrl+click on a dead reference is a complete no-op | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-107 | dead tooltip on focus | Dead reference exposes its tooltip on keyboard focus | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-105 (R1 pull-forward) | Close button | Close button collapses the split back to a single pane | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-105 (R1 pull-forward) | Esc inside split | Esc with focus inside the split collapses the split back to a single pane | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-105 (R1 pull-forward) | Esc no-op outside split | Esc with no split open is not intercepted by this feature | walking-skeleton.feature | @walking_skeleton @driving_port |
| US-102 + US-110 | bottom pane preview fields **[rev 1]** | The bottom pane preview displays type, scope, name, source path, and content for a normal preview | provider.test.tsx | @walking_skeleton @driving_port |
| US-103 | Ctrl+click default suppressed **[rev 1]** | Ctrl+click on a live reference suppresses the browser/OS default link behaviour | provider.test.tsx | @walking_skeleton @driving_port |

### R2 / Milestone 1 -- Disambiguation (US-108)

| AC bullet | Scenario | File | Tag |
|-----------|----------|------|-----|
| popover always shown on ambiguous | Single-click on an ambiguous reference opens the disambiguation popover | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port @kpi |
| pre-highlight project>plugin>user | Disambiguation popover pre-highlights project over plugin over user | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port |
| pre-highlight fallback | When no project candidate exists the plugin-scope candidate is pre-highlighted | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port |
| Enter confirms pre-highlight | Confirming the pre-highlighted candidate with Enter applies single-click semantics | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port |
| arrow key navigation (Down) | Arrow Down moves the highlight to the next candidate | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port |
| arrow key navigation (Up) **[rev 1]** | Arrow Up moves the highlight to the previous candidate | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port |
| confirm non-default | Confirming a non-default candidate applies single-click semantics to that candidate | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port |
| Ctrl+click semantics through popover | Confirming through a Ctrl+click-triggered popover applies Ctrl+click semantics | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port |
| Esc cancels | Esc cancels the disambiguation popover with no side effects | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port @kpi |
| ARIA dialog + announce | Disambiguation popover is announced to assistive technology when opened | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port |
| Tab focus trap (WCAG 2.1.2) **[rev 1]** | Tab inside the open disambiguation popover keeps focus within the popover | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port |
| Shift+Tab wrap (WCAG 2.4.3) **[rev 1]** | Shift+Tab from the first candidate wraps focus within the popover | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port |
| Tab focus trap (component-level) **[rev 1]** | Tab inside the open disambiguation popover keeps focus within the popover | provider.test.tsx | @milestone-1 @driving_port |
| Shift+Tab wrap (component-level) **[rev 1]** | Shift+Tab from the first candidate wraps focus to the last candidate within the popover | provider.test.tsx | @milestone-1 @driving_port |
| no silent fallback (KPI #5 guardrail) | For any ambiguous reference, the popover always opens regardless of trigger | milestone-1-resolution-and-disambiguation.feature | @milestone-1 @driving_port @property |

### R2 / Milestone 2 -- Robustness (US-106 invariants, US-109, US-110)

| Story | AC bullet | Scenario | File | Tag |
|-------|-----------|----------|------|-----|
| US-106 | dead-click in bottom no-op | Click on a dead reference inside the bottom pane does not replace the bottom | milestone-2-robustness.feature | @milestone-2 @driving_port |
| US-106 + ADR-009 | type-level 2-pane invariant | For any sequence of single-clicks on live references, the split is always exactly 2 panes | milestone-2-robustness.feature | @milestone-2 @driving_port @property |
| US-106 + architecture sec 6.7 | top==selected invariant | When the split is open the selected list item key always equals the top pane reference key | milestone-2-robustness.feature | @milestone-2 @driving_port @property |
| US-109 | deleted-mid-click toast | Reference target deleted between render and click surfaces a soft-fail toast | milestone-2-robustness.feature | @milestone-2 @driving_port @infrastructure-failure |
| US-109 | permission-denied panel | Permission denied at click time opens the split with a permission-denied panel | milestone-2-robustness.feature | @milestone-2 @driving_port @infrastructure-failure |
| US-109 | retry recovers | Retry recovers the bottom pane after the user fixes permissions | milestone-2-robustness.feature | @milestone-2 @driving_port @infrastructure-failure |
| US-109 | history works after soft-fail | History navigation still works after a soft-failure | milestone-2-robustness.feature | @milestone-2 @driving_port @infrastructure-failure |
| US-110 | full keyboard chain | Keyboard-only path peek then commit then back | milestone-2-robustness.feature | @milestone-2 @driving_port |
| US-110 | focus to list-row after Ctrl+click | After Ctrl+click commit the focus moves to the new selected list row | milestone-2-robustness.feature | @milestone-2 @driving_port |
| US-110 | focus returns post-disambiguation | After disambiguation confirmation focus returns to the triggering reference token | milestone-2-robustness.feature | @milestone-2 @driving_port |
| US-110 + architecture 6.8 | ARIA live region announcements | Each pane transition is announced via the ARIA live region | milestone-2-robustness.feature | @milestone-2 @driving_port |
| US-110 + ADR-003 | input/textarea opt-out | Alt+Left is ignored while typing inside an input or textarea | milestone-2-robustness.feature | @milestone-2 @driving_port |

### Instrumentation events (architecture sec 5.3) **[NEW in rev 1]**

These scenarios live in `instrumentation.test.tsx` and assert the three KPI
events at the React Provider boundary via the `eventSink` test seam.

| Event | Scenario | Tag |
|-------|----------|-----|
| `cross_ref_click` (KPI #1, KPI #6) | After a live single-click the cross_ref_click event is emitted with the section 5.3 schema | @kpi @driving_port |
| `nav_history_restore` (KPI #4, matched_snapshot=true) | After Alt+Left the nav_history_restore event is emitted with direction=back and matched_snapshot=true | @kpi @driving_port |
| `nav_history_restore` (KPI #4, matched_snapshot=false) | When the restored state diverges from the recorded snapshot the event reports matched_snapshot=false and the divergence is logged | @kpi @driving_port @infrastructure-failure |
| `ambiguous_ref_resolve` (KPI #5) | After confirming a candidate in the disambiguation popover the ambiguous_ref_resolve event is emitted with method=popover | @kpi @driving_port |
| Emission-point invariant (ADR-002 + ADR-003 + FP) | Dispatching an action directly through the pure reducer emits no instrumentation events; dispatching through the Provider does | @driving_port |

The provider.test.tsx scenario "Alt+Left restores the previous snapshot and the
captured nav_history_restore event reports matched_snapshot=true" pairs the
DOM-level restoration assertion with the field-presence check on the event
payload, so DELIVER sees both halves of the contract together.

## R3 stories explicitly excluded

R3 stories US-111, US-112, US-113, US-114, US-115 are intentionally NOT covered
by acceptance tests in this DISTILL pass:

- **US-111 (bare-prose toggle)**: ADR-010 ships bare-prose detection OFF in v1
  with NO setting infrastructure. Architecture exposes no extension point yet
  (the pipeline is a const `DETECTION_PIPELINE` array). Adding tests now would
  test imaginary code. Defer until US-111's own DESIGN/DISTILL pass introduces
  the setting + strategy slot.
- **US-112 (remember-my-choice for ambiguous)**: deferred per ADR-004 Alt C; no
  architecture slot.
- **US-113, US-114, US-115**: out of scope for v1 architecture.

A scenario referencing a non-existent extension point would fail in DELIVER not
because the behaviour is wrong but because the seam doesn't exist -- a Testing
Theater anti-pattern.

## KPI tag mapping

`@kpi` scenarios verify behaviour that ties directly to a guardrail or primary
KPI from `discuss/outcome-kpis.md`:

| KPI | Guardrail | Scenarios tagged @kpi |
|-----|-----------|-----------------------|
| KPI #1 cross-reference click success rate | Primary | DOM-level: "Markdown link to a known skill renders as a live cross-reference token", "Single-click on a live reference opens a vertical split", "Ctrl+click across sub-tabs...". Event-level (rev 1): "After a live single-click the cross_ref_click event is emitted with the section 5.3 schema" (instrumentation.test.tsx). |
| KPI #4 history reliability (matched_snapshot) | Reliability | DOM-level: "Alt+Left restores the previous navigation snapshot" asserts `restored state matches the previous history snapshot exactly`. Event-level (rev 1): "After Alt+Left the nav_history_restore event is emitted with direction=back and matched_snapshot=true" + the divergence scenario "When the restored state diverges from the recorded snapshot ... matched_snapshot=false and the divergence is logged" (instrumentation.test.tsx). The provider.test.tsx scenario "Alt+Left restores the previous snapshot and the captured nav_history_restore event reports matched_snapshot=true" pairs both halves. |
| KPI #5 ambiguity trust (no silent precedence) | Trust | DOM-level: "Single-click on an ambiguous reference opens the disambiguation popover", "Esc cancels the disambiguation popover with no side effects", property scenario "For any ambiguous reference, the popover always opens regardless of trigger". Event-level (rev 1): "After confirming a candidate in the disambiguation popover the ambiguous_ref_resolve event is emitted with method=popover" (instrumentation.test.tsx). |
| KPI #6 click-to-paint p95 <= 250ms | Performance | Latency p95 is a runtime measurement, NOT assertable as a budget in a Vitest unit test (DEVOPS scope). Schema-presence is verified at acceptance level (rev 1): the cross_ref_click scenario asserts `event.latency_ms` is a finite positive number, confirming the `performance.now() + requestAnimationFrame` instrumentation hook is wired (architecture sec 9). The DOM scenarios tagged @kpi cover the *correctness* preconditions (atomic commit in one render flush). |
| Emission-point architectural invariant | Constraint (ADR-002, ADR-003, CLAUDE.md FP paradigm) | "Dispatching an action directly through the pure reducer emits no instrumentation events; dispatching through the Provider does" (instrumentation.test.tsx) -- prevents the class of bug where a DELIVER crafter inlines emit() into reduce(), violating purity required for matched_snapshot computation. |

`@property` scenarios are universal invariants that the DELIVER wave should
implement using `fast-check`:

- "For any sequence of navigation actions the history never exceeds 50 entries" (NavHistory invariant)
- "For any ambiguous reference, the popover always opens regardless of trigger" (KPI #5 guardrail)
- "For any sequence of single-clicks on live references, the split is always exactly 2 panes" (US-106 + ADR-009; **rev 1** -- comment reframed to assert `splitState === null || (splitState.topRef !== undefined && splitState.bottomRef !== undefined)` so the runtime invariant is distinguished from the type-level shape guarantee)
- "When the split is open the selected list item key always equals the top pane reference key" (architecture sec 6.7 invariant)
- "preHighlight is total and returns a valid index for any non-empty candidate list" (ScopePrecedence totality)
- "buildRegistry with 500 items completes synchronously and produces the correct entry count" (NFR-2 perf, **rev 1** -- also tagged `@performance`)

`@infrastructure-failure` scenarios cover failure-mode paths from the journey
YAML's `failure_modes` and `error_paths` sections. All four R2 US-109 scenarios
use this tag.

`@driving_port` is on every scenario -- every test invokes the system through
either a pure domain port (`buildRegistry`, `resolve`, `reduce`, `pushEntry`,
`detectionRemarkPlugin`, `announcementFor`, `preHighlight`) or a top-level
React component (`<ConfigNavProvider>`, `<ReferenceToken>`,
`<DisambiguationPopover>`). No internal helpers are invoked directly.

## Architectural Enforcement (DEVOPS Wave)

The four dependency-cruiser rules from architecture.md section 4 are
explicitly **out of scope for acceptance tests** -- they are static
boundary-rule checks enforced in the CI pipeline by `npm run lint:boundaries`,
not behavioural tests. They are listed here for traceability:

| Rule name | Enforces |
|-----------|----------|
| `no-tauri-from-domain` | The pure domain layer (`src/plugins/norbert-config/domain/**`) cannot import `@tauri-apps/api/*`. |
| `no-react-from-domain` | The pure domain layer cannot import `react`, `react-dom`, or any React runtime. |
| `no-views-from-domain` | The pure domain layer cannot import from `views/**`. |
| `detection-strategies-isolated` | Detection strategy modules (`domain/references/detection/strategies/**`) cannot import sibling strategies; they only export pure functions composed by the pipeline. |

The DELIVER crafter implements production code that satisfies these rules; the
DEVOPS wave wires `lint:boundaries` into the CI pipeline as a hard gate. A
violation here is a build failure, not a Vitest failure -- the lint pass runs
before the test suite. (Closes PA MEDIUM dependency_cruiser_rules_flagged_for_devops.)

## Skip strategy

Per the implement-one-at-a-time strategy:

- The **first scenario** (`Loading state with no aggregated configuration
  renders no tokens and no crash`, in `registry.test.ts`) is **live** (`it(...)`).
  It anchors the outer-loop failure: when DELIVER runs the suite for the first
  time against the missing `domain/references/registry` module, the import
  fails with a clear "Cannot find module" -- the message names the file the
  crafter must create. Once the module exists with a stub returning
  `{ byName: new Map(), byFilePath: new Map(), version: 0 }`, the assertion
  `expect(registry.version).toBeGreaterThan(0)` fails with a business-logic
  message that points at the version-increment behaviour to implement.
- **All other scenarios** in all 7 test files are `it.skip(...)` (with a
  matching comment listing the driving-port shape and expected outcome).
- The DELIVER wave un-skips one at a time, implements just enough production
  code to pass it, commits, and proceeds.

## Error path coverage (Mandate 5)

Counting scenarios across all three feature files (Gherkin) only -- the
Vitest test files mirror these and add additional unit-level scenarios:

- Total Gherkin scenarios after rev 1: 53 (was 49; +4 = unsupported variant
  in walking skeleton, Alt+Right end-of-history no-op, Tab focus trap,
  Shift+Tab wrap)
- Error / edge / failure scenarios: 24 (was 21; +3 = unsupported variant,
  Alt+Right end-of-history no-op, additional Tab/Shift+Tab boundary cases)
  - Dead reference (US-107): 3
  - No-op manual nav (ADR-008): 2
  - End-of-history back (US-104): 1
  - End-of-history forward (US-104) **[rev 1]**: 1
  - Off-view scope (ADR-003): 2
  - Ambiguous + cancel paths (US-108): 4
  - Tab/Shift+Tab boundary (US-108/US-110) **[rev 1]**: 2
  - Soft-fail (US-109): 4
  - Bare-prose / fenced-block exclusion (US-101 + ADR-010): 2
  - Dead-click in bottom (US-106): 1
  - Empty config (architecture seam): 1
  - Filter cleared by reset (ADR-007): 1
  - Unsupported variant (US-101) **[rev 1]**: 1
- Ratio: 24 / 53 = 45%. Target was 40%+. Met.

Vitest scenario inventory (for reference; not counted in the Gherkin ratio):

- Total Vitest scenarios after rev 1: 56 across 8 test files (was 47 across 7
  files; +9 = 4 in resolver.test.ts, 5 in instrumentation.test.tsx, 1 NFR-2
  in registry.test.ts, 1 unsupported in detection.test.ts, 1 forward-direction
  in announcements.test.ts, plus 4 new provider.test.tsx scenarios -- end-of-
  history timer, bottom-pane fields, Ctrl+click preventDefault, Tab focus
  trap, Shift+Tab wrap, matched_snapshot pairing).

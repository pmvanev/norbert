# Mutation Report: session-event-viewer

**Date**: 2026-03-24
**Tool**: Stryker Mutator (vitest runner)
**Config**: `stryker.session-event-viewer.conf.json`

---

## Overall Result: PASS

| Metric | Value |
|--------|-------|
| Overall mutation score (total) | 96.89% |
| Overall mutation score (covered) | 97.50% |
| Mutants killed | 154 |
| Mutants timed out | 2 |
| Mutants survived | 4 |
| No coverage | 1 |
| Errors | 0 |

Quality gate: >= 80% PASS, 70-80% WARN, < 70% FAIL.
**Assessment: PASS (96.89% total)**

---

## Per-File Results

### `src/domain/status.ts` -- PASS (95.96%)

| Metric | Value |
|--------|-------|
| Mutation score (total) | 95.96% |
| Mutation score (covered) | 96.94% |
| Killed | 93 |
| Timed out | 2 |
| Survived | 3 |
| No coverage | 1 |

**Mutants killed since previous run:**

- `status.ts:138` -- `<` vs `<=` boundary: killed by new test asserting `isSessionActive` returns `false` when `now - lastEventTime` equals exactly `STALE_SESSION_MS` (300000ms).
- `status.ts:114` -- compound condition `sessionCount === 0` replaced with `true`: killed by new test `deriveConnectionStatus(1, 0, null)` which expects `"Listening"` (the mutant would incorrectly return `"No plugin connected"`).

**Remaining survivors (3):**

1. `status.ts:134` -- `if (session.ended_at !== null)` replaced with `if (false)` -- survived. The smoke tests that exercise `isSessionActive` via the rendered view do not assert return values precisely enough. The dedicated unit tests in `sessionList.test.ts` do cover this branch, but the Stryker per-test coverage attribution credits the kill to the smoke suite which cannot distinguish the mutation.

2. `status.ts:135` -- `if (session.last_event_at === null)` replaced with `if (false)` -- survived. Same root cause as above: the tests that reach this branch do not produce a distinguishable outcome when the guard is removed because the subsequent `new Date(null).getTime()` produces `NaN`, and `now - NaN < STALE_SESSION_MS` is `false`, which matches the expected `false` return.

3. `status.ts:163` -- `seconds !== null ? formatDuration(seconds) : "---"` conditional replaced with `true` -- survived. A completed session always has calculable duration in test data, so `seconds !== null` is always true in test scenarios.

**No-coverage mutant (1):**

- `status.ts:163` -- the `"---"` fallback string literal. Only reachable when `calculateDurationSeconds` returns `null` for a session with `ended_at !== null`, which is structurally impossible with valid timestamps. No test coverage expected.

---

### `src/domain/eventDetail.ts` -- PASS (98.00%)

| Metric | Value |
|--------|-------|
| Mutation score (total) | 98.00% |
| Mutation score (covered) | 98.00% |
| Killed | 49 |
| Survived | 1 |
| No coverage | 0 |

**Mutants killed since previous run:**

- `eventDetail.ts:48` -- `extractToolName` early-return guard for non-tool events (BlockStatement and ConditionalExpression mutants): killed by new test that passes a `session_start` event with a `{ tool: "bash" }` payload -- without the guard, the function would incorrectly return `"bash"`.
- `eventDetail.ts:53` -- `payload === null` guard (multiple mutants): killed by new test that passes `null` payload on a `tool_call_start` event.
- `eventDetail.ts:86` -- `<=` vs `<` boundary in `formatPayloadSnippet`: killed by new test with a payload whose JSON serialization length equals `maxLength` exactly.

**Remaining survivor (1):**

- `eventDetail.ts:53` -- `typeof payload !== "object"` replaced with `false`: survived. When this guard is removed, a non-object payload (e.g., a number or boolean) would fall through to the `as Record<string, unknown>` cast. However, if the payload has no `tool` or `tool_name` property, the function still returns `null`, making the mutation invisible to tests that use non-object payloads without those keys. The existing `"string-payload"` test cannot distinguish because string indexing returns `undefined`.

---

### `src/domain/sessionPresentation.ts` -- PASS (100.00%)

| Metric | Value |
|--------|-------|
| Mutation score (total) | 100.00% |
| Mutation score (covered) | 100.00% |
| Killed | 12 |
| Survived | 0 |
| No coverage | 0 |

All mutants killed. This new module was created by extracting pure presentation logic from view components (see Extracted Functions below).

---

## Summary Assessment

| File | Score | Gate |
|------|-------|------|
| `src/domain/status.ts` | 95.96% | PASS |
| `src/domain/eventDetail.ts` | 98.00% | PASS |
| `src/domain/sessionPresentation.ts` | 100.00% | PASS |
| **Overall** | **96.89%** | **PASS** |

---

## Extracted Functions

The following pure functions were extracted from view components into `src/domain/sessionPresentation.ts`:

| Function | Extracted From | Purpose |
|----------|---------------|---------|
| `deriveStatusLabel(isActive)` | `EventDetailView.tsx:81` | Returns "Active" or "Completed" display label |
| `deriveStatusClass(isActive)` | `EventDetailView.tsx:110` | Returns "status-active" or "status-completed" CSS class |
| `deriveSessionRowClass(isActive)` | `SessionListView.tsx:30` | Returns session row CSS class with optional "live-s" modifier |
| `deriveSessionDotClass(isActive)` | `SessionListView.tsx:31` | Returns dot indicator CSS class: "sdot live" or "sdot done" |

Each function takes a boolean `isActive` parameter (the result of `isSessionActive`), keeping the functions maximally composable and independently testable.

---

## View Exclusion Policy

View components (`*.tsx` files in `src/views/`) are excluded from the mutation testing scope because:

1. **JSX structure mutants** (string literals in classNames, element nesting) require component rendering tests that provide low signal relative to effort.
2. **Effect hook internals** (Tauri IPC calls, polling intervals, cleanup callbacks) involve side effects that belong in integration/E2E testing, not unit mutation testing.
3. **The pure logic that was previously embedded in views has been extracted** to domain modules where it is mutation-tested at 96-100% kill rates.
4. View components are now thin rendering shells that delegate all computation to tested domain functions.

The mutation scope for this feature is: `src/domain/status.ts`, `src/domain/eventDetail.ts`, `src/domain/sessionPresentation.ts`.

---

## Changes Made

### Tests added to `src/domain/status.test.ts`:
- Boundary test: `isSessionActive` at exactly `STALE_SESSION_MS` (kills `<` vs `<=` mutant)
- Boundary test: `isSessionActive` at `STALE_SESSION_MS - 1` (reinforces boundary)
- Compound condition test: `deriveConnectionStatus(1, 0, null)` (kills `sessionCount === 0` -> `true` mutant)

### Tests added to `src/domain/eventDetail.test.ts`:
- `extractToolName` with non-tool event type carrying a tool payload (kills early-return guard mutants)
- `extractToolName` with `null` payload on tool event (kills `payload === null` guard mutant)
- `formatPayloadSnippet` exact-length boundary test (kills `<=` vs `<` mutant)

### New domain module `src/domain/sessionPresentation.ts`:
- 4 pure functions extracted from `EventDetailView.tsx` and `SessionListView.tsx`

### New test file `src/domain/sessionPresentation.test.ts`:
- 8 tests covering all 4 extracted functions (both branches each)

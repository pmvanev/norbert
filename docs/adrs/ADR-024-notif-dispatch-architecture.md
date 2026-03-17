# ADR-024: Notification Dispatch Architecture -- Pure Pipeline with Independent Channel Execution

## Status

Accepted

## Context

norbert-notif must process incoming hook events and dispatch notifications to multiple channels. The dispatch must: (1) evaluate user preferences per event, (2) respect DND state, (3) deliver to each enabled channel independently, (4) handle channel failures without affecting other channels, (5) support test notifications through the same pipeline.

**Quality attribute drivers**: Testability (pure dispatch logic), fault tolerance (channel isolation), maintainability (single dispatch path for real and test notifications).

**Constraints**: Functional paradigm. Plugin runs in the browser process (Tauri webview). External channels (SMTP, webhook) require Rust backend IPC.

## Decision

Two-phase dispatch architecture:

**Phase 1 -- Pure evaluation** (domain layer, no effects):
Given (hookEvent, userPreferences, dndState) -> produces `readonly DispatchInstruction[]`. This is a pure function. It maps the hook event to a notification event ID, checks if any channels are enabled for that event, checks DND state, and produces a list of instructions describing what to deliver where. If DND is active and behavior is "queue", instructions are tagged for queuing instead of delivery.

**Phase 2 -- Effect execution** (adapter layer):
Each `DispatchInstruction` is executed independently through the appropriate port adapter. Failures are caught per-channel and produce `DispatchResult` values. A failing webhook does not prevent a toast from being delivered.

Test notifications enter the same pipeline with `isTest: true` flag. The dispatch engine treats them identically except for the "[TEST]" prefix in content.

## Alternatives Considered

### Event bus / pub-sub within the plugin

- What: Internal event bus where channels subscribe to notification events.
- Expected impact: Loose coupling between dispatch and channels. Extensible for future channels.
- Why insufficient: Over-engineering for 5 channels in a single-process plugin. The dispatch instruction array achieves the same decoupling without the indirection of a bus. Adding a channel means adding an adapter and a case in the executor -- not substantially different from adding a subscriber. The bus adds debugging complexity (event ordering, missed subscriptions) without proportional benefit.

### Synchronous sequential dispatch

- What: Deliver to each channel sequentially, fail-fast on first error.
- Expected impact: Simpler implementation, predictable ordering.
- Why insufficient: A 10-second webhook timeout would block toast and banner delivery for 10 seconds. Users would perceive the notification system as broken. Independent execution is essential for the fault tolerance quality attribute.

### Channel-specific hook processors (one per channel)

- What: Register separate hook processors per channel instead of a central dispatch engine.
- Expected impact: Each channel independently processes events.
- Why insufficient: Duplicates preference lookup and DND check logic across 5+ processors. Changes to preference schema or DND logic would require updating all processors. A single dispatch engine with a shared evaluation phase eliminates this duplication.

## Consequences

**Positive**:
- Dispatch evaluation is a pure function -- trivially testable with no mocks
- Channel failures are isolated -- each channel reports its own result
- Test and real notifications share one code path -- no divergent behavior
- Adding a new channel requires: one new port type, one adapter, one case in the executor
- DND logic centralized in one evaluation step

**Negative**:
- Phase 2 executor must handle async results from IPC calls (managed via Promise.allSettled or equivalent)
- Two-phase design means the instruction type must carry all data needed by adapters (no lazy loading from preferences during execution)

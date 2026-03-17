# Walking Skeleton: norbert-notif

## First Implementation Path

The walking skeleton traces the thinnest vertical slice that delivers observable user value: **a user receives a notification when a session completes**.

### Skeleton 1: Plugin Registration (US-NOTIF-07)

**User goal**: "I see a Notifications tab in Norbert and know the notification system is active."

**Slice**: Plugin manifest + onLoad + sidebar tab + status bar item + hook processor registration.

**Why first**: Every other story depends on the plugin being loaded and hook processors registered. Without this, no events flow to norbert-notif.

**Implementation sequence**:
1. Enable the walking skeleton test in `plugin-registration.test.ts`
2. Create `src/plugins/norbert-notif/manifest.ts` with plugin identity
3. Create `src/plugins/norbert-notif/index.ts` with `onLoad` registering tab, status item, hook processors
4. Create `src/plugins/norbert-notif/domain/eventRegistry.ts` with 14 event definitions
5. Walking skeleton test passes

**Done when**: `loadPlugins([norbertNotifPlugin], registry, apiFactory)` succeeds and registry contains the expected tab, status item, and hook registrations.

### Skeleton 2: Notification Dispatch (US-NOTIF-01)

**User goal**: "When my session completes, I receive a toast notification with the session name and cost."

**Slice**: Dispatch engine pure function: given an event + preferences + DND state, produce dispatch instructions.

**Why second**: This is the core value proposition. Once dispatch instructions are produced, adapters (toast, banner, badge) execute them independently.

**Implementation sequence**:
1. Enable the walking skeleton test in `notification-dispatch.test.ts`
2. Create `src/plugins/norbert-notif/domain/types.ts` with domain types
3. Create `src/plugins/norbert-notif/domain/defaults.ts` with default preferences
4. Create `src/plugins/norbert-notif/domain/dispatchEngine.ts` with `createDispatchInstructions`
5. Walking skeleton test passes

**Done when**: `createDispatchInstructions(sessionCompletedEvent, defaultPrefs, dndOff)` returns a `DispatchInstruction` for the toast channel with session name in body.

### Skeleton 3: Sound Resolution (US-NOTIF-06)

**User goal**: "I pick a notification sound and it plays when my event fires."

**Slice**: Sound library resolution: merge built-in + custom sounds, resolve by name, include in dispatch instruction.

**Why third**: Sound is part of the notification experience. The dispatch instruction needs to carry the resolved sound for the adapter to play.

**Implementation sequence**:
1. Enable the walking skeleton test in `sound-system.test.ts`
2. Create `src/plugins/norbert-notif/domain/soundLibrary.ts` with `resolveSoundLibrary` and `resolveSound`
3. Walking skeleton test passes

**Done when**: `resolveSoundLibrary(builtInSounds, customPaths)` returns a merged list, and `resolveSound("phosphor-ping", library)` returns the correct `SoundEntry`.

## One-at-a-Time Sequence

After the 3 walking skeletons, enable focused scenarios one at a time in this order:

### Phase 1: Plugin Foundation (US-NOTIF-07)
1. Status bar shows DND state and unread count
2. Settings section structure
3. Boundary compliance
4. No-dependency loading

### Phase 2: Core Dispatch (US-NOTIF-01)
5. Cost threshold multi-channel dispatch
6. Hook error with context
7. Context compaction dispatch
8. Disabled event produces nothing
9. Independent channel instructions
10. Badge count increment
11. Property: no disabled channel instructions
12. Property: instruction completeness

### Phase 3: Settings (US-NOTIF-02)
13. Default preferences match spec
14. Enable channel toggle
15. Change cost threshold
16. Invalid threshold rejected
17. Context window threshold range
18. Zero threshold rejected

### Phase 4: Sounds (US-NOTIF-06)
19. Built-in sound resolution
20. Custom sound discovery
21. Silence option
22. Missing sound fallback
23. Volume multiplier

### Phase 5: Test Notifications (US-NOTIF-03)
24. Test through standard dispatch with prefix
25. Single-channel test instruction
26. Unconfigured channel error
27. Test bypasses DND
28. [TEST] in all titles

### Phase 6: Do Not Disturb (US-NOTIF-04)
29. Manual toggle suppresses
30. Queue behavior tagging
31. Discard behavior
32. Banner-only behavior
33. Schedule activation
34. Batch delivery on end
35. State persistence

### Phase 7: External Channels (US-NOTIF-05)
36. Webhook payload fields
37. Email instruction content
38. Webhook timeout metadata
39. Channel independence

# Acceptance Test Catalog: norbert-notif (Notification Center)

## Overview

- **Total scenarios**: 44
- **Walking skeletons**: 3
- **Focused scenarios**: 23
- **Error/boundary scenarios**: 18 (41% of total)
- **Property-tagged scenarios**: 2
- **Build order**: scaffold -> dispatch -> settings -> sounds -> test-notifications -> dnd -> external-channels

## Test Files

| File | Story | Scenarios | Walking | Focused | Error |
|------|-------|-----------|---------|---------|-------|
| plugin-registration.test.ts | US-NOTIF-07 | 5 | 1 | 2 | 2 |
| notification-dispatch.test.ts | US-NOTIF-01 | 11 | 1 | 4 | 6 |
| event-channel-settings.test.ts | US-NOTIF-02 | 6 | 0 | 3 | 3 |
| sound-system.test.ts | US-NOTIF-06 | 6 | 1 | 3 | 2 |
| test-notifications.test.ts | US-NOTIF-03 | 5 | 0 | 2 | 3 |
| do-not-disturb.test.ts | US-NOTIF-04 | 7 | 0 | 4 | 3 |
| external-channels.test.ts | US-NOTIF-05 | 4 | 0 | 2 | 2 |

## Driving Ports

All tests invoke through these entry points only:

| Port | Used By |
|------|---------|
| `loadPlugins` + `createPluginRegistry` + `createNorbertAPI` | plugin-registration |
| `createDispatchInstructions` (pure function) | notification-dispatch |
| `validatePreferences` / `applyDefaultPreferences` | event-channel-settings |
| `resolveSoundLibrary` / `resolveSound` | sound-system |
| `createTestNotification` | test-notifications |
| `evaluateDndState` / `applyDndToInstructions` | do-not-disturb |
| `createDispatchInstructions` (with webhook/email channels) | external-channels |

## Scenario Catalog

### US-NOTIF-07: Plugin Registration (Build First)

1. **[WS] User sees Notifications tab after norbert-notif loads** -- Plugin registers views, tab, status item, and hook processors
2. Status bar shows DND state and unread count
3. Settings section has sec-hdr title "Notifications" with sub-sections
4. Plugin uses only public NorbertPlugin API (boundary compliance)
5. Plugin loads independently with no plugin dependencies

### US-NOTIF-01: Notification Dispatch

6. **[WS] User receives toast when session completes** -- Dispatch produces toast instruction for enabled event
7. Cost threshold triggers multi-channel dispatch (toast, banner, badge)
8. Hook error dispatch includes context in title and body
9. Context compaction produces toast with session details
10. Disabled event produces no dispatch instructions
11. Dispatch continues when one channel would fail (independent instructions)
12. Badge count increments for banner instructions
13. @property: Dispatch never produces instructions for disabled channels
14. @property: Every dispatch instruction includes event ID and timestamp
15. Unknown event type produces no dispatch instructions
16. Event with missing payload fields produces safe instructions

### US-NOTIF-02: Event and Channel Settings

17. Default preferences match product specification
18. Enable banner channel for an event updates preferences
19. Change cost threshold to $25.00
20. Invalid threshold value rejected with validation error
21. Context window threshold validates range 1-99%
22. Threshold must be a positive number (zero rejected)

### US-NOTIF-06: Sound System

23. **[WS] User selects a sound and it resolves for playback** -- Sound library merges built-in and custom sounds
24. Built-in sound resolved by name from library
25. Custom sound discovered from user directory
26. Silence option produces null sound in dispatch instruction
27. Missing custom sound falls back to default
28. Global volume applied as multiplier to dispatch instruction volume

### US-NOTIF-03: Test Notifications

29. Test notification routes through standard dispatch with [TEST] prefix
30. Test notification for specific channel produces single instruction
31. Test notification with unconfigured channel produces error result
32. Test notification during DND still delivers (bypasses DND)
33. Test notification includes [TEST] in title for all channels

### US-NOTIF-04: Do Not Disturb

34. Manual DND toggle suppresses dispatch (produces queue instructions)
35. DND with "queue" behavior tags instructions for queuing
36. DND with "discard" behavior produces no instructions
37. DND with "banner only" behavior produces banner-only instructions
38. Scheduled DND activates at configured time
39. Queued notifications produce batch instructions on DND end
40. DND state persists across evaluations (not reset between calls)

### US-NOTIF-05: External Channels

41. Webhook dispatch instruction includes standard payload fields
42. Email dispatch instruction includes subject and body with event details
43. Webhook timeout configuration reflected in dispatch instruction metadata
44. Webhook failure does not appear in other channel instructions (independence)

## Mandate Compliance Evidence

### CM-A: Driving Port Usage

All test files import from:
- `src/plugins/lifecycleManager` (loadPlugins)
- `src/plugins/pluginRegistry` (createPluginRegistry, getViewsByPlugin, etc.)
- `src/plugins/apiFactory` (createNorbertAPI)
- `src/plugins/norbert-notif/domain/dispatchEngine` (createDispatchInstructions)
- `src/plugins/norbert-notif/domain/dndManager` (evaluateDndState)
- `src/plugins/norbert-notif/domain/soundLibrary` (resolveSoundLibrary)
- `src/plugins/norbert-notif/domain/preferenceValidator` (validatePreferences)
- `src/plugins/norbert-notif/domain/defaults` (applyDefaultPreferences)

Zero imports from adapters/, views/, or external libraries.

### CM-B: Business Language Purity

Gherkin comments use only domain terms: events, channels, toast, banner, badge, sound, threshold, dispatch, preferences, volume, Do Not Disturb, queue, dismiss.

Zero technical terms: no HTTP, POST, JSON, API, database, REST, status code, IPC, SQLite, Promise.

### CM-C: Walking Skeleton + Focused Scenario Counts

- Walking skeletons: 3 (plugin registration, dispatch, sound system)
- Focused scenarios: 23
- Error/boundary scenarios: 18 (41%)
- Total: 44

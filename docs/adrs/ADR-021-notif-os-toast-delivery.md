# ADR-021: OS Toast Delivery via tauri-plugin-notification

## Status

Accepted

## Context

norbert-notif must deliver Windows toast notifications to alert users of agent events (session completion, cost thresholds, errors). The notification must appear in the Windows Notification Center even when Norbert is minimized to tray.

**Quality attribute drivers**: Fault tolerance (reliable delivery), time-to-market (solo developer), maintainability (minimal custom code).

**Constraints**: Tauri 2.0 app on Windows 11. Must work when app is minimized to tray.

## Decision

Use `tauri-plugin-notification` (MIT/Apache-2.0) for OS toast delivery. The plugin is Tauri's official notification solution, already compatible with the existing plugin system (`tauri-plugin-single-instance` in use).

Frontend invokes toast delivery via Tauri IPC command. The Rust backend delegates to `tauri-plugin-notification` which uses the Windows Notification Center API.

## Alternatives Considered

### winrt-notification (direct Windows API)

- What: Rust crate for direct Windows Runtime notification API access.
- Expected impact: Maximum Windows-specific control (action buttons, rich content).
- Why insufficient: Tauri 2.0's plugin provides the same functionality with less code and is maintained by the Tauri team. Direct WinRT bindings add Windows-only coupling that would prevent future cross-platform support. Action buttons and rich content are deferred to v2.

### Custom Win32 API calls via Tauri

- What: Raw Win32 `Shell_NotifyIconW` calls from Rust.
- Expected impact: Full control, no dependencies.
- Why insufficient: Significant implementation effort for toast notifications (COM initialization, XML template building, callback handling). The existing Tauri notification plugin handles all of this. Solo developer cannot justify the effort.

## Consequences

**Positive**:
- Minimal code: one IPC command + plugin registration
- Maintained by Tauri team, compatible with Tauri version upgrades
- Cross-platform potential if Norbert expands beyond Windows
- Well-tested on Windows 11 Notification Center

**Negative**:
- Limited to basic toast format (title, body, icon) -- no action buttons in v1
- Depends on Tauri plugin ecosystem versioning

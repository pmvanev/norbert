# ADR-040: Tray Icon Event Loop and State-Sharing Architecture for Hook Receiver

## Status
Accepted

## Context

`norbert-hook-receiver.exe` is a headless `tokio::main` Axum HTTP server with no GUI runtime. Adding a Windows system tray icon requires:

1. A Win32 message pump to receive tray events (hover, right-click, menu clicks)
2. Access to live process state (bound port, event count) for tooltip and menu rendering
3. A mechanism to signal the async HTTP server to shut down cleanly when "Quit" is clicked

Three crate options were evaluated:

| Crate | Version in Cargo.lock | Requires winit? | Windows-sys? | Active? |
|-------|-----------------------|----------------|-------------|---------|
| `tray-icon` | 0.21.3 (transitive via tauri) | No | Yes | Yes (Tauri team) |
| `systray` | not present | No | Yes | Abandoned 2019 |
| `tray-item` | not present | No | Yes | Sporadic; API unstable |

**Spike result**: `tray-icon` 0.21.3 has no `winit` dependency (confirmed via `Cargo.lock` dep list). It drives its own Win32 message pump on Windows using `windows-sys 0.60.2`. Standalone (non-Tauri) usage is documented in the crate README via `TrayIconEvent::set_event_handler` + a tick loop.

## Decision

**Crate**: `tray-icon` 0.21.3 (no new Cargo dependency — already in lock file via tauri).

**Event loop**: Dedicated `std::thread::spawn` OS thread. The thread creates the `TrayIcon`, sets an event handler closure, and runs a tick loop (`std::thread::sleep(16ms)`). This thread is independent of the tokio runtime.

**Why OS thread, not tokio task**: `tray-icon`'s Win32 pump is synchronous. Spawning it as a `tokio::task` would block a tokio worker thread, degrading HTTP throughput under load. An OS thread is isolated, costs ~64 KB stack, and has negligible impact on a server process.

**Shared state**: `event_counter: AtomicU64` and `bound_port: AtomicU32` added to the existing `AppState` struct (already `Arc`-shared across handlers). The tray thread receives an `Arc<AppState>` clone. No new synchronization primitive or channel is introduced.

**Tooltip refresh strategy**: State is read on-demand inside the tray event handler when a tooltip or menu event fires. There is no background polling timer. This satisfies the AC requirement ("no background polling") and means zero CPU overhead between user interactions.

**Shutdown coordination**: `tokio_util::sync::CancellationToken` (available via the existing `tokio` dependency). The tray thread holds a `CancellationToken` clone and calls `.cancel()` when Quit is clicked — a thread-safe synchronous operation. The tokio `main` task `select!`s on `.cancelled()`.

**Port-bind-fail path**: `bound_port` is set to `0` as a sentinel for "unavailable". Tooltip and menu format this as "Port: unavailable". The tray icon still appears; the process is usable for graceful shutdown even when the HTTP server failed to bind.

**Drain timeout constant**: `DRAIN_TIMEOUT_SECS: u64 = 2` — named constant, not a magic number.

## Alternatives Considered

### Alternative 1: winit event loop
- Add `winit` as a dependency; drive tray events from `winit::EventLoop`
- `winit` is the idiomatic event loop for `tray-icon` on cross-platform
- Rejected: `tray-icon` 0.21.3 does not require `winit` on Windows. Adding `winit` introduces ~12 transitive crates and forces a `run(event_loop)` call that consumes the main thread — conflicting with `tokio::main`. The standalone Win32 pump in `tray-icon` is simpler and sufficient for Windows-only scope.

### Alternative 2: `systray` crate
- Pure Win32 tray without any GUI framework dependency
- Rejected: last commit 2019; effectively abandoned; no `muda`-based context menu; significant API risk for a production tool.

### Alternative 3: IPC-based tray in a separate process
- Run a thin helper process whose only job is the tray icon; communicate with hook receiver via named pipe or socket
- Rejected: over-engineered for a single-user local tool. Adds a third binary, an IPC protocol, and a launch/shutdown coordination problem. The OS thread approach achieves the same isolation without process-boundary complexity.

### Alternative 4: Axum `/quit` HTTP endpoint (no tray)
- Expose a `POST /quit` route; user triggers graceful shutdown via curl or a shortcut
- Rejected: provides no passive visibility; requires active action to check status; violates the Windows-idiom requirement (system tray is the platform convention for background process control).

## Consequences

**Positive**:
- Zero new Cargo dependencies (tray-icon + muda already in lock file)
- Tray OS thread fully isolated from tokio — no runtime interference
- AtomicU64/AtomicU32 counter reads are lock-free — no contention with HTTP handlers
- On-demand tooltip refresh = zero CPU overhead between interactions
- `CancellationToken` is idiomatic tokio shutdown signaling; no custom channel needed
- Port-bind failure handled gracefully — tray always appears

**Negative**:
- `hook_receiver.rs` grows from ~290 lines to ~400 lines; TrayManager logic is co-located in the same file (acceptable for solo project; extract to module if it grows further)
- Windows-only scope: tray code must be `#[cfg(target_os = "windows")]` guarded to keep Linux/macOS builds clean
- Tick-loop approach (sleep 16ms) is simple but slightly less responsive than a true Win32 `GetMessage` loop; acceptable for a status tray that needs no sub-16ms response

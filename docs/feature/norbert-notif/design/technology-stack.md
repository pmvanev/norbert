# Technology Stack: norbert-notif

## Existing Stack (no changes)

| Technology | Purpose | License |
|-----------|---------|---------|
| Tauri 2.0 | Desktop app framework, IPC, system tray | MIT/Apache-2.0 |
| Rust | Backend commands, sidecar | MIT/Apache-2.0 |
| TypeScript | Frontend logic, plugin code | Apache-2.0 |
| React | UI components | MIT |
| SQLite (rusqlite) | Event storage, WAL mode | Public Domain (rusqlite: MIT) |
| Vite | Build tooling | MIT |

## New Dependencies

### Rust (src-tauri/Cargo.toml)

| Crate | Version | Purpose | License | Alternatives Considered |
|-------|---------|---------|---------|------------------------|
| `tauri-plugin-notification` | 2.x | Windows toast notifications via Tauri plugin | MIT/Apache-2.0 | `winrt-notification` (Windows-only, lower-level), custom Win32 API (too much effort) |
| `lettre` | 0.11 | SMTP email sending | MIT | `mail-send` (less mature, fewer downloads), `sendgrid` (SaaS dependency, rejected) |
| `reqwest` | 0.12 | HTTP POST for webhook delivery | MIT/Apache-2.0 | `ureq` (blocking only, simpler but no async), `hyper` (too low-level for simple POST) |

### TypeScript/Frontend (package.json)

No new npm dependencies required. Web Audio API is built into the browser. React state management uses existing patterns (no new state library).

### Sound Assets (bundled)

| Asset | Format | License |
|-------|--------|---------|
| phosphor-ping.wav | WAV | Custom (created for Norbert) |
| amber-pulse.wav | WAV | Custom |
| compaction.wav | WAV | Custom |
| session-complete.wav | WAV | Custom |
| des-block.wav | WAV | Custom |

Six built-in sounds bundled in `src/plugins/norbert-notif/assets/sounds/`. Custom user sounds loaded from `~/.norbert/sounds/` at runtime.

## Technology Selection Rationale

### tauri-plugin-notification (ADR-021)
Windows toast notifications require native API access. Tauri's official notification plugin provides cross-platform toast support with minimal configuration. It integrates with the existing Tauri plugin system already used (e.g., `tauri-plugin-single-instance`).

### lettre for SMTP (ADR-022)
Browser-side JavaScript cannot perform SMTP operations. Email delivery must happen in the Rust backend. `lettre` is the most mature Rust SMTP library (MIT, 2.6k+ GitHub stars, active maintenance). It supports TLS, STARTTLS, and authentication -- all required by the user stories.

### reqwest for webhooks (ADR-022)
Webhook delivery requires HTTP POST with JSON body, timeout control, and error reporting. `reqwest` is the de facto Rust HTTP client (MIT, 9k+ GitHub stars). It supports async operation, timeouts, and TLS -- required for non-blocking webhook delivery.

### Web Audio API for sounds
Built into all modern browsers/webviews. No dependency needed. Supports volume control, playback of WAV/MP3/OGG. Used for sound preview and notification playback. Alternative considered: Tauri audio plugin (unnecessary overhead for simple playback).

## Platform Requirements

| Requirement | Solution |
|-------------|----------|
| Windows 11 toast notifications | `tauri-plugin-notification` with Windows Notification Center |
| System tray badge | Tauri `tray-icon` feature (already enabled in Cargo.toml) |
| SMTP with TLS | `lettre` with `native-tls` or `rustls` feature |
| Webhook with HTTPS | `reqwest` with default TLS |
| Audio playback | Web Audio API in Tauri webview |
| File system access (preferences, sounds) | Tauri IPC commands using `std::fs` |

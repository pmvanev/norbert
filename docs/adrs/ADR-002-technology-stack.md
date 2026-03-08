# ADR-002: Technology Stack

## Status

Accepted

## Context

Norbert requires a desktop shell with system tray, an HTTP server for hook events, local storage, and a dashboard UI. The product spec prescribes Tauri 2.0, React, SQLite WAL, and Claude Code HTTP hooks. This ADR documents rationale and records the specific choices within that prescribed stack.

**Constraints**: Solo developer. Windows 11 initial target. Binary under 15MB. Zero-config install via npx. OSS only.

## Decision

| Layer | Choice | Version | License |
|-------|--------|---------|---------|
| Desktop shell | Tauri | 2.x | MIT/Apache-2.0 |
| Backend | Rust | stable | MIT/Apache-2.0 |
| Frontend | React + TypeScript | 18.x / 5.x | MIT / Apache-2.0 |
| Build tool | Vite | 5.x | MIT |
| Database | SQLite via rusqlite | 3.x / latest | Public Domain / MIT |
| HTTP server | axum (or Tauri embedded server) | latest | MIT |
| CI/CD | GitHub Actions + tauri-apps/tauri-action | N/A | MIT |
| Distribution | npm/npx from GitHub | N/A | N/A |

## Alternatives Considered

### Electron instead of Tauri

- Binary size: 150MB+ vs under 15MB
- Memory: Bundles Chromium; users already running Claude Code + Claude Desktop (both Electron)
- Rejection: Resource overhead contradicts "lightweight always-on observer" goal. WebView2 ships with Windows 11, eliminating Tauri's main risk on the initial target platform.

### Local web server + browser tab instead of desktop app

- No system tray presence, no auto-launch, no native window
- Rejection: Core UX requirement is ambient desktop presence. A browser tab cannot provide tray icon, window management, or always-on background process.

### PostgreSQL or InfluxDB instead of SQLite

- PostgreSQL: requires separate process, external dependency, overkill for single-user local data
- InfluxDB: purpose-built for time-series but introduces infrastructure complexity
- Rejection: SQLite handles thousands of writes/second, supports WAL for concurrent read/write, requires zero infrastructure. Perfect fit for local-first single-user desktop app.

### Vue or Svelte instead of React

- Both viable. Svelte has smaller bundle. Vue has good DX.
- Rejection: Product spec prescribes React. Recharts (specified for future charts) is React-native. React has the largest ecosystem for the visualization libraries needed in later phases.

## Consequences

**Positive**:
- All technologies OSS with permissive licenses (MIT, Apache-2.0, Public Domain)
- Tauri gives native feel at fraction of Electron's resource cost
- Rust backend provides memory safety and fearless concurrency for HTTP server
- SQLite zero-config aligns with local-first philosophy
- Vite provides fast dev experience with HMR

**Negative**:
- Tauri requires Rust knowledge (acceptable: solo dev is choosing this stack)
- WebView2 rendering may differ slightly from Chrome (mitigated: Win11 keeps WebView2 current)
- Rust compile times slower than JS/TS (mitigated: incremental compilation, small codebase)

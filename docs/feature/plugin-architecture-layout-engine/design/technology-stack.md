# Technology Stack: Plugin Architecture and Layout Engine (Phase 3)

## Existing Stack (Retained from Phase 2)

| Layer | Technology | Version | License | Rationale |
|---|---|---|---|---|
| Desktop shell | Tauri | 2.x | MIT/Apache-2.0 | ADR-002 |
| Backend | Rust | stable | MIT/Apache-2.0 | ADR-002 |
| Frontend | React + TypeScript | 18.x / 5.x | MIT / Apache-2.0 | ADR-002 |
| Build tool | Vite | 5.x | MIT | ADR-002 |
| Database | SQLite via rusqlite | 3.x | Public Domain / MIT | ADR-002, ADR-003 |
| HTTP server | axum | latest | MIT | ADR-002 |

## New Dependencies for Phase 3

### Backend (Rust)

| Dependency | Purpose | Version | License | Alternatives Considered |
|---|---|---|---|---|
| tauri (multi-window API) | Create/manage additional webview windows | 2.x (existing) | MIT/Apache-2.0 | N/A -- already in stack, multi-window is built-in Tauri capability |

No new Rust crate dependencies required. Tauri 2.x already supports multi-window via `WebviewWindowBuilder`. Plugin loading and IPC routing use existing Tauri APIs.

### Frontend (TypeScript/React)

| Dependency | Purpose | Version | License | Alternatives Considered |
|---|---|---|---|---|
| semver | Semver range comparison for dependency resolution | latest | ISC | node-semver (same package, different name); custom implementation (rejected: unnecessary reimplementation of well-solved problem) |

### Plugin Runtime

| Dependency | Purpose | Version | License | Alternatives Considered |
|---|---|---|---|---|
| Node.js (runtime) | Plugin execution environment | 18+ LTS | MIT | Deno (rejected: npm ecosystem compatibility is critical for plugin packages); Bun (rejected: less mature, unnecessary risk) |

### No New UI Libraries

- **Drag-and-drop**: HTML5 Drag and Drop API (native browser API, no library)
- **Resizable panels**: CSS flexbox + pointer events (no library)
- **Context menus**: Custom React component (no library -- VS Code-like behavior requires custom implementation)
- **Command palette**: Custom React component (reuse Phase 2 patterns)

## Technology Decisions Requiring ADRs

1. **ADR-011**: Plugin loading mechanism (npm global scan vs bundled vs hybrid)
2. **ADR-012**: Multi-window IPC architecture (Tauri events vs custom channel)
3. **ADR-013**: Layout persistence format (JSON file structure, atomic writes)
4. **ADR-014**: Plugin sandbox enforcement strategy (API-layer vs process isolation)

## License Compliance

All new dependencies use permissive licenses (ISC, MIT, Apache-2.0). No copyleft (GPL/AGPL/LGPL) dependencies introduced. Node.js runtime is MIT-licensed.

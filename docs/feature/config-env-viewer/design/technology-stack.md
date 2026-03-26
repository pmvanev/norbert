# Technology Stack: config-env-viewer

No new technologies. This feature uses the existing stack exclusively.

## Existing Stack (unchanged)

| Layer | Technology | Version | License | Rationale |
|-------|-----------|---------|---------|-----------|
| Backend | Rust + Tauri | 2.x | MIT | Existing IPC infrastructure reads settings.json |
| Frontend | React + TypeScript | 19.x / 5.x | MIT | Existing component framework |
| State | React useState/useCallback | -- | MIT | Existing local component state pattern |
| Build | Vite | 6.x | MIT | Existing build toolchain |
| Test | Vitest | 3.x | MIT | Existing test runner for pure function tests |

## Dependencies Added: None

No new npm packages, no new Cargo crates, no new runtime dependencies.

## Rationale

The `env` block in settings.json is a simple `Record<string, string>`. Extraction reuses the existing `extractEnvVars` function pattern already present in `settingsParser.ts` for MCP server environments. No parsing libraries, schema validators, or external services needed.

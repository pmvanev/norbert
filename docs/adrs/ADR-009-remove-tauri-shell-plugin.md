# ADR-009: Remove Tauri Shell Plugin After Sidecar Decoupling

## Status

Accepted

## Context

The `tauri-plugin-shell` dependency exists solely to spawn `norbert-hook-receiver` as a Tauri sidecar process from `lib.rs`. With the hook receiver starting independently via Task Scheduler (ADR-008), the sidecar spawn is removed. The shell plugin, its capabilities configuration, and the `externalBin` bundling configuration become unused.

Unused dependencies increase attack surface, binary size, and maintenance burden.

## Decision

Remove `tauri-plugin-shell` and all associated configuration:

1. `tauri-plugin-shell` from `Cargo.toml` dependencies
2. `.plugin(tauri_plugin_shell::init())` from the Tauri builder in `lib.rs`
3. `use tauri_plugin_shell::ShellExt;` import from `lib.rs`
4. `spawn_hook_receiver_sidecar()` function from `lib.rs`
5. Shell permissions from `capabilities/default.json`
6. `externalBin` array from `tauri.conf.json`

## Alternatives Considered

### Keep tauri-plugin-shell as fallback

- **What**: Remove the sidecar spawn call but keep the dependency for potential future use.
- **Evaluation**: Avoids re-adding if needed later. But violates YAGNI, keeps unused code in the dependency graph, and the capability permissions would remain overly broad.
- **Rejection**: The dependency can be re-added in minutes if ever needed. Unused dependencies should be removed.

### Partial cleanup (remove spawn, keep dependency)

- **What**: Delete `spawn_hook_receiver_sidecar()` but leave the plugin initialized.
- **Evaluation**: Smaller diff, less risk.
- **Rejection**: Leaves dead code and unnecessary runtime initialization. The cleanup is straightforward and should be complete.

## Consequences

**Positive**:
- Smaller binary size (shell plugin code eliminated)
- Reduced capability surface (no shell:allow-spawn, shell:allow-execute)
- Cleaner dependency graph
- `tauri.conf.json` no longer references external binaries for bundling

**Negative**:
- If a future feature needs shell/sidecar capabilities, the plugin must be re-added (trivial)

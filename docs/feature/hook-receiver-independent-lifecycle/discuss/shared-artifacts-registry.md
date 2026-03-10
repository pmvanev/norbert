# Shared Artifacts Registry: Hook Receiver Independent Lifecycle

## Artifacts

### hook_receiver_binary_path

- **Source of truth**: `scripts/postinstall-core.js` -> `getInstallDirectory()` + filename `norbert-hook-receiver.exe`
- **Consumers**:
  - `scripts/postinstall.js` -- copies binary to this path
  - Windows Task Scheduler task -- launches binary from this path
- **Owner**: postinstall pipeline
- **Integration risk**: HIGH -- if the path in Task Scheduler doesn't match where postinstall places the binary, the receiver won't start at boot
- **Validation**: After postinstall, verify Task Scheduler task target matches actual binary location

### task_scheduler_task_name

- **Source of truth**: `scripts/postinstall.js` (or `postinstall-core.js`) constant
- **Consumers**:
  - `scripts/postinstall.js` -- creates/updates task with this name
  - Future uninstall script -- removes task by this name
- **Owner**: postinstall pipeline
- **Integration risk**: MEDIUM -- if the name changes between versions, old tasks become orphaned
- **Validation**: Query Task Scheduler for task by name, verify exactly one exists

### hook_port (3748)

- **Source of truth**: `src-tauri/src/domain/mod.rs` -> `HOOK_PORT` constant
- **Consumers**:
  - `src-tauri/src/hook_receiver.rs` -- binds to this port
  - `src-tauri/src/domain/mod.rs` -> `build_hook_url()` -- constructs URLs for Claude Code config
  - `src-tauri/src/lib.rs` -- displays port in GUI status
  - Claude Code `settings.json` hooks configuration -- targets this port
- **Owner**: domain module
- **Integration risk**: HIGH -- port mismatch between receiver and Claude Code config means hooks are lost
- **Validation**: Receiver bind address port matches HOOK_PORT constant; Claude Code hook URLs use same port

### database_path

- **Source of truth**: `src-tauri/src/adapters/db/mod.rs` -> `resolve_database_path()`
- **Consumers**:
  - `src-tauri/src/hook_receiver.rs` -- opens connection for writing events
  - `src-tauri/src/lib.rs` -- opens connection for reading events (GUI)
- **Owner**: database adapter module
- **Integration risk**: HIGH -- if receiver and GUI resolve different paths, they operate on different databases
- **Validation**: Both binaries resolve to identical path (same function, same crate)

## Integration Checkpoints

| Checkpoint | Steps | Validation |
|-----------|-------|------------|
| Binary path consistency | 1 -> 2 | Task Scheduler target == postinstall output path |
| Database path consistency | 2 -> 4 | Hook receiver and GUI resolve identical DB path |
| Port consistency | 2 -> 3 | Receiver binds to HOOK_PORT; Claude Code targets same port |
| Singleton guarantee | 2 | Second instance exits cleanly on port conflict |
| Idempotent registration | 1 | Re-running postinstall produces exactly one task |

## Notes

All shared artifacts except `task_scheduler_task_name` are already managed by existing code. The database path and hook port are resolved from shared Rust crate code, eliminating drift risk. The new artifact to track carefully is the Task Scheduler task name, which bridges the JavaScript postinstall world and the Windows OS scheduler.

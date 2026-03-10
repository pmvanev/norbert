# Definition of Ready Validation

## Story: US-HRIL-01 (Register Hook Receiver for Startup at Install Time)

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Phil finds it frustrating that after installing Norbert, he must manually ensure the hook receiver is running" -- domain language, specific pain |
| User/persona identified | PASS | "Phil -- solo developer using Norbert to observe Claude Code sessions on Windows 11" |
| 3+ domain examples | PASS | 3 examples: fresh install, reinstall/update, permission failure -- all with real paths and specific scenarios |
| UAT scenarios (3-7) | PASS | 4 scenarios: fresh install, idempotent reinstall, registration failure, correct binary path |
| AC derived from UAT | PASS | 5 criteria directly mapping to scenario outcomes |
| Right-sized | PASS | ~1 day effort, 4 scenarios, single deliverable (postinstall enhancement) |
| Technical notes | PASS | PowerShell approach, idempotency strategy, user-level privileges, no elevation needed |
| Dependencies tracked | PASS | All dependencies completed (postinstall pipeline, binary installation, shortcut pattern) |

### DoR Status: PASSED

---

## Story: US-HRIL-02 (Hook Receiver Singleton Behavior at Startup)

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "opening a second Norbert GUI instance spawns a duplicate hook receiver that crashes on port 3748 conflict" -- specific, observable pain |
| User/persona identified | PASS | "Phil -- solo developer, expects silent, conflict-free background process" |
| 3+ domain examples | PASS | 3 examples: normal single boot, duplicate Task Scheduler launch, manual terminal start while running |
| UAT scenarios (3-7) | PASS | 3 scenarios: single start success, port conflict clean exit, manual start with informative message |
| AC derived from UAT | PASS | 4 criteria covering bind, exit code, no dialog, first instance unaffected |
| Right-sized | PASS | ~0.5 day effort (mostly validation of existing behavior), 3 scenarios |
| Technical notes | PASS | References existing code (hook_receiver.rs lines 124-133), Windows Error Reporting consideration |
| Dependencies tracked | PASS | US-HRIL-01 dependency noted; existing port binding logic already complete |

### DoR Status: PASSED

---

## Story: US-HRIL-03 (GUI Stops Spawning Hook Receiver Sidecar)

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "sidecar spawning creates duplicate processes and port conflicts" -- specific, causal |
| User/persona identified | PASS | "Phil -- expects GUI to just show data without side effects" |
| 3+ domain examples | PASS | 3 examples: normal use with receiver running, receiver not running, multiple GUI instances |
| UAT scenarios (3-7) | PASS | 4 scenarios: no sidecar spawn, no receiver graceful, two GUIs coexist, GUI close doesn't affect receiver |
| AC derived from UAT | PASS | 5 criteria mapping directly to scenario outcomes |
| Right-sized | PASS | ~0.5-1 day effort (remove sidecar call, clean up), 4 scenarios |
| Technical notes | PASS | Specific code location (lib.rs line 112), tauri_plugin_shell cleanup, read-only SQLite option |
| Dependencies tracked | PASS | US-HRIL-01 and US-HRIL-02 as prerequisites |

### DoR Status: PASSED

---

## Overall Validation

All 3 stories pass all 8 DoR items. The feature is ready for handoff to DESIGN wave.

### Anti-Pattern Check

| Anti-Pattern | Status | Notes |
|-------------|--------|-------|
| Implement-X | CLEAN | All stories start from user pain, not technical tasks |
| Generic data | CLEAN | Real persona (Phil), real paths, real port numbers |
| Technical AC | CLEAN | AC describe observable outcomes, not implementation choices |
| Oversized story | CLEAN | 3-4 scenarios each, 0.5-1 day effort each |
| Abstract requirements | CLEAN | 3+ concrete domain examples per story with specific data |

### Story Dependency Graph

```
US-HRIL-01 (Register Startup)
    |
    v
US-HRIL-02 (Singleton Behavior)  -- can be done in parallel with 01
    |
    v
US-HRIL-03 (Remove Sidecar)     -- depends on 01 and 02
```

Recommended execution order: US-HRIL-01 and US-HRIL-02 in parallel, then US-HRIL-03.

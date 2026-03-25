# Shared Artifacts Registry: hook-receiver-clarity

## Purpose

Every `${variable}` appearing in journey mockups has a single source of truth and documented consumers listed here. This registry is the integration validation baseline for the DESIGN and DISTILL waves.

---

## Registry

### file_description

```yaml
shared_artifacts:
  file_description:
    value: "Norbert Hook Receiver"
    source_of_truth: "norbert-hook-receiver/build.rs — Windows VERSIONINFO FileDescription field"
    consumers:
      - "Windows Task Manager — Description column (Step 2)"
      - "Windows file Properties dialog — File description field (Step 2)"
      - "Tray icon tooltip — title line (Steps 1, 3)"
      - "Tray context menu — title row (Step 4)"
    owner: "hook-receiver build pipeline"
    integration_risk: "LOW — static string embedded at compile time; no runtime coordination needed"
    validation: |
      Build-time: verify VERSIONINFO block in norbert-hook-receiver binary using sigcheck or
      PowerShell (Get-ItemProperty). Must equal 'Norbert Hook Receiver'.
      Runtime: not applicable — static metadata.
```

### port

```yaml
  port:
    value: "3748 (default); actual value from TcpListener::local_addr()"
    source_of_truth: "runtime — result of TcpListener::local_addr() after successful bind"
    consumers:
      - "Tray icon tooltip — ':${port}' (Step 3)"
      - "Tray context menu — 'Port: ${port}' (Step 4)"
    owner: "hook-receiver main loop (Axum server)"
    integration_risk: "MEDIUM — if bind fails, port is unavailable; tray must handle this gracefully"
    validation: |
      Happy path: confirm displayed port matches actual listening port via netstat or
      Process Monitor.
      Error path: if bind fails, tooltip must show 'Port: unavailable' — not crash.
```

### event_count

```yaml
  event_count:
    value: "cumulative integer; starts at 0 on process start"
    source_of_truth: "runtime — single atomic counter (AtomicU64 or equivalent) in hook receiver process memory"
    consumers:
      - "Tray icon tooltip — '${event_count} events' (Step 3)"
      - "Tray context menu — 'Events captured: ${event_count}' (Step 4)"
    owner: "hook receiver telemetry ingestion layer"
    integration_risk: "LOW — both tooltip and menu read from same counter; no cross-process sync needed"
    validation: |
      Verify tooltip and menu show same value when both are read in quick succession.
      Verify counter increments when a Claude Code hook event is received on port 3748.
      Verify counter resets to 0 on fresh process start (not persisted between runs).
```

---

## Integration Checkpoints Summary

| ID | Checkpoint | Risk | Steps Affected |
|----|-----------|------|----------------|
| IC-01 | `file_description` embedded correctly in binary | LOW | 1, 2, 3, 4 |
| IC-02 | `norbert.exe` FileDescription unchanged | LOW | 2 |
| IC-03 | Tray icon appears within 2 seconds of startup | MEDIUM | 1 |
| IC-04 | `port` reflects actual `TcpListener::local_addr()` | MEDIUM | 3, 4 |
| IC-05 | `event_count` is live (not cached/stale) | LOW | 3, 4 |
| IC-06 | Port and event_count are consistent between tooltip and menu | LOW | 3, 4 |
| IC-07 | Graceful quit flushes SQLite writes | HIGH | 5 |
| IC-08 | Tray icon removed before/on process exit | MEDIUM | 5 |

---

## Hardcoding Risk Register

| Location | Value | Hardcoded? | Correct Approach |
|----------|-------|-----------|-----------------|
| VERSIONINFO FileDescription | "Norbert Hook Receiver" | YES — intentional compile-time constant | Acceptable; change requires rebuild |
| Default port | 3748 | YES (configuration constant) | Acceptable; displayed port must come from actual bind result, not this constant |
| Drain timeout | 2 seconds | YES — to be confirmed in DESIGN wave | Acceptable; document as named constant, not magic number |
| event_count start value | 0 | YES — process-lifetime counter | Acceptable; not persisted to disk |

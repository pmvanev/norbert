# Handoff: hook-receiver-clarity Acceptance Tests

**To**: nw-functional-software-crafter (DELIVER wave)
**From**: acceptance-designer (DISTILL wave)
**Date**: 2026-03-25
**Feature**: hook-receiver-clarity

---

## Deliverables

| Artifact | Path |
|----------|------|
| Canonical feature file | `docs/feature/hook-receiver-clarity/distill/acceptance-tests.feature` |
| Rust test stubs | `tests/acceptance/hook-receiver-clarity/hook_receiver_clarity_tests.rs` |
| Peer review | `docs/feature/hook-receiver-clarity/distill/peer-review.yaml` |
| This handoff | `docs/feature/hook-receiver-clarity/distill/handoff.md` |

---

## Scenario Summary

17 scenarios total across 2 user stories.

| Category | Count | Scenarios |
|----------|-------|-----------|
| Walking skeletons | 2 | ws_01, ws_02 |
| VERSIONINFO (US-HRC-01) | 3 | versioninfo_01..03 |
| Tray presence/status (US-HRC-02) | 4 | tray_01..04 |
| Graceful shutdown (US-HRC-02) | 3 | shutdown_01..03 |
| Error / edge paths | 5 | error_01..05 |

Error/edge ratio: 5/17 = 29%. Justified by domain constraints — see peer-review.yaml.

---

## Mandate Compliance Evidence

### CM-A: Driving Port Boundary

All test stubs invoke the `norbert-hook-receiver.exe` binary as a black-box process via `start_hook_receiver_process()`. No import of internal components (`AppState`, `TrayManager`, `ShutdownCoordinator`, `SqliteEventStore`) appears in the test file.

The HTTP port `POST /hooks/:event_type` is used solely for the event count helper (`post_hook_events`) — exercising the binary's own ingestion boundary, not an internal adapter.

**Verification**: `grep -r "use norbert_lib" tests/acceptance/hook-receiver-clarity/` returns no results.

### CM-B: Business Language Purity

Gherkin audit — zero occurrences of:

- HTTP, POST, JSON, REST, API, status code (200/201/400/500)
- database, mutex, atomic, tokio, axum, Rust
- infrastructure terms (TcpListener, AtomicU64, CancellationToken)

Domain terms used: tray icon, tooltip, context menu, event count, bound port, File description, Product name, drain window, application log — all from the ubiquitous language in user-stories.md and shared-artifacts-registry.md.

**Verification**: `grep -Ei "(http|post|json|database|mutex|atomic|tokio|axum|status.code)" docs/feature/hook-receiver-clarity/distill/acceptance-tests.feature` returns no results.

### CM-C: Walking Skeleton + Focused Scenario Counts

- 2 walking skeletons (ws_01, ws_02) — each answers "Can Danielle accomplish her goal?"
- 15 focused scenarios — each tests one specific business rule at the binary boundary

Both walking skeletons pass the stakeholder demo litmus test (see peer-review.yaml).

---

## One-at-a-Time Implementation Sequence

All 17 Rust tests start with `#[ignore]`. Enable in this order:

```
1.  ws_01_danielle_identifies_sidecar_in_task_manager
2.  versioninfo_01_file_description_embedded_in_binary_at_rest
3.  versioninfo_02_product_name_embedded_in_binary_at_rest
4.  versioninfo_03_main_gui_file_description_unchanged
5.  tray_01_icon_appears_within_two_seconds_of_startup
6.  tray_02_tooltip_shows_live_port_and_event_count
7.  tray_03_context_menu_shows_status_and_quit_item
8.  tray_04_event_count_live_updates_in_tooltip
9.  ws_02_danielle_monitors_sidecar_and_quits_gracefully
10. shutdown_01_graceful_quit_with_no_pending_writes
11. shutdown_02_graceful_quit_waits_for_pending_write_within_drain_timeout
12. shutdown_03_forced_exit_on_slow_drain_logs_warning
13. error_01_tray_appears_with_unavailable_port_when_bind_fails
14. error_02_context_menu_shows_unavailable_port_when_bind_fails
15. error_03_event_count_not_incremented_when_hook_write_fails
16. error_04_process_exits_code_zero_after_forced_drain_timeout
17. error_05_event_count_resets_to_zero_on_fresh_process_start
```

Rationale: US-HRC-01 (compile-time, no runtime changes) is validated first — fast feedback, no new code risk. Tray scenarios build in complexity. Walking skeleton ws_02 placed after individual tray tests so each sub-behavior is proven before the full journey runs.

---

## Helper Stubs Requiring Implementation

The following test helpers are declared in the Rust file with `unimplemented!()`:

| Helper | What crafter implements |
|--------|------------------------|
| `read_file_description_from_binary` | `windows-sys` VerQueryValueW / GetFileVersionInfoW |
| `read_product_name_from_binary` | same pattern |
| `start_hook_receiver_process` | `tokio::process::Command::new(hook_receiver_bin())` |
| `start_hook_receiver_process_capturing_stderr` | same with `Stdio::piped()` on stderr |
| `wait_for_tray_icon` | poll Win32 Shell_NotifyIconGetRect or tray icon enumeration |
| `read_tray_tooltip` | retrieve tooltip string from notification area |
| `read_tray_context_menu` | open right-click menu, enumerate items into `TrayMenu` |
| `click_tray_quit_item` | Win32 SendMessage to tray, select Quit |
| `tray_icon_is_visible` | Shell_NotifyIconGetRect presence check |
| `post_hook_events` | `reqwest` or `tokio::net` POST to `http://127.0.0.1:3748/hooks/PreToolUse` |
| `occupy_port` | `TcpListener::bind("127.0.0.1:3748")` returning the listener as a guard |
| `port_is_free` | poll `TcpListener::bind` in a loop until success or timeout |
| `inject_slow_write` | test seam in hook receiver (special hook event type or test-only endpoint) |
| `configure_storage_to_reject_next_write` | fault injection seam for storage |
| `submit_one_hook_event_expecting_error` | POST and assert non-success |
| `TrayMenu::{contains_item, contains_header, contains_clickable_item}` | menu item inspection |

Note on `inject_slow_write` and `configure_storage_to_reject_next_write`: these require a test seam in the hook receiver binary. The crafter should evaluate whether a test-only HTTP endpoint (e.g., `POST /test/inject-slow-write`) or a compile-time feature flag is the appropriate mechanism. This is an inner-loop implementation decision.

---

## Definition of Done Checklist

- [x] All 17 acceptance scenarios written in Gherkin (acceptance-tests.feature)
- [x] All 17 Rust test stubs created with `#[ignore]` (hook_receiver_clarity_tests.rs)
- [x] Walking skeleton count: 2
- [x] Focused scenario count: 15
- [x] Peer review: approved (peer-review.yaml)
- [x] CM-A: driving port boundary verified — no internal imports
- [x] CM-B: business language purity verified — zero technical terms in Gherkin
- [x] CM-C: walking skeleton + focused scenario counts verified
- [ ] First scenario enabled and runs (fails for production code reason, not test infrastructure) — DELIVER wave responsibility
- [ ] Tests run in CI/CD pipeline — DELIVER wave responsibility
- [ ] Feature demo-able to stakeholders from acceptance tests — DELIVER wave responsibility

---

## Notes for Crafter

- All tray tests require `#[cfg(target_os = "windows")]`. Non-Windows CI jobs skip them automatically.
- The `inject_slow_write` and fault-injection helpers require test seams. Design these as the narrowest possible surface (avoid leaking test concerns into production paths).
- `DRAIN_TIMEOUT_SECS` is a named constant in the production code — tests assert timing relative to it. If the crafter changes the default, update the test timing expectations accordingly.
- The `bound_port` sentinel value is `0` (AtomicU32) per ADR-040. The tray displays "Port: unavailable" when `bound_port == 0`. Tests assert the user-visible string, not the sentinel value.

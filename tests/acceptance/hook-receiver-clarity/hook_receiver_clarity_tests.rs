//! Acceptance tests — hook-receiver-clarity feature
//!
//! Maps to: docs/feature/hook-receiver-clarity/distill/acceptance-tests.feature
//! Driving port: norbert-hook-receiver.exe binary (process spawn boundary)
//!               + HTTP server at POST /hooks/:event_type (event count validation)
//!
//! Framework: #[tokio::test] + assert_cmd (process inspection)
//!            windows-sys for PE VERSIONINFO reads
//!
//! Outside-In TDD pattern: all tests start #[ignore].
//! Enable one at a time, implement to pass, commit, repeat.
//! Windows-only scenarios additionally gated with #[cfg(target_os = "windows")].
//!
//! Scenario index
//! ──────────────
//! WALKING SKELETONS (2)
//!   ws_01_danielle_identifies_sidecar_in_task_manager
//!   ws_02_danielle_monitors_sidecar_and_quits_gracefully
//!
//! FOCUSED — Process Identity / VERSIONINFO (3)
//!   versioninfo_01_file_description_embedded_in_binary_at_rest
//!   versioninfo_02_product_name_embedded_in_binary_at_rest
//!   versioninfo_03_main_gui_file_description_unchanged
//!
//! FOCUSED — Tray Presence and Status (4)
//!   tray_01_icon_appears_within_two_seconds_of_startup
//!   tray_02_tooltip_shows_live_port_and_event_count
//!   tray_03_context_menu_shows_status_and_quit_item
//!   tray_04_event_count_live_updates_in_tooltip
//!
//! FOCUSED — Graceful Shutdown (3)
//!   shutdown_01_graceful_quit_with_no_pending_writes
//!   shutdown_02_graceful_quit_waits_for_pending_write_within_drain_timeout
//!   shutdown_03_forced_exit_on_slow_drain_logs_warning
//!
//! FOCUSED — Error / Edge Paths (5)
//!   error_01_tray_appears_with_unavailable_port_when_bind_fails
//!   error_02_context_menu_shows_unavailable_port_when_bind_fails
//!   error_03_event_count_not_incremented_when_hook_write_fails
//!   error_04_process_exits_code_zero_after_forced_drain_timeout
//!   error_05_event_count_resets_to_zero_on_fresh_process_start
//!
//! Total: 17 scenarios.  Error/edge: 5 of 17 = 29%.
//! (Domain is compile-time metadata + tray state; error surface is narrow by design.)

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers — shared across all scenarios
// ─────────────────────────────────────────────────────────────────────────────

/// Path to the compiled hook receiver binary produced by `cargo build`.
///
/// Tests spawn this as a subprocess and treat it as a black box.
fn hook_receiver_bin() -> std::path::PathBuf {
    // assert_cmd can locate via env::var("CARGO_BIN_EXE_norbert-hook-receiver")
    // when run via `cargo test`. Provide a sensible default for IDE runners.
    if let Ok(path) = std::env::var("CARGO_BIN_EXE_norbert-hook-receiver") {
        return std::path::PathBuf::from(path);
    }
    // Fallback: target/debug/norbert-hook-receiver(.exe)
    let mut p = std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    p.push("norbert-hook-receiver");
    #[cfg(target_os = "windows")]
    p.set_extension("exe");
    p
}

/// Path to the compiled main GUI binary produced by `cargo build`.
fn norbert_gui_bin() -> std::path::PathBuf {
    if let Ok(path) = std::env::var("CARGO_BIN_EXE_norbert") {
        return std::path::PathBuf::from(path);
    }
    let mut p = std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    p.push("norbert");
    #[cfg(target_os = "windows")]
    p.set_extension("exe");
    p
}

// ─────────────────────────────────────────────────────────────────────────────
// WALKING SKELETON 1
// US-HRC-01 — Danielle identifies the sidecar at a glance
// ─────────────────────────────────────────────────────────────────────────────

/// @walking_skeleton
///
/// Scenario: Danielle identifies the hook receiver instantly in Task Manager
///
/// Given norbert-hook-receiver.exe is present on Danielle's machine
/// When Danielle opens Windows Task Manager and looks at the Description column
/// Then the hook receiver shows "Norbert Hook Receiver"
/// And norbert.exe shows "Norbert"
/// And Danielle can tell the two processes apart without expanding any extra columns
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn ws_01_danielle_identifies_sidecar_in_task_manager() {
    // STEP: read FileDescription from hook receiver PE resource
    let hr_bin = hook_receiver_bin();
    assert!(
        hr_bin.exists(),
        "norbert-hook-receiver.exe must be built before running acceptance tests"
    );
    let hr_description = read_file_description_from_binary(&hr_bin);
    assert_eq!(
        hr_description, "Norbert Hook Receiver",
        "Hook receiver description must be 'Norbert Hook Receiver' — as shown in Task Manager Description column"
    );

    // STEP: read FileDescription from main GUI PE resource (regression guard)
    let gui_bin = norbert_gui_bin();
    assert!(gui_bin.exists(), "norbert.exe must be built before running acceptance tests");
    let gui_description = read_file_description_from_binary(&gui_bin);
    assert_eq!(
        gui_description, "Norbert",
        "Main GUI description must remain 'Norbert' — no regression introduced"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// WALKING SKELETON 2
// US-HRC-02 — Danielle monitors the running sidecar and quits it gracefully
// ─────────────────────────────────────────────────────────────────────────────

/// @walking_skeleton
///
/// Scenario: Danielle monitors the running sidecar and quits it gracefully
///
/// Given Danielle starts norbert-hook-receiver.exe
/// And the sidecar successfully binds to its port
/// When Danielle sees the tray icon, hovers for status, then clicks Quit
/// Then the tray icon disappears from the system tray
/// And the process exits with code 0
/// And the bound port is released within 1 second
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn ws_02_danielle_monitors_sidecar_and_quits_gracefully() {
    // GIVEN: hook receiver process is started
    let mut child = start_hook_receiver_process().await;

    // GIVEN: wait for tray icon to appear (up to 2 seconds)
    let tray_appeared = wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;
    assert!(tray_appeared, "Tray icon must appear within 2 seconds of process start");

    // GIVEN: verify tooltip shows name and port
    let tooltip = read_tray_tooltip("Norbert Hook Receiver").await;
    assert!(
        tooltip.contains("Norbert Hook Receiver"),
        "Tooltip must identify the process by name"
    );

    // WHEN: Danielle clicks Quit in the tray context menu
    click_tray_quit_item("Norbert Hook Receiver").await;

    // THEN: process exits with code 0
    let status = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        async { child.wait().await.unwrap() },
    )
    .await
    .expect("Process must exit within 5 seconds of Quit");
    assert_eq!(status.code(), Some(0), "Process must exit with code 0");

    // THEN: port released within 1 second
    let port_released = port_is_free(3748, std::time::Duration::from_secs(1)).await;
    assert!(port_released, "Bound port must be released within 1 second of clean exit");
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUSED — Process Identity / VERSIONINFO (US-HRC-01)
// ─────────────────────────────────────────────────────────────────────────────

/// Scenario: FileDescription is embedded in the hook receiver binary at rest
///
/// Given norbert-hook-receiver.exe is present on disk but not running
/// When the Windows PE resource metadata is read from the binary
/// Then the File description field reads "Norbert Hook Receiver"
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn versioninfo_01_file_description_embedded_in_binary_at_rest() {
    let bin = hook_receiver_bin();
    assert!(bin.exists(), "norbert-hook-receiver.exe must exist on disk");

    let description = read_file_description_from_binary(&bin);
    assert_eq!(
        description, "Norbert Hook Receiver",
        "FileDescription PE resource must read 'Norbert Hook Receiver'"
    );
}

/// Scenario: ProductName is embedded in the hook receiver binary at rest
///
/// Given norbert-hook-receiver.exe is present on disk but not running
/// When the Windows PE resource metadata is read from the binary
/// Then the Product name field reads "Norbert"
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn versioninfo_02_product_name_embedded_in_binary_at_rest() {
    let bin = hook_receiver_bin();
    assert!(bin.exists(), "norbert-hook-receiver.exe must exist on disk");

    let product_name = read_product_name_from_binary(&bin);
    assert_eq!(
        product_name, "Norbert",
        "ProductName PE resource must read 'Norbert'"
    );
}

/// Scenario: Main GUI binary metadata is unchanged after this feature ships
///
/// Given a fresh build of norbert.exe has been produced
/// When the Windows PE resource metadata is read from the binary
/// Then the File description field still reads "Norbert"
/// And no regression has been introduced to the main GUI binary metadata
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn versioninfo_03_main_gui_file_description_unchanged() {
    let bin = norbert_gui_bin();
    assert!(bin.exists(), "norbert.exe must exist on disk");

    let description = read_file_description_from_binary(&bin);
    assert_eq!(
        description, "Norbert",
        "Main GUI FileDescription must remain 'Norbert' — hook-receiver-clarity must not regress the GUI binary"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUSED — Tray Presence and Status (US-HRC-02)
// ─────────────────────────────────────────────────────────────────────────────

/// Scenario: Tray icon appears within 2 seconds of process startup
///
/// Given norbert-hook-receiver.exe is started on Danielle's machine
/// When the hook receiver successfully binds to its port
/// Then the "Norbert Hook Receiver" tray icon is visible in the system tray
/// And the icon appears within 2 seconds of the process starting
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn tray_01_icon_appears_within_two_seconds_of_startup() {
    let _child = start_hook_receiver_process().await;

    let appeared = wait_for_tray_icon(
        "Norbert Hook Receiver",
        std::time::Duration::from_secs(2),
    )
    .await;
    assert!(
        appeared,
        "Tray icon must appear within 2 seconds of process start"
    );
}

/// Scenario: Tray tooltip shows live port and event count
///
/// Given norbert-hook-receiver.exe is running and has captured 42 telemetry events
/// When Danielle hovers over the tray icon
/// Then the tooltip displays "Norbert Hook Receiver"
/// And the tooltip displays the bound port (":3748")
/// And the tooltip displays the event count ("42 events")
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn tray_02_tooltip_shows_live_port_and_event_count() {
    let _child = start_hook_receiver_process().await;
    wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;

    // GIVEN: 42 telemetry events have been captured
    post_hook_events(42).await;

    // WHEN: tooltip is read
    let tooltip = read_tray_tooltip("Norbert Hook Receiver").await;

    // THEN: tooltip contains name, port, and event count
    assert!(
        tooltip.contains("Norbert Hook Receiver"),
        "Tooltip must show process name"
    );
    assert!(
        tooltip.contains(":3748") || tooltip.contains("3748"),
        "Tooltip must show bound port"
    );
    assert!(
        tooltip.contains("42 events"),
        "Tooltip must show event count as '42 events'"
    );
}

/// Scenario: Tray context menu shows status header, port, event count, and Quit item
///
/// Given norbert-hook-receiver.exe is running on port 3748 with 42 events captured
/// When Danielle right-clicks the tray icon
/// Then the context menu shows "Norbert Hook Receiver" as a non-clickable header
/// And the menu shows "Port: 3748"
/// And the menu shows "Events captured: 42"
/// And the menu contains a clickable "Quit" item
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn tray_03_context_menu_shows_status_and_quit_item() {
    let _child = start_hook_receiver_process().await;
    wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;

    post_hook_events(42).await;

    let menu = read_tray_context_menu("Norbert Hook Receiver").await;

    assert!(
        menu.contains_header("Norbert Hook Receiver"),
        "Context menu must show 'Norbert Hook Receiver' as a non-clickable title"
    );
    assert!(
        menu.contains_item("Port: 3748"),
        "Context menu must show bound port as 'Port: 3748'"
    );
    assert!(
        menu.contains_item("Events captured: 42"),
        "Context menu must show event count as 'Events captured: 42'"
    );
    assert!(
        menu.contains_clickable_item("Quit"),
        "Context menu must contain a clickable 'Quit' item"
    );
}

/// Scenario: Event count in tooltip reflects the live counter
///
/// Given norbert-hook-receiver.exe was showing 42 events in the tray tooltip
/// When the hook receiver captures 3 more telemetry events
/// And Danielle hovers over the tray icon again
/// Then the tooltip now shows "45 events"
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn tray_04_event_count_live_updates_in_tooltip() {
    let _child = start_hook_receiver_process().await;
    wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;

    post_hook_events(42).await;
    let tooltip_before = read_tray_tooltip("Norbert Hook Receiver").await;
    assert!(tooltip_before.contains("42 events"), "Baseline: tooltip shows 42 events");

    // WHEN: 3 more events arrive
    post_hook_events(3).await;

    // THEN: tooltip now shows 45
    let tooltip_after = read_tray_tooltip("Norbert Hook Receiver").await;
    assert!(
        tooltip_after.contains("45 events"),
        "Tooltip must reflect the live counter: 42 + 3 = 45 events"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUSED — Graceful Shutdown (US-HRC-02)
// ─────────────────────────────────────────────────────────────────────────────

/// Scenario: Graceful shutdown via tray Quit with no pending writes
///
/// Given norbert-hook-receiver.exe is running with no pending writes in flight
/// When Danielle clicks "Quit" in the tray context menu
/// Then the tray icon disappears from the system tray
/// And port 3748 is released within 1 second
/// And the process exits with code 0
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn shutdown_01_graceful_quit_with_no_pending_writes() {
    let mut child = start_hook_receiver_process().await;
    wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;

    // WHEN: Danielle clicks Quit
    click_tray_quit_item("Norbert Hook Receiver").await;

    // THEN: process exits 0
    let status = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        async { child.wait().await.unwrap() },
    )
    .await
    .expect("Process must exit within 5 seconds");
    assert_eq!(status.code(), Some(0), "Exit code must be 0");

    // THEN: port released
    let released = port_is_free(3748, std::time::Duration::from_secs(1)).await;
    assert!(released, "Port 3748 must be released within 1 second");

    // THEN: tray icon gone
    let icon_still_present = tray_icon_is_visible("Norbert Hook Receiver").await;
    assert!(!icon_still_present, "Tray icon must disappear after Quit");
}

/// Scenario: Graceful shutdown waits for a pending write that completes within the drain timeout
///
/// Given norbert-hook-receiver.exe has a write in flight that completes within 2 seconds
/// When Danielle clicks "Quit" in the tray context menu
/// Then the process waits for the write to complete before exiting
/// And the tray icon disappears after the write completes
/// And the process exits with code 0
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn shutdown_02_graceful_quit_waits_for_pending_write_within_drain_timeout() {
    let mut child = start_hook_receiver_process().await;
    wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;

    // GIVEN: inject a write that holds the drain gate for ~1 second
    inject_slow_write(std::time::Duration::from_millis(1000)).await;

    // WHEN: Danielle clicks Quit
    let quit_at = std::time::Instant::now();
    click_tray_quit_item("Norbert Hook Receiver").await;

    // THEN: process exits 0 after the write completes (not immediately)
    let status = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        async { child.wait().await.unwrap() },
    )
    .await
    .expect("Process must exit within 5 seconds");
    let elapsed = quit_at.elapsed();
    assert_eq!(status.code(), Some(0), "Exit code must be 0");
    assert!(
        elapsed >= std::time::Duration::from_millis(900),
        "Process must have waited for the write to complete — elapsed: {:?}",
        elapsed
    );
}

/// Scenario: Forced exit when drain exceeds timeout, with warning logged
///
/// Given norbert-hook-receiver.exe has a write taking longer than the drain timeout
/// When Danielle clicks "Quit" in the tray context menu
/// Then the process waits up to the drain timeout
/// And the process exits anyway with code 0
/// And a warning is written to the application log indicating an incomplete drain
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn shutdown_03_forced_exit_on_slow_drain_logs_warning() {
    let mut child = start_hook_receiver_process_capturing_stderr().await;
    wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;

    // GIVEN: inject a write that will outlast the drain timeout (3 seconds > 2 second timeout)
    inject_slow_write(std::time::Duration::from_secs(3)).await;

    // WHEN: Danielle clicks Quit
    let quit_at = std::time::Instant::now();
    click_tray_quit_item("Norbert Hook Receiver").await;

    // THEN: exits within ~3 seconds (drain timeout 2s + small buffer)
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        async { child.wait_with_output().await.unwrap() },
    )
    .await
    .expect("Process must exit within 5 seconds after forced drain");
    let elapsed = quit_at.elapsed();

    assert_eq!(output.status.code(), Some(0), "Exit code must be 0 even after forced drain");
    assert!(
        elapsed >= std::time::Duration::from_secs(2),
        "Process must have waited the full drain timeout — elapsed: {:?}",
        elapsed
    );

    // THEN: warning appears in stderr
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.to_lowercase().contains("drain") || stderr.to_lowercase().contains("incomplete"),
        "Stderr must contain a warning about incomplete drain — got: {}",
        stderr
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUSED — Error / Edge Paths
// ─────────────────────────────────────────────────────────────────────────────

/// Scenario: Tray icon appears with "Port: unavailable" when port bind fails
///
/// Given port 3748 is already occupied by another process on Danielle's machine
/// When norbert-hook-receiver.exe starts up
/// Then the tray icon still appears in the system tray
/// And the tray tooltip shows "Norbert Hook Receiver" and "Port: unavailable"
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn error_01_tray_appears_with_unavailable_port_when_bind_fails() {
    // GIVEN: occupy port 3748
    let _blocker = occupy_port(3748).await;
    let _child = start_hook_receiver_process().await;

    // THEN: tray icon still appears
    let appeared = wait_for_tray_icon(
        "Norbert Hook Receiver",
        std::time::Duration::from_secs(3),
    )
    .await;
    assert!(appeared, "Tray icon must appear even when port bind fails");

    // THEN: tooltip shows "Port: unavailable"
    let tooltip = read_tray_tooltip("Norbert Hook Receiver").await;
    assert!(
        tooltip.contains("Port: unavailable"),
        "Tooltip must show 'Port: unavailable' when bind fails — got: {}",
        tooltip
    );
}

/// Scenario: Context menu shows "Port: unavailable" when port bind fails
///
/// Given port 3748 is already occupied by another process on Danielle's machine
/// When norbert-hook-receiver.exe starts and Danielle right-clicks the tray icon
/// Then the context menu shows "Port: unavailable" in the port field
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn error_02_context_menu_shows_unavailable_port_when_bind_fails() {
    // GIVEN: occupy port 3748
    let _blocker = occupy_port(3748).await;
    let _child = start_hook_receiver_process().await;
    wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(3)).await;

    // WHEN: context menu opened
    let menu = read_tray_context_menu("Norbert Hook Receiver").await;

    // THEN: port field shows unavailable
    assert!(
        menu.contains_item("Port: unavailable"),
        "Context menu must show 'Port: unavailable' when bind failed"
    );
}

/// Scenario: Event count is not incremented when a hook write returns an error
///
/// Given norbert-hook-receiver.exe is running with 0 events captured
/// And the storage layer is configured to reject the next write
/// When a hook event is submitted to the hook receiver
/// Then the event count remains 0
/// And no increment is reflected in the tray tooltip
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn error_03_event_count_not_incremented_when_hook_write_fails() {
    let _child = start_hook_receiver_process().await;
    wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;

    // GIVEN: baseline count is 0
    let tooltip_before = read_tray_tooltip("Norbert Hook Receiver").await;
    assert!(
        tooltip_before.contains("0 events"),
        "Baseline event count must be 0 — got: {}",
        tooltip_before
    );

    // GIVEN: storage is configured to reject the next write
    configure_storage_to_reject_next_write().await;

    // WHEN: a hook event is submitted
    submit_one_hook_event_expecting_error().await;

    // THEN: event count is still 0
    let tooltip_after = read_tray_tooltip("Norbert Hook Receiver").await;
    assert!(
        tooltip_after.contains("0 events"),
        "Event count must not increment when write fails — got: {}",
        tooltip_after
    );
}

/// Scenario: Process exits with code 0 even after forced drain timeout
///
/// Given norbert-hook-receiver.exe has a write that will outlast the drain timeout
/// When Danielle clicks "Quit" and the process force-exits after the timeout
/// Then the process exit code is 0
/// And the tray icon is removed before or on exit
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn error_04_process_exits_code_zero_after_forced_drain_timeout() {
    let mut child = start_hook_receiver_process().await;
    wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;

    inject_slow_write(std::time::Duration::from_secs(3)).await;
    click_tray_quit_item("Norbert Hook Receiver").await;

    let status = tokio::time::timeout(
        std::time::Duration::from_secs(6),
        async { child.wait().await.unwrap() },
    )
    .await
    .expect("Process must exit after forced drain timeout");
    assert_eq!(
        status.code(),
        Some(0),
        "Exit code must be 0 even after forced drain — graceful forced exit, not crash"
    );

    // THEN: tray icon no longer visible
    let still_visible = tray_icon_is_visible("Norbert Hook Receiver").await;
    assert!(!still_visible, "Tray icon must be removed on process exit");
}

/// Scenario: Event count resets to 0 on fresh process start (not persisted between runs)
///
/// Given norbert-hook-receiver.exe has previously captured 50 events and exited
/// When norbert-hook-receiver.exe is started fresh
/// Then the tray tooltip shows "0 events"
#[cfg(target_os = "windows")]
#[tokio::test]
#[ignore]
async fn error_05_event_count_resets_to_zero_on_fresh_process_start() {
    // GIVEN: first run — capture 50 events, then quit
    {
        let mut child = start_hook_receiver_process().await;
        wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;
        post_hook_events(50).await;
        click_tray_quit_item("Norbert Hook Receiver").await;
        let _ = child.wait().await;
    }

    // WHEN: fresh process start
    let _child = start_hook_receiver_process().await;
    wait_for_tray_icon("Norbert Hook Receiver", std::time::Duration::from_secs(2)).await;

    // THEN: event count starts at 0
    let tooltip = read_tray_tooltip("Norbert Hook Receiver").await;
    assert!(
        tooltip.contains("0 events"),
        "Event count must reset to 0 on fresh process start — got: {}",
        tooltip
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub helpers — signatures only; software-crafter implements these
// ─────────────────────────────────────────────────────────────────────────────
//
// These stubs declare the helper boundary so the DELIVER wave crafter knows
// exactly what to implement. All are marked unimplemented!() — they will
// compile but panic if called before implementation.

/// Read the FileDescription field from the PE VERSIONINFO resource in the given binary.
///
/// Windows implementation: use windows-sys VerQueryValueW / GetFileVersionInfoW.
#[cfg(target_os = "windows")]
fn read_file_description_from_binary(_bin: &std::path::Path) -> String {
    unimplemented!("software-crafter implements: read PE VERSIONINFO FileDescription using windows-sys")
}

/// Read the ProductName field from the PE VERSIONINFO resource in the given binary.
#[cfg(target_os = "windows")]
fn read_product_name_from_binary(_bin: &std::path::Path) -> String {
    unimplemented!("software-crafter implements: read PE VERSIONINFO ProductName using windows-sys")
}

/// Spawn the hook receiver binary as a subprocess and return the child handle.
#[cfg(target_os = "windows")]
async fn start_hook_receiver_process() -> tokio::process::Child {
    unimplemented!("software-crafter implements: spawn hook receiver via Command::new(hook_receiver_bin())")
}

/// Spawn the hook receiver binary capturing stderr for log inspection.
#[cfg(target_os = "windows")]
async fn start_hook_receiver_process_capturing_stderr() -> tokio::process::Child {
    unimplemented!("software-crafter implements: spawn with Stdio::piped() on stderr")
}

/// Wait up to `timeout` for a tray icon with the given tooltip prefix to become visible.
///
/// Returns true if the icon appeared before the timeout.
#[cfg(target_os = "windows")]
async fn wait_for_tray_icon(_name: &str, _timeout: std::time::Duration) -> bool {
    unimplemented!("software-crafter implements: poll Win32 Shell_NotifyIconGetRect or enumerate tray icons")
}

/// Read the current tooltip text for the tray icon identified by `name`.
#[cfg(target_os = "windows")]
async fn read_tray_tooltip(_name: &str) -> String {
    unimplemented!("software-crafter implements: retrieve tooltip string from Win32 tray notification area")
}

/// Read the items from the tray context menu for the tray icon identified by `name`.
///
/// Returns a `TrayMenu` handle with `contains_item`, `contains_header`, and
/// `contains_clickable_item` inspection methods.
#[cfg(target_os = "windows")]
async fn read_tray_context_menu(_name: &str) -> TrayMenu {
    unimplemented!("software-crafter implements: open right-click menu and enumerate menu items")
}

/// Click the "Quit" item in the tray context menu for the named icon.
#[cfg(target_os = "windows")]
async fn click_tray_quit_item(_name: &str) {
    unimplemented!("software-crafter implements: simulate right-click + select Quit via Win32 SendMessage")
}

/// Returns true if the named tray icon is currently visible in the notification area.
#[cfg(target_os = "windows")]
async fn tray_icon_is_visible(_name: &str) -> bool {
    unimplemented!("software-crafter implements: check tray icon presence via Win32 Shell_NotifyIconGetRect")
}

/// Post `count` well-formed hook events to the running hook receiver HTTP server.
#[cfg(target_os = "windows")]
async fn post_hook_events(_count: u64) {
    unimplemented!("software-crafter implements: POST to http://127.0.0.1:3748/hooks/PreToolUse N times")
}

/// Bind a TCP listener on `port` to simulate a port conflict. Returns a guard that
/// releases the port when dropped.
#[cfg(target_os = "windows")]
async fn occupy_port(_port: u16) -> tokio::net::TcpListener {
    unimplemented!("software-crafter implements: TcpListener::bind(127.0.0.1:port)")
}

/// Poll until `port` is no longer in use, or `timeout` elapses.
///
/// Returns true if the port became free within the timeout.
#[cfg(target_os = "windows")]
async fn port_is_free(_port: u16, _timeout: std::time::Duration) -> bool {
    unimplemented!("software-crafter implements: attempt TcpListener::bind in a poll loop")
}

/// Inject a write into the hook receiver that will hold the drain gate for `duration`.
///
/// Implementation: requires test seam in hook receiver (e.g. a special hook event type
/// that simulates a slow SQLite write, or a test-only HTTP endpoint).
#[cfg(target_os = "windows")]
async fn inject_slow_write(_duration: std::time::Duration) {
    unimplemented!("software-crafter implements: test seam to inject a delayed write into drain gate")
}

/// Configure the storage layer to reject the next write.
#[cfg(target_os = "windows")]
async fn configure_storage_to_reject_next_write() {
    unimplemented!("software-crafter implements: test seam — fault injection for storage write failure")
}

/// Submit one hook event to the hook receiver and expect an error response.
#[cfg(target_os = "windows")]
async fn submit_one_hook_event_expecting_error() {
    unimplemented!("software-crafter implements: POST to /hooks/PreToolUse and assert non-200 response")
}

/// Opaque handle returned by `read_tray_context_menu`.
#[cfg(target_os = "windows")]
struct TrayMenu {
    _items: Vec<TrayMenuItem>,
}

#[cfg(target_os = "windows")]
struct TrayMenuItem {
    _text: String,
    _is_clickable: bool,
    _is_header: bool,
}

#[cfg(target_os = "windows")]
impl TrayMenu {
    fn contains_item(&self, _text: &str) -> bool {
        unimplemented!("software-crafter implements")
    }
    fn contains_header(&self, _text: &str) -> bool {
        unimplemented!("software-crafter implements")
    }
    fn contains_clickable_item(&self, _text: &str) -> bool {
        unimplemented!("software-crafter implements")
    }
}

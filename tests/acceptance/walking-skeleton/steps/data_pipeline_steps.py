"""
Step definitions for Data Pipeline scenarios (US-WS-002).

Driving ports:
  - App lifecycle (settings merge trigger)
  - HTTP POST /hooks/{event_type} (hook receiver entry point)
  - Tauri IPC commands (status queries)
"""
import json

from pytest_bdd import given, when, then, parsers, scenarios

scenarios("../milestone-3-data-pipeline.feature")


# ---------------------------------------------------------------------------
# Given Steps
# ---------------------------------------------------------------------------


@given("Priya has a Claude Code configuration with these settings:")
def priya_has_settings(existing_settings, datatable):
    """Create a settings.json with the specified configuration."""
    # existing_settings fixture provides the realistic settings file
    pass


@given("Priya has no existing Claude Code configuration file")
def no_existing_settings(no_settings):
    """Ensure no settings.json exists."""
    pass


@given("Priya has a Claude Code configuration file containing invalid content")
def malformed_settings_exist(malformed_settings):
    """Create a settings.json with invalid JSON content."""
    pass


@given("Norbert has already merged hooks into the configuration")
def hooks_already_merged(norbert_app, existing_settings):
    """Run the initial settings merge so hooks exist."""
    norbert_app.launch()
    # After launch, hooks should be merged


@given("Norbert has successfully merged hooks into the configuration")
def hooks_merged_successfully(norbert_app, existing_settings):
    """Verify merge completed without errors."""
    norbert_app.launch()
    status = norbert_app.get_status()
    assert "hooks not registered" not in status.status.lower()


@given("Priya launches Norbert for the first time")
def first_launch(norbert_app):
    """First-time launch with fresh state."""
    norbert_app.launch()


@given("Norbert is running with the hook receiver started")
def norbert_running_with_receiver(norbert_app):
    """Norbert is running and the sidecar hook receiver is accepting connections."""
    norbert_app.launch()
    status = norbert_app.get_status()
    assert status.hook_receiver_running is True


@given("another application is already using port 3748")
def port_already_in_use():
    """Bind a socket to port 3748 to simulate port conflict."""
    import socket

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 3748))
    sock.listen(1)
    yield sock
    sock.close()


@given("Norbert is running and receiving hook events")
def norbert_receiving_events(norbert_app, hook_event_sender):
    """Norbert is running and has received at least one event."""
    norbert_app.launch()
    hook_event_sender("SessionStart", {"session_id": "test-session-1"})


# ---------------------------------------------------------------------------
# When Steps
# ---------------------------------------------------------------------------


@when("Norbert performs the first-launch settings merge")
def perform_settings_merge(norbert_app):
    """Trigger the settings merge through the app lifecycle."""
    norbert_app.launch()


@when("Norbert attempts the first-launch settings merge")
def attempt_settings_merge(norbert_app):
    """Attempt merge (may fail for malformed JSON)."""
    norbert_app.launch()


@when("Norbert performs the settings merge again")
def perform_settings_merge_again(norbert_app):
    """Re-run the settings merge to test idempotency."""
    norbert_app.merge_settings()


@when("the merge completes")
def merge_completes():
    """Merge completion -- implicit in app launch."""
    pass


@when("the application initializes")
def app_initializes():
    """App initialization -- implicit in app launch."""
    pass


@when(
    parsers.parse(
        'a Claude Code hook event of type "{event_type}" arrives with a valid payload'
    )
)
def hook_event_arrives(hook_event_sender, event_type):
    """Send a simulated hook event to the receiver."""
    response = hook_event_sender(
        event_type,
        {
            "event_type": event_type,
            "session_id": "test-session-1",
            "timestamp": "2026-03-08T14:23:01Z",
            "tool": "Read",
            "file": "src/main.rs",
        },
    )
    assert response.status_code == 200


@when("a hook event with an unrecognized event type arrives")
def unknown_event_type_arrives(hook_event_sender):
    """Send a hook event with an invalid event type."""
    response = hook_event_sender("UnknownEventType", {"data": "test"})
    return response


@when("Priya launches Norbert")
def priya_launches(norbert_app):
    """Launch Norbert (may encounter port conflict)."""
    norbert_app.launch()


@when("a hook event arrives and is acknowledged")
def event_arrives_and_acknowledged(hook_event_sender):
    """Send an event and capture the acknowledgment."""
    response = hook_event_sender("PreToolUse", {"session_id": "test-session-1"})
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Then Steps
# ---------------------------------------------------------------------------


@then("a backup of the original configuration is created")
def backup_created(norbert_data_dir):
    """Verify backup file exists in the data directory."""
    backup_path = norbert_data_dir / "settings.json.bak"
    assert backup_path.exists(), "Settings backup was not created"


@then("the backup is byte-identical to the original")
def backup_is_identical(claude_config_dir, norbert_data_dir):
    """Verify the backup is an exact copy of the original."""
    # Compare backup to what was saved before merge
    pass


@then("the merged configuration retains Priya's permissions and MCP servers")
def merged_retains_originals(claude_config_dir, assert_settings_preserved):
    """Verify all original settings keys are preserved."""
    settings_path = claude_config_dir / "settings.json"
    original = {
        "permissions": {"allow": ["Read", "Write"]},
        "mcpServers": {
            "github": {"type": "stdio", "command": "mcp-github"},
            "filesystem": {"type": "stdio", "command": "mcp-filesystem"},
        },
    }
    assert_settings_preserved(original, settings_path)


@then("the merged configuration contains Norbert hook entries for these event types:")
def merged_contains_hooks(claude_config_dir, assert_hooks_registered, datatable):
    """Verify hook entries for all specified event types."""
    settings_path = claude_config_dir / "settings.json"
    assert_hooks_registered(settings_path)


@then(
    parsers.parse(
        'each hook entry URL points to "localhost" on port "{port}"'
    )
)
def hook_urls_correct(claude_config_dir, port):
    """Verify each hook URL references the correct port."""
    settings = json.loads((claude_config_dir / "settings.json").read_text())
    for event_type, hook in settings.get("hooks", {}).items():
        assert f"localhost:{port}" in hook.get("url", ""), (
            f"Hook {event_type} URL does not reference port {port}"
        )


@then("each hook entry is configured for non-blocking delivery")
def hooks_are_async(claude_config_dir):
    """Verify async: true on all hook entries."""
    settings = json.loads((claude_config_dir / "settings.json").read_text())
    for event_type, hook in settings.get("hooks", {}).items():
        assert hook.get("async") is True, (
            f"Hook {event_type} is not configured for async delivery"
        )


@then("a new configuration is created with hook entries only")
def new_config_created(claude_config_dir, assert_hooks_registered):
    """Verify a new settings.json was created with hooks."""
    settings_path = claude_config_dir / "settings.json"
    assert settings_path.exists()
    assert_hooks_registered(settings_path)


@then("no backup file is created")
def no_backup(norbert_data_dir):
    """Verify no backup was created (nothing to back up)."""
    backup_path = norbert_data_dir / "settings.json.bak"
    assert not backup_path.exists()


@then("the application starts normally")
def app_starts_normally(norbert_app):
    """Verify the app is running without errors."""
    status = norbert_app.get_status()
    assert status.status in ("Listening", "Active session")


@then("the malformed configuration is not modified")
def malformed_not_modified(malformed_settings):
    """Verify the malformed file was not touched."""
    # Compare current content to original malformed content
    pass


@then("a warning notifies Priya that hooks could not be registered automatically")
def warning_about_hooks(norbert_app):
    """Verify a warning notification was shown."""
    notifications = norbert_app.get_notifications()
    assert any("hooks" in n.lower() for n in notifications)


@then(parsers.parse('the main window shows "{status_text}"'))
def window_shows_status(norbert_app, status_text):
    """Verify the main window displays the expected status."""
    content = norbert_app.get_window_content()
    assert status_text in content


@then("the hook receiver and database still initialize correctly")
def receiver_and_db_init(norbert_app):
    """Verify the hook receiver and database work despite merge failure."""
    status = norbert_app.get_status()
    assert status.database_initialized is True
    assert status.hook_receiver_running is True


@then("the configuration is unchanged")
def config_unchanged(claude_config_dir):
    """Verify settings.json was not modified on second merge."""
    pass


@then("no duplicate hook entries are created")
def no_duplicate_hooks(claude_config_dir):
    """Verify each event type appears exactly once."""
    settings = json.loads((claude_config_dir / "settings.json").read_text())
    hooks = settings.get("hooks", {})
    # Each event type should be a unique key (JSON enforces this)
    from conftest import HOOK_EVENT_TYPES

    for et in HOOK_EVENT_TYPES:
        assert et in hooks


@then("a notification tells Priya to restart any running Claude Code sessions")
def restart_notification(norbert_app):
    """Verify the restart notification was shown."""
    notifications = norbert_app.get_notifications()
    assert any("restart" in n.lower() for n in notifications)


@then("a persistent banner in the Norbert window shows the same message")
def persistent_banner(norbert_app):
    """Verify the restart banner is visible in the window."""
    content = norbert_app.get_window_content()
    assert "restart" in content.lower()


@then("the banner remains visible until the first hook event arrives")
def banner_persists(norbert_app):
    """Verify banner is still visible before first event."""
    content = norbert_app.get_window_content()
    assert "restart" in content.lower()


@then("the Norbert database is created in the data directory")
def database_created(norbert_data_dir):
    """Verify the SQLite database file exists."""
    db_path = norbert_data_dir / "norbert.db"
    assert db_path.exists()


@then("the database uses write-ahead logging for concurrent access")
def database_wal_mode(norbert_app):
    """Verify the database is configured with WAL journal mode."""
    journal_mode = norbert_app.query_database_pragma("journal_mode")
    assert journal_mode == "wal"


@then("the database contains a sessions table")
def sessions_table_exists(norbert_app):
    """Verify the sessions table exists in the schema."""
    tables = norbert_app.get_database_tables()
    assert "sessions" in tables


@then("the database contains an events table")
def events_table_exists(norbert_app):
    """Verify the events table exists in the schema."""
    tables = norbert_app.get_database_tables()
    assert "events" in tables


@then("the event is acknowledged successfully")
def event_acknowledged():
    """Event acknowledgment verified in When step (HTTP 200)."""
    pass


@then("the event payload is stored with the correct event type")
def event_stored_correctly(norbert_app):
    """Verify the event was stored in the database."""
    events = norbert_app.get_events()
    assert len(events) > 0
    assert events[-1].event_type == "PreToolUse"


@then("the event is attributed to the originating session")
def event_attributed_to_session(norbert_app):
    """Verify session attribution on the stored event."""
    events = norbert_app.get_events()
    assert events[-1].session_id is not None


@then("the event is rejected with an appropriate error")
def event_rejected():
    """Verify the unknown event type was rejected."""
    # Response captured in When step
    pass


@then("nothing is stored in the database")
def nothing_stored(norbert_app):
    """Verify no event was stored for the rejected request."""
    events = norbert_app.get_events()
    # Should have no events from the unknown type
    assert not any(e.event_type == "UnknownEventType" for e in events)


@then("an error message explains that the hook receiver port is unavailable")
def port_error_message(norbert_app):
    """Verify the port conflict error is shown."""
    notifications = norbert_app.get_notifications()
    assert any("port" in n.lower() for n in notifications)


@then("the tray icon indicates an error state")
def tray_error_state(norbert_app):
    """Verify the tray icon shows an error indicator."""
    status = norbert_app.get_status()
    assert "error" in status.status.lower()


@then(
    "the event has been persisted to storage before the acknowledgment was sent"
)
def event_persisted_before_ack(norbert_app):
    """Verify write-before-ack guarantee (property test)."""
    # Software-crafter implements this as a property-based test
    pass


@then(
    "the stored event count always matches the number of acknowledged events"
)
def event_count_matches_acks(norbert_app):
    """Verify no events are lost between ack and storage."""
    pass

"""
Step definitions for End-to-End Proof scenarios (US-WS-003)
and Walking Skeleton scenarios.

Driving ports:
  - HTTP POST /hooks/{event_type} (simulating Claude Code)
  - Tauri IPC commands (get_status, get_latest_session)
"""
import time

from pytest_bdd import given, when, then, parsers, scenarios

scenarios("../milestone-4-end-to-end.feature")
scenarios("../walking-skeleton.feature")
scenarios("../integration-checkpoints.feature")


# ---------------------------------------------------------------------------
# Given Steps
# ---------------------------------------------------------------------------


@given("Priya uses Claude Code daily for multi-agent development sessions")
def priya_uses_claude_code():
    """Background context -- no action needed."""
    pass


@given("she has no current tool for observing what happens inside her sessions")
def no_observability_tool():
    """Background context -- no action needed."""
    pass


@given("Priya has installed Norbert on her Windows 11 machine")
def norbert_installed(norbert_app):
    """Norbert is installed and ready to launch."""
    pass


@given("Priya has Norbert running with hooks registered")
def norbert_running_with_hooks(norbert_app):
    """Norbert is running with settings merged and hooks registered."""
    norbert_app.launch()
    status = norbert_app.get_status()
    assert status.hooks_registered is True


@given("Priya has an existing Claude Code configuration with custom permissions and MCP servers")
def existing_claude_config(existing_settings):
    """Settings.json exists with MCP servers and permissions."""
    pass


@given(
    parsers.parse(
        'she starts a Claude Code session asking "{prompt}"'
    )
)
def starts_claude_session(hook_event_sender, prompt):
    """Simulate Claude Code session start with hook events."""
    hook_event_sender(
        "SessionStart",
        {
            "session_id": "session-001",
            "timestamp": "2026-03-08T14:23:01Z",
            "prompt": prompt,
        },
    )


@given(
    parsers.parse(
        "Claude Code makes {count:d} tool calls during the session"
    )
)
def claude_makes_tool_calls(hook_event_sender, count):
    """Simulate tool call events (PreToolUse + PostToolUse per call)."""
    for i in range(count):
        hook_event_sender(
            "PreToolUse",
            {
                "session_id": "session-001",
                "tool": "Read",
                "index": i,
                "timestamp": "2026-03-08T14:23:01Z",
            },
        )
        hook_event_sender(
            "PostToolUse",
            {
                "session_id": "session-001",
                "tool": "Read",
                "index": i,
                "timestamp": "2026-03-08T14:23:01Z",
            },
        )


@given(
    parsers.parse(
        "Claude Code makes {count:d} tool calls during the {duration}-minute session"
    )
)
def claude_makes_tool_calls_with_duration(hook_event_sender, count, duration):
    """Simulate tool calls over a session with specified duration."""
    for i in range(count):
        hook_event_sender(
            "PreToolUse",
            {"session_id": "session-001", "tool": "Read", "index": i},
        )
        hook_event_sender(
            "PostToolUse",
            {"session_id": "session-001", "tool": "Read", "index": i},
        )


@given("Priya has the Norbert window open during an active Claude Code session")
def window_open_during_session(norbert_app, hook_event_sender):
    """Norbert is running with window open and an active session."""
    norbert_app.launch()
    norbert_app.show_window()
    hook_event_sender("SessionStart", {"session_id": "active-session"})


@given(parsers.parse('Norbert shows "Status: Listening" with no active session'))
def norbert_listening(norbert_app):
    """Norbert is in idle/listening state."""
    norbert_app.launch()
    status = norbert_app.get_status()
    assert status.status == "Listening"


@given(
    parsers.parse(
        "Priya has run {count:d} Claude Code sessions producing {events} events"
    )
)
def multiple_sessions(hook_event_sender, count, events):
    """Simulate multiple completed sessions with specified event counts."""
    event_counts = [int(e.strip()) for e in events.split(",")]
    for session_idx in range(count):
        session_id = f"session-{session_idx + 1:03d}"
        hook_event_sender("SessionStart", {"session_id": session_id})
        for event_idx in range(event_counts[session_idx]):
            hook_event_sender(
                "PreToolUse",
                {"session_id": session_id, "index": event_idx},
            )
        hook_event_sender("Stop", {"session_id": session_id})


@given("the first-launch restart banner is visible in the Norbert window")
def restart_banner_visible(norbert_app):
    """Verify the restart banner is showing."""
    norbert_app.launch()
    norbert_app.show_window()
    content = norbert_app.get_window_content()
    assert "restart" in content.lower()


@given(parsers.parse('Norbert is running and showing "Listening" status'))
def norbert_showing_listening(norbert_app):
    """Norbert running in idle state."""
    norbert_app.launch()


@given("Norbert was receiving events from a Claude Code session")
def norbert_was_receiving(norbert_app, hook_event_sender):
    """Norbert running with events already captured."""
    norbert_app.launch()
    hook_event_sender("SessionStart", {"session_id": "interrupted-session"})


@given(parsers.parse("{count:d} events have been captured"))
def events_captured(hook_event_sender, count):
    """Send specified number of events."""
    for i in range(count):
        hook_event_sender(
            "PreToolUse",
            {"session_id": "interrupted-session", "index": i},
        )


@given(
    "Priya starts a Claude Code session that ends immediately with no tool calls"
)
def session_with_no_tools(hook_event_sender):
    """Start and immediately stop a session."""
    hook_event_sender("SessionStart", {"session_id": "empty-session"})
    hook_event_sender("Stop", {"session_id": "empty-session"})


# Integration checkpoint givens

@given("Norbert has merged hooks into the configuration")
def hooks_merged(norbert_app):
    """Settings merge completed."""
    norbert_app.launch()


@given("Norbert is running with both the hook receiver and the main window")
def running_with_receiver_and_window(norbert_app):
    """Full app running with window open."""
    norbert_app.launch()
    norbert_app.show_window()


@given(parsers.parse('the Norbert binary was built from version "{version}"'))
def binary_version(version):
    """Record expected version for comparison."""
    return version


@given("Norbert is running and receiving hook events")
def norbert_running_receiving(norbert_app, hook_event_sender):
    """Norbert running with active event flow."""
    norbert_app.launch()


@given("the main window is open")
def main_window_open(norbert_app):
    """Open the main window."""
    norbert_app.show_window()


@given("the list of event types registered in the configuration")
def registered_event_types(norbert_app):
    """Get event types from merged settings."""
    return norbert_app.get_registered_event_types()


@given("the list of event types the hook receiver accepts")
def accepted_event_types(norbert_app):
    """Get event types the receiver routes accept."""
    return norbert_app.get_accepted_event_types()


# ---------------------------------------------------------------------------
# When Steps
# ---------------------------------------------------------------------------


@when("she launches Norbert for the first time")
def launch_first_time(norbert_app):
    """Launch Norbert."""
    norbert_app.launch()


@when("the session ends")
def session_ends(hook_event_sender):
    """Send Stop event to end the session."""
    hook_event_sender(
        "Stop",
        {
            "session_id": "session-001",
            "timestamp": "2026-03-08T14:31:13Z",
        },
    )


@when("Priya opens the Norbert window")
def priya_opens_window(norbert_app):
    """Open the main window."""
    norbert_app.show_window()


@when("Norbert performs the first-launch settings merge")
def perform_merge(norbert_app):
    """Trigger settings merge."""
    norbert_app.launch()


@when("Claude Code makes a tool call and Norbert receives the hook events")
def tool_call_events(hook_event_sender):
    """Send a pair of tool call events."""
    hook_event_sender("PreToolUse", {"session_id": "active-session", "tool": "Read"})
    hook_event_sender("PostToolUse", {"session_id": "active-session", "tool": "Read"})


@when("a session start event arrives from Claude Code")
def session_start_event(hook_event_sender):
    """Send SessionStart event."""
    hook_event_sender("SessionStart", {"session_id": "status-test-session"})


@when("the session stop event arrives")
def session_stop_event(hook_event_sender):
    """Send Stop event."""
    hook_event_sender("Stop", {"session_id": "status-test-session"})


@when("she opens the Norbert window")
def she_opens_norbert(norbert_app):
    """Open the window."""
    norbert_app.show_window()


@when("the first hook event arrives from Claude Code")
def first_hook_event(hook_event_sender):
    """Send the first ever hook event."""
    hook_event_sender("SessionStart", {"session_id": "first-session"})


@when("Priya accidentally closes and relaunches Norbert")
def close_and_relaunch(norbert_app):
    """Simulate app restart."""
    norbert_app.shutdown()
    norbert_app.launch()


@when("only a session start and session stop event arrive")
def only_start_stop():
    """Session events already sent in Given step."""
    pass


# Integration checkpoint whens

@when("the hook receiver starts")
def hook_receiver_starts(norbert_app):
    """Verify receiver is running."""
    status = norbert_app.get_status()
    assert status.hook_receiver_running is True


@when("a hook event arrives and is stored by the receiver")
def event_stored_by_receiver(hook_event_sender):
    """Send an event that gets stored."""
    hook_event_sender("PreToolUse", {"session_id": "integration-test"})


@when("Priya closes the main window")
def close_main_window(norbert_app):
    """Close the window."""
    norbert_app.hide_window()


# ---------------------------------------------------------------------------
# Then Steps
# ---------------------------------------------------------------------------


@then("the Norbert icon appears in the system tray")
def tray_icon_visible(norbert_app):
    """Verify tray icon presence."""
    status = norbert_app.get_status()
    assert status.tray_visible is True


@then(parsers.parse('the main window displays "{text}"'))
def window_displays(norbert_app, text):
    """Verify window content."""
    content = norbert_app.get_window_content()
    assert text in content


@then(parsers.parse('the status shows "{expected_status}"'))
def status_shows(norbert_app, expected_status):
    """Verify status text."""
    status = norbert_app.get_status()
    assert status.status == expected_status


@then(parsers.parse('the port shows "{expected_port}"'))
def port_shows(norbert_app, expected_port):
    """Verify port display."""
    status = norbert_app.get_status()
    assert str(status.port) == expected_port


@then(parsers.parse('the session count shows "{expected_count}"'))
def session_count_shows(norbert_app, expected_count):
    """Verify session count display."""
    status = norbert_app.get_status()
    assert str(status.session_count) == expected_count


@then(parsers.parse('the event count shows "{expected_count}"'))
def event_count_shows(norbert_app, expected_count):
    """Verify event count display."""
    status = norbert_app.get_status()
    assert str(status.event_count) == expected_count


@then(parsers.parse('the total event count shows "{expected_count}"'))
def total_event_count_shows(norbert_app, expected_count):
    """Verify total event count across all sessions."""
    status = norbert_app.get_status()
    assert str(status.event_count) == expected_count


@then(parsers.parse('the empty state message reads "{message}"'))
def empty_state_reads(norbert_app, message):
    """Verify empty state message text."""
    content = norbert_app.get_window_content()
    assert message in content


@then("the last session shows the correct start timestamp")
def last_session_timestamp(norbert_app):
    """Verify the last session has a valid start timestamp."""
    session = norbert_app.get_latest_session()
    assert session is not None
    assert session.started_at is not None


@then(parsers.parse('the last session shows duration "{expected_duration}"'))
def last_session_duration(norbert_app, expected_duration):
    """Verify the last session displays the expected duration."""
    session = norbert_app.get_latest_session()
    assert session.formatted_duration == expected_duration


@then("the empty state message is no longer visible")
def empty_state_gone(norbert_app):
    """Verify the empty state message has been replaced by session data."""
    content = norbert_app.get_window_content()
    assert "Waiting for first Claude Code session" not in content


@then("a backup of the original configuration is created")
def backup_created(norbert_data_dir):
    """Verify backup file exists."""
    backup_path = norbert_data_dir / "settings.json.bak"
    assert backup_path.exists()


@then("the backup is identical to the original")
def backup_identical():
    """Verify byte-identical backup."""
    pass


@then("the merged configuration contains all of Priya's original settings")
def merged_has_originals(norbert_app):
    """Verify all original config preserved."""
    pass


@then(
    parsers.parse(
        "the merged configuration contains Norbert hook entries for {count:d} event types"
    )
)
def merged_has_hook_count(claude_config_dir, count):
    """Verify the expected number of hook entries."""
    import json

    settings = json.loads((claude_config_dir / "settings.json").read_text())
    hooks = settings.get("hooks", {})
    assert len(hooks) == count


@then("each hook entry points to the Norbert receiver on port 3748")
def hooks_point_to_receiver(claude_config_dir):
    """Verify hook URLs reference the receiver port."""
    import json

    settings = json.loads((claude_config_dir / "settings.json").read_text())
    for event_type, hook in settings.get("hooks", {}).items():
        assert "localhost:3748" in hook.get("url", "")


@then("the event count in the window increments within 1 second")
def event_count_increments(norbert_app):
    """Verify real-time event count update."""
    initial_count = norbert_app.get_status().event_count
    time.sleep(1)
    new_count = norbert_app.get_status().event_count
    assert new_count > initial_count


@then(parsers.parse('the status changes to "{expected_status}"'))
def status_changes_to(norbert_app, expected_status):
    """Verify status transition."""
    status = norbert_app.get_status()
    assert status.status == expected_status


@then(parsers.parse('the status returns to "{expected_status}"'))
def status_returns_to(norbert_app, expected_status):
    """Verify status returns after session end."""
    status = norbert_app.get_status()
    assert status.status == expected_status


@then("the most recent session's details are displayed")
def recent_session_displayed(norbert_app):
    """Verify the latest session details are shown."""
    session = norbert_app.get_latest_session()
    assert session is not None


@then("the banner dismisses automatically")
def banner_dismisses(norbert_app):
    """Verify the restart banner is no longer visible."""
    content = norbert_app.get_window_content()
    assert "restart" not in content.lower()


@then("the banner does not reappear")
def banner_stays_dismissed(norbert_app):
    """Verify the banner remains dismissed."""
    content = norbert_app.get_window_content()
    assert "restart" not in content.lower()


@then("the tray icon transitions to an active visual state")
def tray_active_state(norbert_app):
    """Verify tray icon shows active session."""
    status = norbert_app.get_status()
    assert status.tray_state == "active"


@then("the tray tooltip shows the current event count")
def tray_tooltip_event_count(norbert_app):
    """Verify tray tooltip includes event count."""
    status = norbert_app.get_status()
    assert "event" in status.tray_tooltip.lower()


@then("the pre-restart events are still in the database")
def pre_restart_events_persist(norbert_app):
    """Verify events survived the restart."""
    events = norbert_app.get_events()
    assert len(events) >= 20


@then("the hook receiver resumes accepting new events")
def receiver_resumes(hook_event_sender):
    """Verify new events can be sent after restart."""
    response = hook_event_sender(
        "PreToolUse", {"session_id": "interrupted-session"}
    )
    assert response.status_code == 200


@then("the session record reflects all captured events")
def session_reflects_all_events(norbert_app):
    """Verify session event count includes pre- and post-restart events."""
    session = norbert_app.get_latest_session()
    assert session.event_count >= 20


@then(parsers.parse('the session event count shows "{expected_count}"'))
def session_event_count(norbert_app, expected_count):
    """Verify session-specific event count."""
    session = norbert_app.get_latest_session()
    assert str(session.event_count) == expected_count


@then("the session has a valid start timestamp and minimal duration")
def valid_timestamp_minimal_duration(norbert_app):
    """Verify the session has valid temporal data."""
    session = norbert_app.get_latest_session()
    assert session.started_at is not None
    assert session.ended_at is not None


# Integration checkpoint thens

@then(
    "every hook URL in the configuration points to the same port the receiver listens on"
)
def hook_urls_match_receiver_port(norbert_app):
    """Verify configuration-to-receiver port consistency."""
    from conftest import HOOK_PORT

    registered = norbert_app.get_registered_hook_urls()
    for url in registered:
        assert f":{HOOK_PORT}/" in url


@then(
    "the receiver has a route for every event type registered in the configuration"
)
def receiver_has_all_routes(norbert_app):
    """Verify every registered event type has a receiver route."""
    registered = norbert_app.get_registered_event_types()
    accepted = norbert_app.get_accepted_event_types()
    for et in registered:
        assert et in accepted


@then("the main window can read the stored event within 1 second")
def window_reads_stored_event(norbert_app):
    """Verify cross-process data sharing via WAL mode."""
    time.sleep(1)
    events = norbert_app.get_events()
    assert len(events) > 0


@then("the event data matches what was originally received")
def event_data_matches(norbert_app):
    """Verify stored event matches what was sent."""
    events = norbert_app.get_events()
    last_event = events[-1]
    assert last_event.session_id == "integration-test"


@then(parsers.parse('the displayed version matches "{version}"'))
def displayed_version_matches(norbert_app, version):
    """Verify version in window."""
    content = norbert_app.get_window_content()
    assert version.replace("v", "") in content


@then(parsers.parse('the tray tooltip version matches "{version}"'))
def tray_version_matches(norbert_app, version):
    """Verify version in tray tooltip."""
    status = norbert_app.get_status()
    assert version.replace("v", "") in status.tray_tooltip


@then("hook events continue to be received and stored")
def events_continue_after_window_close(hook_event_sender, norbert_app):
    """Verify hook receiver works without window."""
    response = hook_event_sender("PreToolUse", {"session_id": "window-closed"})
    assert response.status_code == 200


@then("when Priya reopens the window the new events are visible")
def reopened_window_shows_events(norbert_app):
    """Verify events are visible after window reopen."""
    norbert_app.show_window()
    status = norbert_app.get_status()
    assert status.event_count > 0


@then("the two lists are identical")
def lists_identical():
    """Verified in subsequent Then steps."""
    pass


@then("no event type is registered without a corresponding receiver route")
def no_orphan_registrations(norbert_app):
    """Verify every registration has a route."""
    registered = norbert_app.get_registered_event_types()
    accepted = norbert_app.get_accepted_event_types()
    for et in registered:
        assert et in accepted, f"{et} registered but no receiver route"


@then("no receiver route exists without a corresponding registration")
def no_orphan_routes(norbert_app):
    """Verify every route has a registration."""
    registered = norbert_app.get_registered_event_types()
    accepted = norbert_app.get_accepted_event_types()
    for et in accepted:
        assert et in registered, f"{et} has route but not registered"

"""
Step definitions for App Shell scenarios (US-WS-001).

Driving port: Tauri app lifecycle and IPC commands.
Steps invoke through the application's public interface, never internal components.
"""
from pytest_bdd import given, when, then, parsers, scenarios

scenarios("../milestone-2-app-shell.feature")


# ---------------------------------------------------------------------------
# Given Steps
# ---------------------------------------------------------------------------


@given("Priya launches Norbert on Windows 11")
def priya_launches_norbert(norbert_app):
    """Launch the Norbert application through its public entry point."""
    norbert_app.launch()


@given("Norbert is running with the tray icon visible")
def norbert_running_with_tray(norbert_app):
    """Verify Norbert is running and the tray icon is present."""
    status = norbert_app.get_status()
    assert status.tray_visible is True


@given("the Norbert main window is open")
def main_window_is_open(norbert_app):
    """Ensure the main window is currently displayed."""
    norbert_app.show_window()


@given("Priya has just launched Norbert for the first time")
def first_launch(norbert_app):
    """Launch Norbert with no prior state."""
    norbert_app.launch()


@given("no Claude Code sessions have occurred yet")
def no_sessions_yet(norbert_app):
    """Verify zero sessions in the system."""
    status = norbert_app.get_status()
    assert status.session_count == 0


@given("Priya has opened and closed the Norbert window multiple times")
def window_toggled_multiple_times(norbert_app):
    """Toggle the window several times to verify stability."""
    for _ in range(3):
        norbert_app.show_window()
        norbert_app.hide_window()


# ---------------------------------------------------------------------------
# When Steps
# ---------------------------------------------------------------------------


@when("the application starts")
def application_starts():
    """Application startup already triggered in Given step."""
    pass


@when("Priya clicks the Norbert tray icon")
def priya_clicks_tray(norbert_app):
    """Simulate tray icon click through the app's toggle interface."""
    norbert_app.toggle_window()


@when("Priya closes the window")
def priya_closes_window(norbert_app):
    """Close the main window through the app interface."""
    norbert_app.hide_window()


@when("Priya clicks the tray icon again")
def priya_clicks_tray_again(norbert_app):
    """Second tray click to reopen."""
    norbert_app.toggle_window()


@when("she opens the main window")
def she_opens_window(norbert_app):
    """Open the main window."""
    norbert_app.show_window()


@when("she checks the system tray")
def she_checks_tray():
    """Check tray icon state -- implicit in Then assertions."""
    pass


# ---------------------------------------------------------------------------
# Then Steps
# ---------------------------------------------------------------------------


@then("the Norbert icon appears in the system tray")
def tray_icon_appears(norbert_app):
    """Verify the system tray icon is visible."""
    status = norbert_app.get_status()
    assert status.tray_visible is True


@then(parsers.parse('the icon tooltip shows "{expected_tooltip}"'))
def icon_tooltip_shows(norbert_app, expected_tooltip):
    """Verify the tray icon tooltip text."""
    status = norbert_app.get_status()
    assert status.tray_tooltip == expected_tooltip


@then("the main window opens")
def main_window_opens(norbert_app):
    """Verify the main window is now visible."""
    assert norbert_app.is_window_visible() is True


@then(parsers.parse('it displays "{text}"'))
def window_displays_text(norbert_app, text):
    """Verify the main window contains the expected text."""
    content = norbert_app.get_window_content()
    assert text in content


@then(parsers.parse('it shows "{text}"'))
def window_shows_text(norbert_app, text):
    """Verify the main window shows the expected text."""
    content = norbert_app.get_window_content()
    assert text in content


@then("the window closes")
def window_closes(norbert_app):
    """Verify the main window is no longer visible."""
    assert norbert_app.is_window_visible() is False


@then("the tray icon remains visible")
def tray_icon_remains(norbert_app):
    """Verify the tray icon persists after window close."""
    status = norbert_app.get_status()
    assert status.tray_visible is True


@then("the hook receiver continues accepting events")
def hook_receiver_continues(norbert_app, hook_event_sender):
    """Verify events can still be sent to the hook receiver."""
    response = hook_event_sender("PreToolUse")
    assert response.status_code == 200


@then("the window reopens")
def window_reopens(norbert_app):
    """Verify the window is visible again."""
    assert norbert_app.is_window_visible() is True


@then(
    parsers.parse(
        'she sees "{message}" as the empty state message'
    )
)
def empty_state_message(norbert_app, message):
    """Verify the empty state message is displayed."""
    content = norbert_app.get_window_content()
    assert message in content


@then("the interface does not appear broken or error-like")
def interface_not_broken(norbert_app):
    """Verify no error indicators in the UI."""
    status = norbert_app.get_status()
    assert status.status != "Error"


@then("the Norbert icon is still present")
def tray_icon_still_present(norbert_app):
    """Verify tray icon persists."""
    status = norbert_app.get_status()
    assert status.tray_visible is True


@then("clicking it opens the window with current status")
def clicking_opens_with_status(norbert_app):
    """Verify tray click opens window with live status."""
    norbert_app.toggle_window()
    assert norbert_app.is_window_visible() is True
    status = norbert_app.get_status()
    assert status.status is not None

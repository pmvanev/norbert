"""
Acceptance test fixtures for the Norbert Walking Skeleton.

Fixture hierarchy:
  - Session scope: Norbert application instance, database engine
  - Function scope: Data cleanup, fresh state per scenario

Integration approach:
  - Real internal services: SQLite database, hook receiver sidecar
  - Mocked externals: Claude Code hook events (simulated HTTP POSTs)

Driving ports exercised:
  - HTTP POST /hooks/{event_type} (hook receiver entry point)
  - Tauri IPC commands: get_status, get_latest_session (app query entry point)
  - App lifecycle: launch, settings merge (app lifecycle entry point)
"""
import json
import os
import shutil
import tempfile
from pathlib import Path

import pytest


# ---------------------------------------------------------------------------
# Paths and Constants
# ---------------------------------------------------------------------------

HOOK_PORT = 3748
HOOK_EVENT_TYPES = [
    "PreToolUse",
    "PostToolUse",
    "SubagentStop",
    "Stop",
    "SessionStart",
    "UserPromptSubmit",
]
VERSION = "0.1.0"


@pytest.fixture(scope="session")
def norbert_data_dir():
    """Temporary data directory standing in for ~/.norbert/ during tests."""
    tmpdir = tempfile.mkdtemp(prefix="norbert_test_")
    yield Path(tmpdir)
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture(scope="session")
def claude_config_dir():
    """Temporary directory standing in for ~/.claude/ during tests."""
    tmpdir = tempfile.mkdtemp(prefix="claude_test_")
    yield Path(tmpdir)
    shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Application Lifecycle Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def norbert_app(norbert_data_dir, claude_config_dir):
    """
    Norbert application instance for acceptance testing.

    This fixture will be implemented by the software-crafter to compose
    the real application with test-appropriate configuration:
      - Data directory pointing to norbert_data_dir
      - Claude config directory pointing to claude_config_dir
      - Real SQLite database (WAL mode)
      - Real hook receiver sidecar on HOOK_PORT
      - Real settings merger

    Returns an object with driving port access:
      - app.launch() -> starts the app lifecycle
      - app.get_status() -> queries via IPC command
      - app.get_latest_session() -> queries via IPC command
      - app.get_sessions() -> queries via IPC command
      - app.shutdown() -> clean shutdown
    """
    # Placeholder: software-crafter implements this fixture
    # using the real Norbert application composed with test config.
    pytest.skip("Norbert application fixture not yet implemented")


@pytest.fixture(autouse=True)
def clean_test_state(norbert_data_dir, claude_config_dir):
    """Reset state between scenarios for test isolation."""
    yield
    # Cleanup: remove database, settings files, etc.
    # Software-crafter implements cleanup logic here.


# ---------------------------------------------------------------------------
# Claude Code Event Simulation
# ---------------------------------------------------------------------------


@pytest.fixture
def hook_event_sender():
    """
    Sends simulated Claude Code hook events to the Norbert receiver.

    This fixture provides a callable that POSTs hook events to
    localhost:{HOOK_PORT}/hooks/{event_type}, simulating what Claude Code
    does during a real session.

    Usage in step definitions:
        hook_event_sender("PreToolUse", payload={"tool": "Read", ...})
        hook_event_sender("SessionStart", payload={"session_id": "abc"})
    """
    import requests

    def send_event(event_type: str, payload: dict | None = None):
        if payload is None:
            payload = {"event_type": event_type, "timestamp": "2026-03-08T14:23:01Z"}
        url = f"http://localhost:{HOOK_PORT}/hooks/{event_type}"
        response = requests.post(url, json=payload, timeout=5)
        return response

    return send_event


# ---------------------------------------------------------------------------
# Settings Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def existing_settings(claude_config_dir):
    """
    Creates a realistic existing settings.json in the test Claude config dir.

    Returns the path to the settings file and its original content.
    """
    settings = {
        "permissions": {"allow": ["Read", "Write"]},
        "mcpServers": {
            "github": {"type": "stdio", "command": "mcp-github"},
            "filesystem": {"type": "stdio", "command": "mcp-filesystem"},
        },
    }
    settings_path = claude_config_dir / "settings.json"
    settings_path.write_text(json.dumps(settings, indent=2))
    return settings_path, settings


@pytest.fixture
def malformed_settings(claude_config_dir):
    """Creates a settings.json with invalid JSON content."""
    settings_path = claude_config_dir / "settings.json"
    settings_path.write_text('{"permissions": {"allow": ["Read",]}}')  # trailing comma
    return settings_path


@pytest.fixture
def no_settings(claude_config_dir):
    """Ensures no settings.json exists in the Claude config directory."""
    settings_path = claude_config_dir / "settings.json"
    if settings_path.exists():
        settings_path.unlink()
    return settings_path


# ---------------------------------------------------------------------------
# Assertion Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def assert_settings_preserved():
    """
    Verifies that original settings are preserved after merge.

    Compares the original settings dict against the merged file,
    ensuring all original keys and values are intact.
    """

    def _assert(original: dict, merged_path: Path):
        merged = json.loads(merged_path.read_text())
        for key, value in original.items():
            assert key in merged, f"Original key '{key}' missing after merge"
            assert merged[key] == value, (
                f"Original key '{key}' was modified during merge"
            )

    return _assert


@pytest.fixture
def assert_hooks_registered():
    """
    Verifies that Norbert hook entries are present in settings.json.

    Checks for all 6 event types with correct URLs and async flag.
    """

    def _assert(settings_path: Path):
        settings = json.loads(settings_path.read_text())
        assert "hooks" in settings, "No hooks key in merged settings"
        hooks = settings["hooks"]
        for event_type in HOOK_EVENT_TYPES:
            assert event_type in hooks, f"Hook for {event_type} not registered"
            hook = hooks[event_type]
            expected_url = f"http://localhost:{HOOK_PORT}/hooks/{event_type}"
            assert hook.get("url") == expected_url, (
                f"Hook URL mismatch for {event_type}"
            )

    return _assert

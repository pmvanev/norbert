/**
 * Acceptance tests: GUI Stops Spawning Hook Receiver Sidecar (US-HRIL-03)
 *
 * Validates that the GUI becomes a pure database viewer without spawning
 * or managing the hook receiver lifecycle.
 *
 * Driving ports:
 * - GUI composition root (lib.rs run() function) -- validated through
 *   code analysis assertions (sidecar spawn removed, shell plugin absent)
 * - Domain status functions for GUI display behavior
 *
 * These tests validate the GUI decoupling contract. The DELIVER wave
 * implements the removals; these tests define what "done" looks like.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Paths to production files that should be modified
const LIB_RS_PATH = resolve(__dirname, "../../../src-tauri/src/lib.rs");
const CARGO_TOML_PATH = resolve(__dirname, "../../../src-tauri/Cargo.toml");
const TAURI_CONF_PATH = resolve(
  __dirname,
  "../../../src-tauri/tauri.conf.json"
);
const CAPABILITIES_PATH = resolve(
  __dirname,
  "../../../src-tauri/capabilities/default.json"
);

/**
 * Helper: read a production file as string.
 */
function readProductionFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User opens GUI and sees data captured while GUI was closed", () => {
  it.skip("GUI displays all sessions and events without starting a receiver", () => {
    // GIVEN: the hook receiver has been collecting events since system startup
    // AND: 3 sessions with 47 events have been captured without the GUI
    // WHEN: Phil opens the Norbert GUI
    // THEN: the GUI displays all 3 sessions and 47 events
    // AND: no additional hook receiver process is started
    //
    // Driving port: get_status IPC command (through AppState/EventStore)
    // This walking skeleton proves the GUI is a pure viewer:
    // it shows data that was captured independently.
    //
    // Implementation: set up SQLite database with test data,
    // invoke get_status through the domain layer,
    // verify counts match and no sidecar was spawned.
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Sidecar Removal Verification
// ---------------------------------------------------------------------------

describe("GUI startup code does not spawn hook receiver", () => {
  it("lib.rs does not contain spawn_hook_receiver_sidecar call", () => {
    // GIVEN: the Norbert GUI application is configured
    // WHEN: the GUI starts up
    // THEN: no hook receiver sidecar process is launched
    //
    // Driving port: lib.rs source code (composition root)
    // Verify the sidecar spawn call has been removed.
    const libContent = readProductionFile(LIB_RS_PATH);
    expect(libContent).not.toContain("spawn_hook_receiver_sidecar");
  });

  it("shell plugin is not initialized in the GUI", () => {
    // AND: the shell plugin is not initialized
    //
    // Driving port: lib.rs source code
    // Verify tauri_plugin_shell is not used.
    const libContent = readProductionFile(LIB_RS_PATH);
    expect(libContent).not.toContain("tauri_plugin_shell");
    expect(libContent).not.toContain("ShellExt");
  });
});

describe("GUI displays data regardless of receiver running state", () => {
  it.skip("GUI shows sessions and events when receiver is offline", () => {
    // GIVEN: the database contains 5 sessions with 120 events
    // AND: the hook receiver is not currently running
    // WHEN: Phil opens the Norbert GUI
    // THEN: the GUI displays 5 sessions and 120 events
    // AND: no error is shown about the receiver being offline
    //
    // Driving port: get_status / build_status_with_session domain functions
    // The GUI reads from SQLite regardless of receiver state.
  });
});

describe("Multiple GUI instances coexist without conflict", () => {
  it.skip("both instances display the same session data without port conflicts", () => {
    // GIVEN: Phil has the Norbert GUI already open
    // AND: the hook receiver is running independently
    // WHEN: Phil opens a second GUI instance
    // THEN: both instances display the same session data
    // AND: no port conflict or process error occurs
    //
    // Driving port: GUI database access (read-only SQLite connection)
    // Without sidecar spawn, multiple GUIs cannot cause port conflicts.
  });
});

describe("GUI connects to the database as a read-only viewer", () => {
  it.skip("concurrent reading and writing coexist safely", () => {
    // GIVEN: the hook receiver is writing events to the database
    // WHEN: the GUI reads session data
    // THEN: the GUI does not interfere with the receiver's writes
    // AND: concurrent reading and writing coexist safely
    //
    // Driving port: SQLite WAL mode concurrent access
    // Domain-level test: verify database can be read while being written to.
  });
});

// ---------------------------------------------------------------------------
// CONFIGURATION CLEANUP VERIFICATION
// ---------------------------------------------------------------------------

describe("Tauri shell plugin dependency is removed", () => {
  it("Cargo.toml does not depend on tauri-plugin-shell", () => {
    const cargoContent = readProductionFile(CARGO_TOML_PATH);
    expect(cargoContent).not.toContain("tauri-plugin-shell");
  });
});

describe("External binary bundling configuration is removed", () => {
  it("tauri.conf.json does not reference externalBin", () => {
    const confContent = readProductionFile(TAURI_CONF_PATH);
    const config = JSON.parse(confContent);
    const bundle = config?.bundle || config?.tauri?.bundle;
    if (bundle) {
      expect(bundle.externalBin).toBeUndefined();
    }
  });
});

describe("Shell permissions are removed from capabilities", () => {
  it("capabilities/default.json does not include shell permissions", () => {
    const capContent = readProductionFile(CAPABILITIES_PATH);
    expect(capContent).not.toContain("shell:allow-spawn");
    expect(capContent).not.toContain("shell:allow-execute");
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS
// ---------------------------------------------------------------------------

describe("GUI opens gracefully when no receiver is running", () => {
  it.skip("GUI shows 'No plugin connected' status and no error about missing receiver", () => {
    // GIVEN: the hook receiver is not running
    // AND: the database contains no sessions or events
    // WHEN: Phil opens the Norbert GUI
    // THEN: the GUI displays "No plugin connected" status
    // AND: no error message is shown about missing receiver
    //
    // Driving port: build_status_with_session(0, 0, None) domain function
    // The GUI does not check for receiver process -- it simply shows data.
  });
});

describe("Closing the GUI does not stop the hook receiver", () => {
  it.skip("hook receiver continues running after GUI is closed", () => {
    // GIVEN: the hook receiver is running on port 3748
    // AND: Phil has the Norbert GUI open
    // WHEN: Phil closes the GUI
    // THEN: the hook receiver continues running on port 3748
    // AND: subsequent Claude Code events are still captured
    //
    // Driving port: GUI window close behavior (on_window_event handler)
    // Without sidecar ownership, closing GUI has no effect on receiver.
    // The on_window_event handler only hides the window, never kills processes.
  });
});

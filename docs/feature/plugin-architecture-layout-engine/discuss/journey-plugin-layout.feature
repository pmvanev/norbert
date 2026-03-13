Feature: Plugin Architecture and Layout Engine
  As a developer using Norbert to observe Claude Code sessions,
  I want a plugin-based architecture with flexible layout management
  so that views can be arranged, persisted, and extended through plugins.

  # --- Step 1: Plugin Load and Registration ---

  Scenario: First-party plugin loads successfully
    Given Norbert is starting up
    And the norbert-session plugin is installed with version 1.0.0
    When the plugin loader scans for installed plugins
    Then norbert-session is loaded successfully
    And its "Session List" view is registered as primaryView with tabOrder 0
    And a sidebar icon labeled "Sessions" appears in the sidebar
    And the view picker includes "norbert-session > Session List"

  Scenario: Plugin with satisfied dependencies loads cleanly
    Given Norbert is starting up
    And norbert-usage v1.0.0 is installed
    And norbert-session v1.0.0 is installed (dependency of norbert-usage)
    When the plugin loader resolves dependencies
    Then norbert-usage loads after norbert-session
    And both plugins register their views successfully

  Scenario: Plugin with disabled dependency loads with degradation warning
    Given Norbert is starting up
    And norbert-usage v1.0.0 is installed
    And norbert-notif v1.0.0 is installed but disabled by Reina Vasquez
    When the plugin loader resolves dependencies
    Then norbert-usage loads successfully
    And a notification appears: "norbert-notif is disabled. Notification delivery will not be available."
    And the notification includes a "Re-enable norbert-notif" action
    And features of norbert-usage that depend on norbert-notif show greyed-out placeholders

  Scenario: Plugin with missing dependency fails to load with actionable error
    Given Norbert is starting up
    And norbert-cc-plugin-nwave v1.0.0 is installed
    And norbert-agents is not installed
    When the plugin loader resolves dependencies
    Then norbert-cc-plugin-nwave fails to load
    And the error message states: "Requires norbert-agents@>=1.0 (not installed)"
    And the error offers "Install Missing Dependencies" action
    And no partial or degraded nWave features are available

  Scenario: Plugin with version mismatch refuses to load
    Given Norbert is starting up
    And norbert-cc-plugin-nwave v1.0.0 requires norbert-agents@>=1.2
    And norbert-agents v1.0.0 is installed
    When the plugin loader checks version compatibility
    Then norbert-cc-plugin-nwave refuses to load
    And the error states: "Requires norbert-agents@>=1.2 but v1.0.0 is installed. Update norbert-agents to continue."

  Scenario: Plugin is sandboxed from core data
    Given norbert-session plugin is loaded
    When norbert-session attempts to write to Norbert's core database tables
    Then the write is rejected
    And norbert-session can only write to its own namespaced tables

  # --- Step 2: Layout Restore ---

  Scenario: First launch shows empty Main zone with guidance
    Given Kai Nakamura is launching Norbert for the first time
    And no layout.json exists in ~/.norbert/
    When the main window opens
    Then the Main zone displays an empty state message
    And the message includes: "Click a sidebar icon or press Ctrl+Shift+P to assign a view"
    And the Secondary zone is hidden

  Scenario: Subsequent launch restores saved layout
    Given Reina Vasquez previously arranged Session List in Main and Session Detail in Secondary
    And the divider was at 60% position
    And layout.json contains these assignments
    When Reina launches Norbert
    Then Session List appears in the Main zone
    And Session Detail appears in the Secondary zone
    And the divider is at 60% position
    And both views are immediately interactive

  Scenario: Layout references uninstalled plugin view gracefully
    Given layout.json assigns "norbert-usage-analytics" to the Secondary zone
    And the norbert-usage plugin has been uninstalled since last launch
    When Norbert restores the layout
    Then the Secondary zone shows an empty state: "View 'norbert-usage-analytics' is no longer available (plugin uninstalled)"
    And the Main zone restores normally
    And a view picker link is offered to assign a different view

  # --- Step 3: Workspace Arrangement ---

  Scenario: Assign view via right-click context menu on sidebar icon
    Given Kai Nakamura has Norbert open with Session List in Main
    And the Secondary zone is hidden
    When Kai right-clicks the Sessions sidebar icon
    And selects "Open in Secondary Panel"
    Then the Secondary zone becomes visible
    And Session List appears in the Secondary zone
    And the Main zone content is undisturbed

  Scenario: Assign view via drag from sidebar to zone
    Given Reina Vasquez has Norbert open with Main and Secondary zones visible
    When Reina drags the Sessions sidebar icon over the Secondary zone
    Then the Secondary zone shows a branded drop overlay: "Assign to Secondary"
    When Reina drops the icon
    Then Session List (primaryView of norbert-session) replaces the previous Secondary zone content

  Scenario: Assign view via view picker
    Given Kai Nakamura presses Ctrl+Shift+P
    And types "Change Secondary View"
    When the view picker opens showing all registered views grouped by plugin
    And Kai selects "norbert-session > Session List"
    Then Session List is assigned to the Secondary zone
    And the Secondary zone becomes visible if it was hidden

  Scenario: Toggle Secondary zone visibility
    Given Reina Vasquez has Session List in Main and Session Detail in Secondary
    When Reina presses Ctrl+Shift+\
    Then the Secondary zone hides
    And Main expands to full content width
    When Reina presses Ctrl+Shift+\ again
    Then the Secondary zone reappears with Session Detail restored

  Scenario: Drag divider to resize zones
    Given Reina Vasquez has Main and Secondary zones visible at 50/50 split
    When Reina drags the divider handle 200px to the right
    Then Main zone widens and Secondary zone narrows
    And neither zone goes below 280px minimum width
    And the new divider position is saved automatically to layout.json

  Scenario: Double-click divider snaps to 50/50
    Given Reina Vasquez has Main at 70% and Secondary at 30%
    When Reina double-clicks the divider handle
    Then the zones snap to 50% / 50% split
    And the transition is smooth (not abrupt)

  Scenario: Open view as floating panel
    Given Kai Nakamura has Session List in Main zone (full width)
    When Kai right-clicks the Sessions sidebar icon
    And selects "Open as Floating Panel"
    Then a floating panel appears overlaying the Main zone
    And the panel shows Session List
    And the panel is resizable by dragging edges
    And the panel is repositionable by dragging the header
    And the panel snaps to window edges when dragged within 20px

  Scenario: Minimize floating panel to pill
    Given Kai Nakamura has a floating Session List panel open
    And norbert-session declares floatMetric as "active_session_count"
    And there are 3 active sessions
    When Kai clicks the minimize button on the floating panel header
    Then the panel collapses to a small pill in the corner
    And the pill shows "Sessions  3"
    When Kai clicks the pill
    Then the floating panel restores to its previous size and position

  Scenario: Floating panel Switch Mode via menu
    Given Kai Nakamura has a floating panel showing Session List
    When Kai clicks the "..." menu on the floating panel header
    And selects "Switch Mode"
    Then a compact popover shows norbert-session's other views in tab order
    When Kai selects "Session Detail"
    Then the floating panel content switches to Session Detail
    And the panel remains floating at its current position

  Scenario: Assigning a view to a zone replaces the current occupant
    Given Reina Vasquez has Session List in Main zone
    When Reina right-clicks and assigns a different plugin view to Main
    Then Session List is unloaded from Main
    And the new view occupies Main
    And Session List can be reassigned to any zone at any time

  # --- Step 4: Multi-Window ---

  Scenario: Open new window via right-click
    Given Reina Vasquez has Norbert open on her primary monitor
    When Reina right-clicks the Sessions sidebar icon
    And selects "Open in New Window"
    Then a new Norbert window opens
    And the new window shows Session List in its Main zone
    And the new window's Secondary zone is empty
    And both windows receive live event updates

  Scenario: Open new window via keyboard shortcut
    Given Kai Nakamura has Norbert open
    When Kai presses Ctrl+Shift+N
    Then a new window opens with the default layout
    And both windows are independent in layout

  Scenario: Two windows with independent layouts and live updates
    Given Reina Vasquez has two Norbert windows open
    And Window 1 shows Session List in Main, Session Detail in Secondary
    And Window 2 shows Session List in Main (full width, different session selected)
    When a new hook event arrives for session "claude-code-abc"
    Then both windows update to reflect the new event
    And no perceptible delay occurs between window updates

  Scenario: Closing one window does not affect others
    Given Reina Vasquez has two Norbert windows open
    When Reina closes Window 2
    Then Window 1 continues operating normally
    And the backend process remains alive

  Scenario: Last window closing keeps backend alive in tray mode
    Given Reina Vasquez has one Norbert window open
    And the tray icon is visible
    When Reina closes the last window
    Then the backend process continues running
    And hooks continue to be received and stored
    When Reina clicks the tray icon to reopen
    Then the window reopens instantly with its saved layout

  Scenario: Per-window layout persistence
    Given Reina Vasquez has Window 1 with a custom layout
    And Window 2 with a different custom layout
    When Reina closes both windows and relaunches Norbert
    Then both windows reopen
    And Window 1 has its saved layout restored
    And Window 2 has its saved layout restored

  Scenario: Label a window
    Given Reina Vasquez has a second window open
    When Reina right-clicks the title bar of Window 2
    And selects "Label This Window"
    And types "Monitor 2 - Sessions"
    Then the title bar shows "Norbert - Monitor 2 - Sessions"
    And the status bar shows "Monitor 2 - Sessions" in the right-aligned area

  @property
  Scenario: No performance degradation with two windows
    Given Norbert has two windows open simultaneously
    And both windows have views assigned to Main and Secondary zones
    And hook events are arriving at normal rate
    Then UI responsiveness in both windows remains under 100ms for interactions
    And memory usage with two windows is less than 2x single window usage
    And backend process CPU usage is unchanged compared to single window

  # --- Step 5: Sidebar Customization ---

  Scenario: Right-click sidebar icon to toggle visibility
    Given Kai Nakamura has all default sidebar icons visible
    When Kai right-clicks the Agents sidebar icon
    Then a context menu shows the full list of sections with checkmarks for visible ones
    When Kai unchecks "Agents"
    Then the Agents icon disappears from the sidebar
    And the change is saved to ~/.norbert/sidebar.json
    And Kai can still access Agents via Ctrl+Shift+P > "Open Agents"

  Scenario: Drag sidebar icons to reorder
    Given Reina Vasquez wants Sessions as the first sidebar icon
    When Reina drags the Sessions icon above Dashboard
    Then Sessions appears first in the sidebar
    And the new order is saved to ~/.norbert/sidebar.json

  Scenario: Reset sidebar to defaults
    Given Kai Nakamura has hidden 3 sidebar icons and reordered the rest
    When Kai right-clicks any sidebar icon
    And selects "Reset Sidebar"
    Then all icons return to default visibility and order

  Scenario: Hidden sections accessible via command palette
    Given Kai Nakamura has hidden the Agents sidebar icon
    When Kai presses Ctrl+Shift+P
    And types "Open Agents"
    Then the Agents view opens in the Main zone
    And the Agents sidebar icon remains hidden

  Scenario: Newly installed plugin appears at end of sidebar
    Given Reina Vasquez has a customized sidebar order
    When a new plugin "norbert-usage" is installed
    Then its sidebar icon appears at the end of the sidebar (before bottom-pinned items)
    And existing icon order is not disrupted

  # --- Step 6: Layout Persistence and Presets ---

  Scenario: Auto-save layout on every change
    Given Reina Vasquez drags the divider to a new position
    Then layout.json is updated automatically within 1 second
    And no manual save action is required

  Scenario: Save named layout preset
    Given Kai Nakamura has arranged Session List in Main and Session Detail in Secondary
    When Kai presses Ctrl+Shift+L
    And selects "Save Current Layout As..."
    And types "Debug Sessions"
    Then the preset "Debug Sessions" is saved
    And it appears in the Layout Picker next time it is opened

  Scenario: Switch between layout presets
    Given Reina Vasquez has saved two custom presets: "Monitoring" and "Cost Review"
    When Reina presses Ctrl+Shift+L
    And selects "Cost Review"
    Then the Main zone switches to the view assigned in "Cost Review"
    And the Secondary zone switches accordingly
    And the divider position matches the preset

  Scenario: Built-in presets cannot be deleted
    Given Kai Nakamura opens the Layout Picker
    When Kai right-clicks the "Default" preset
    Then there is no "Delete" option
    And "Save Copy As..." is available
    When Kai selects "Save Copy As..."
    And names it "My Default"
    Then "My Default" appears as a custom preset that can be edited and deleted

  Scenario: Reset to Default layout
    Given Reina Vasquez has a complex multi-zone layout with floating panels
    When Reina presses Ctrl+Shift+L
    And selects "Reset to Default"
    Then the layout resets to single Main zone with the first available primaryView
    And the Secondary zone is hidden
    And all floating panels are closed

  # --- Zone Abstraction Future-Proofing ---

  @property
  Scenario: Zone abstraction is count-agnostic
    Given the layout engine manages zones as a keyed registry
    Then adding a new zone named "bottom" requires only layout engine changes
    And no plugin API method signatures change
    And no plugin manifest fields change
    And layout.json schema extends naturally with a new zone key
    And existing right-click context menu dynamically includes the new zone option

  # --- Plugin Developer Journey (norbert-session migration) ---

  Scenario: norbert-session registers views via plugin API
    Given the norbert-session plugin implements NorbertPlugin interface
    When norbert-session calls api.ui.registerView() with "session-list" as primaryView
    Then the view appears in the layout engine's view picker
    And the sidebar shows the Sessions icon
    And clicking the Sessions sidebar icon assigns Session List to Main zone

  Scenario: norbert-session view is assignable to all placement targets
    Given norbert-session is loaded and its Session List view is registered
    Then Session List can be assigned to the Main zone via sidebar click
    And Session List can be assigned to the Secondary zone via right-click
    And Session List can be opened as a floating panel via right-click
    And Session List can be opened in a new window via right-click
    And Session List can be assigned to any zone via drag-and-drop
    And Session List can be assigned to any zone via the view picker
    And Session List placement persists in layout.json across restarts

Feature: Integration Checkpoints -- Cross-component verification points
  As a developer building the walking skeleton,
  I want integration checkpoints that verify components work together correctly,
  so I can catch wiring bugs before they reach users.

  @skip
  Scenario: Settings merge hook URLs match receiver port
    Given Norbert has merged hooks into the configuration
    When the hook receiver starts
    Then every hook URL in the configuration points to the same port the receiver listens on
    And the receiver has a route for every event type registered in the configuration

  @skip
  Scenario: Database is shared between hook receiver and main window
    Given Norbert is running with both the hook receiver and the main window
    When a hook event arrives and is stored by the receiver
    Then the main window can read the stored event within 1 second
    And the event data matches what was originally received

  @skip
  Scenario: Version displayed matches the built version
    Given the Norbert binary was built from version "v0.1.0"
    When Priya opens the main window
    Then the displayed version matches "v0.1.0"
    And the tray tooltip version matches "v0.1.0"

  @skip
  Scenario: Hook receiver continues after main window closes
    Given Norbert is running and receiving hook events
    And the main window is open
    When Priya closes the main window
    Then hook events continue to be received and stored
    And when Priya reopens the window the new events are visible

  @skip @property
  Scenario: Event types are consistent across settings and receiver
    Given the list of event types registered in the configuration
    And the list of event types the hook receiver accepts
    Then the two lists are identical
    And no event type is registered without a corresponding receiver route
    And no receiver route exists without a corresponding registration

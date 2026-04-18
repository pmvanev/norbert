Feature: Integration Checkpoints — Store and Derivation Seams
  These checkpoints validate the derivation seam (hookProcessor helpers that
  convert hook and OTel events into rate samples and pulses) and the store
  seam (multiSessionStore's public append and query contract). They prove
  the upstream event stream correctly lands in the store, and the store
  preserves the temporal contracts the scope depends on.

  Background:
    Given the Performance Monitor is ready to process session telemetry

  # --- Derivation seam: event -> rate sample ---

  @driving_port @US-PM-001
  Scenario: A 5-second tick of hook arrivals derives an events-per-second sample
    Given 15 hook events arrive for "session-1" across a 5-second tick
    When the events-per-second derivation runs for that tick
    Then an events-per-second sample of 3 is appended for "session-1"
    And the sample is timestamped at the tick boundary

  @driving_port @US-PM-001
  Scenario: An OTel api-request event derives a tokens-per-second sample
    Given an OTel api-request event arrives for "session-1" with 500 total tokens and a 2-second duration
    When the tokens-per-second derivation runs for that event
    Then a tokens-per-second sample of 250 is appended for "session-1"

  @driving_port @US-PM-001
  Scenario: Tool-call events within a 5-second tick derive a tool-calls-per-second sample
    Given 10 tool-call events arrive for "session-1" across a 5-second tick
    When the tool-calls-per-second derivation runs for that tick
    Then a tool-calls-per-second sample of 2 is appended for "session-1"

  # --- Derivation seam: event -> pulse ---

  @driving_port @US-PM-001
  Scenario: A tool-use hook event emits a pulse at the event's timestamp
    Given a tool-use hook event arrives for "session-1" at a known time
    When the pulse emitter processes the event
    Then a pulse is appended for "session-1" at that time
    And the pulse's kind reflects a tool use

  @driving_port @US-PM-001
  Scenario: A lifecycle hook event emits a pulse with a smaller strength than a tool-use pulse
    Given a tool-use hook event and a lifecycle hook event arrive for "session-1" at the same time
    When the pulse emitter processes both events
    Then the tool-use pulse has greater strength than the lifecycle pulse

  # --- Store seam: append and query round-trips ---

  @driving_port @US-PM-001
  Scenario: Appending rate samples preserves temporal order on read
    Given "session-1" receives events-per-second samples at 10, 20, and 30 seconds ago
    When the store is queried for "session-1"'s events-per-second history
    Then the returned samples are ordered from oldest to newest

  @driving_port @US-PM-001
  Scenario: Appending pulses preserves arrival order on read
    Given "session-1" receives pulses at 4, 2, and 1 seconds ago in that order
    When the store is queried for "session-1"'s pulses
    Then the returned pulses are ordered by arrival

  @driving_port @US-PM-001
  Scenario: Querying a non-existent session returns empty history and pulses
    Given "session-ghost" has never been added to the store
    When the store is queried for "session-ghost"
    Then the returned rate history is empty
    And the returned pulses are empty

  @driving_port @US-PM-001
  Scenario: Subscribers are notified after appendRateSample
    Given a subscriber is registered with the store
    When a rate sample is appended for "session-1"
    Then the subscriber is notified exactly once

  @driving_port @US-PM-001
  Scenario: Subscribers are notified after appendPulse
    Given a subscriber is registered with the store
    When a pulse is appended for "session-1"
    Then the subscriber is notified exactly once

  @driving_port @US-PM-001
  Scenario: Subscribers are notified after addSession and removeSession
    Given a subscriber is registered with the store
    When "session-1" is added to the store
    And "session-1" is removed from the store
    Then the subscriber is notified exactly twice

  # --- Property-shaped invariants (generators via fast-check) ---

  @driving_port @property @US-PM-001
  Scenario: Frame values never invent sub-interval spikes beyond bracketing arrived values
    Given any valid sequence of arrived rate samples for a session
    When the scope projects a frame for any current-time value within the window
    Then every projected trace value is bounded above by the maximum of its two bracketing arrived samples
    And every projected trace value is bounded below by the minimum of its two bracketing arrived samples

  @driving_port @property @US-PM-001
  Scenario: Frame values never zero-fill between arrivals when the last arrived value is non-zero
    Given any session with a non-zero last arrived rate sample
    And no further samples have arrived after it
    When the scope projects a frame at any later time within the window
    Then the trace value at the current-time edge equals the last arrived value
    And no projected trace value falls to zero while the last arrived value is non-zero

  @driving_port @property @US-PM-001
  Scenario: Rate-sample append then read preserves timestamp order
    Given any finite sequence of rate samples appended in timestamp order
    When the store's rate history is read for that session and metric
    Then the returned samples are in the same timestamp order as appended

  @driving_port @property @US-PM-001
  Scenario: Window trim is consistent across reads
    Given any sequence of arrived rate samples older and newer than the 60-second window
    When the store trims samples older than the window
    Then the returned history contains only samples within the window
    And trimming is idempotent under repeated application

  @driving_port @property @US-PM-001
  Scenario: Hit-test consistency between trace value and returned value
    Given any frame and any pointer position within the scope area
    When the hit-test returns a hover selection
    Then the trace value for the selected session at the selection's time matches the selection's value within a small epsilon

  @driving_port @property @US-PM-001
  Scenario: Pulse decay factor monotonically decreases with age
    Given any pulse within its 2.5-second lifetime
    When the pulse is evaluated at two times within its lifetime
    Then the decay factor at the later time is less than or equal to the decay factor at the earlier time
    And a pulse beyond its lifetime is absent from the frame

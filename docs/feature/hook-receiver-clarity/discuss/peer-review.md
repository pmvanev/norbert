# Peer Review: hook-receiver-clarity Requirements

```yaml
review_id: "req_rev_20260325_001"
reviewer: "product-owner (review mode)"
artifact: "docs/feature/hook-receiver-clarity/discuss/user-stories.md"
iteration: 1

strengths:
  - "Real persona (Danielle Reyes) used consistently across all stories — no generic 'user123' data"
  - "Domain examples are concrete and narrative — Task Manager row data, port numbers, event counts"
  - "Both stories separated cleanly by user outcome (metadata vs. tray UI) — right-sized"
  - "Technical notes correctly defer technology choices (tray crate selection) to DESIGN wave"
  - "Regression guard scenario (US-HRC-01, Example 3) proactively addresses the most likely adjacent breakage"
  - "Graceful drain timeout is named as a constant rather than prescribed as an implementation detail"
  - "Forces analysis in JTBD file distinguishes Push/Pull/Anxiety/Habit for each job — strong demand signal for both stories"
  - "Shared artifact registry documents all ${variables} with single sources of truth"

issues_identified:
  confirmation_bias:
    - issue: "AtomicU64 mentioned in Technical Notes of US-HRC-02"
      severity: "medium"
      location: "US-HRC-02 Technical Notes, line ~199"
      recommendation: >
        'Use AtomicU64 (or equivalent)' leans toward prescribing implementation.
        Rephrase as: 'Event count must be an in-memory counter readable from both tray tooltip
        and context menu without staleness — the specific synchronization primitive is a DESIGN
        wave decision.' This keeps the requirement solution-neutral.

  completeness_gaps:
    - issue: "Windows startup failure path not covered — what happens if the Startup shortcut is missing or broken?"
      severity: "medium"
      location: "US-HRC-02 UAT Scenarios"
      recommendation: >
        Add a brief note in Technical Notes: 'Startup shortcut management is out of scope for
        this feature; the hook receiver is assumed to have been installed correctly.' This closes
        the open question rather than leaving it as an implicit assumption.

    - issue: "Windows version compatibility not stated"
      severity: "low"
      location: "US-HRC-02 Technical Notes"
      recommendation: >
        Norbert targets Windows (per project context). Note the minimum supported Windows version
        (e.g. Windows 10 1803+) since tray icon behavior varies between Windows 10 and 11.
        This is a constraint for DESIGN wave to validate.

  clarity_issues:
    - issue: "AC item 'If port bind fails, tooltip shows Port: unavailable rather than crashing' is not covered by a UAT scenario in US-HRC-02"
      severity: "high"
      location: "US-HRC-02 Acceptance Criteria, last bullet"
      recommendation: >
        Either add a UAT scenario for the port-conflict error path (aligns with the feature
        file which does include this scenario) or remove the AC item and let the feature file
        be the sole source of truth for this path. Current mismatch between user-stories.md AC
        and journey-hook-receiver-clarity.feature creates potential confusion. Recommendation:
        add a matching UAT scenario in US-HRC-02 to maintain internal consistency.

    - issue: "Tooltip update frequency not specified — live counter could mean 'on hover' refresh or polling"
      severity: "medium"
      location: "US-HRC-02 AC: 'Event count in tooltip reflects current in-memory counter (live, not cached)'"
      recommendation: >
        Clarify: 'Event count displayed in the tooltip reflects the counter value at the moment
        the tooltip is opened (on-demand read). No background polling is required.' This
        removes ambiguity without prescribing a polling implementation.

  testability_concerns:
    - issue: "AC item 'The distinction is visible without expanding additional columns or hovering' is not directly automatable"
      severity: "low"
      location: "US-HRC-01 Acceptance Criteria, 4th bullet"
      recommendation: >
        This is a usability constraint, not a testable condition. Rephrase as a note rather
        than an AC checkbox: 'The Description column is visible in the default Task Manager
        view without column resizing.' Alternatively, map it to the binary property check
        (which is automatable) and remove the UI layout assertion which depends on Task Manager
        configuration outside the product's control.

  priority_validation:
    q1_largest_bottleneck: "YES — process confusion and silent failures are the stated pain points; these stories directly address them"
    q2_simple_alternatives: "ADEQUATE — VERSIONINFO metadata is the canonical Windows solution for process labeling; no simpler alternative exists. Tray icon is the Windows idiom for background process visibility; alternatives (desktop notification, log file) would be inferior."
    q3_constraint_prioritization: "CORRECT — Windows-only scope is appropriate given Norbert's platform target; cross-platform is explicitly deferred"
    q4_data_justified: "JUSTIFIED — feature brief provides clear evidence: identical FileDescription causing confusion, zero UI causing silent failure. Both are validated pain points."
    verdict: "PASS"

approval_status: "conditionally_approved"
critical_issues_count: 0
high_issues_count: 1
medium_issues_count: 3
low_issues_count: 2
```

---

## Required Resolutions Before Handoff

The single high-severity issue must be resolved before DESIGN wave handoff:

### H-01 (High): Port-conflict error path missing from US-HRC-02 UAT scenarios

The feature file (`journey-hook-receiver-clarity.feature`) includes this scenario but `user-stories.md` does not. The acceptance criteria reference it without a backing scenario. This gap means the DESIGN wave will not have a testable specification for the port-conflict path.

**Resolution**: Add the following scenario to US-HRC-02 UAT Scenarios section:

```gherkin
Scenario: Tray tooltip shows unavailable when port bind fails
  Given port 3748 is already in use by another process on Danielle's machine
  When norbert-hook-receiver.exe starts up
  Then the tray icon still appears in the Windows system tray
  And the tray tooltip shows "Norbert Hook Receiver" and "Port: unavailable"
  And the tray context menu shows "Port: unavailable"
```

And update the AC item from:
`- [ ] If port bind fails, tooltip shows "Port: unavailable" rather than crashing`

To:
`- [ ] If port bind fails, tray icon still appears and tooltip/menu show "Port: unavailable"`

---

## Recommended Improvements (Non-Blocking)

These are medium/low severity items that improve clarity but do not block handoff:

1. **M-01**: Remove `AtomicU64` from Technical Notes; replace with outcome-oriented constraint about counter readability
2. **M-02**: Add out-of-scope note in US-HRC-02 about Startup shortcut installation not being part of this feature
3. **M-03**: Add minimum Windows version target to US-HRC-02 Technical Notes (e.g. "Windows 10 version 1803 or later")
4. **M-04**: Clarify tooltip update strategy: "event count read on-demand when tooltip opens, no polling"
5. **L-01**: Convert the "visible without expanding columns" AC item to a prose note rather than a testable checkbox

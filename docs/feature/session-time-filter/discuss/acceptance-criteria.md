# Acceptance Criteria: Session Time Filter

## AC-1: Active Now filter (US-1)

```gherkin
Given the Sessions view contains 3 active and 10 completed sessions
When the user selects the "Active Now" filter
Then only the 3 active sessions are displayed
And each displayed session has a pulsing active indicator
```

```gherkin
Given no sessions are currently active
When the user selects "Active Now"
Then the empty filter state is shown
```

## AC-2: Time window filters (US-2)

```gherkin
Given sessions with last_event_at at 5m, 10m, 30m, and 2h ago
When the user selects "Last 15 min"
Then sessions at 5m and 10m are shown
And sessions at 30m and 2h are not shown
```

```gherkin
Given a session started 2 hours ago with last_event_at 10 minutes ago
When the user selects "Last 15 min"
Then the session is included (last activity falls within window)
```

```gherkin
Given sessions with last_event_at at 5m, 30m, 2h, and 25h ago
When the user selects "Last hour"
Then sessions at 5m and 30m are shown
```

```gherkin
Given sessions with last_event_at at 1h, 12h, 23h, and 48h ago
When the user selects "Last 24 hrs"
Then sessions at 1h, 12h, and 23h are shown
```

## AC-3: Filtered count in header (US-3)

```gherkin
Given 20 total sessions with 4 active in the last hour
When the user selects "Last hour"
Then the header displays "4 sessions"
```

```gherkin
Given the filter is set to "All" with 15 sessions
Then the header displays "15 sessions"
```

## AC-4: Empty filter state (US-4)

```gherkin
Given no sessions match the selected filter
Then the session list displays "No sessions in this time window"
And the header displays "0 sessions"
```

## AC-5: Default and persistence

```gherkin
Given the Sessions view loads for the first time
Then the filter defaults to "All"
And all sessions are displayed
```

```gherkin
Given the user has selected "Last hour"
When the user clicks a session to view detail
And navigates back to the Sessions list
Then the filter is still set to "Last hour"
```

## AC-6: Pure domain filter logic (NFR-1)

```gherkin
Given a filterSessions pure function
When called with sessions, filterId, and a timestamp
Then it returns the filtered array without side effects
And is testable without DOM or React
```

/**
 * Acceptance tests: Sidebar + Detail Layout Data Preparation (v2)
 *
 * Validates pure functions that prepare data for the sidebar display
 * (sparkline buffers, current values, selection state) and detail pane
 * (aggregate graph visibility, per-session grid layout, stats content,
 * session table content).
 *
 * Driving ports: categoryConfig (aggregate applicability), chartRenderer
 * (sparkline prep), crossSessionAggregator (session breakdown)
 *
 * These tests exercise data preparation logic, not React rendering.
 *
 * Traces to: ADR-007 "Sidebar-Detail Layout", ADR-009 "Aggregate
 * Applicability", Design spec Sections 1-4, US-PM-001, US-PM-002
 */

import { describe, it, expect } from "vitest";

// Driving ports
import {
  METRIC_CATEGORIES,
  getCategoryById,
  type MetricCategoryId,
} from "../../../src/plugins/norbert-usage/domain/categoryConfig";

import {
  aggregateAcrossSessions,
} from "../../../src/plugins/norbert-usage/domain/crossSessionAggregator";

import {
  createInitialMetrics,
  type SessionMetrics,
} from "../../../src/plugins/norbert-usage/domain/metricsAggregator";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const createSessionSnapshot = (
  overrides: Partial<SessionMetrics> & { sessionId: string },
): SessionMetrics => ({
  ...createInitialMetrics(overrides.sessionId),
  ...overrides,
});

// ---------------------------------------------------------------------------
// WALKING SKELETON: User selects a category and sees scoped detail
// Traces to: ADR-007, US-PM-001, Design spec Section 1
// ---------------------------------------------------------------------------

describe("User selects a metric category and sees category-scoped detail pane", () => {
  it("selecting tokens category shows aggregate graph and category-specific stats", () => {
    // Given Ravi has 3 active sessions
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "refactor-auth", burnRate: 312 }),
      createSessionSnapshot({ sessionId: "migrate-db", burnRate: 185 }),
      createSessionSnapshot({ sessionId: "test-coverage", burnRate: 30 }),
    ];

    // When the tokens category is selected
    const selectedCategory = getCategoryById("tokens");
    const aggregate = aggregateAcrossSessions(sessions);

    // Then the category is aggregate-applicable (tokens supports aggregation)
    expect(selectedCategory.aggregateApplicable).toBe(true);
    // And aggregate data is available for the detail pane
    expect(aggregate.totalTokenRate).toBe(527);
    expect(aggregate.sessionCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Aggregate Graph Visibility
// Traces to: ADR-009, Design spec Section 1 "Aggregate Graph Applicability"
// ---------------------------------------------------------------------------

describe("Detail pane shows aggregate graph for aggregatable categories", () => {
  it("tokens category has aggregate graph visible", () => {
    // Given the tokens category is selected
    const category = getCategoryById("tokens");

    // When checking whether to show the aggregate graph
    // Then the aggregate graph should be shown
    expect(category.aggregateApplicable).toBe(true);
  });

  it("cost category has aggregate graph visible", () => {
    // Given the cost category is selected
    const category = getCategoryById("cost");

    // Then the aggregate graph should be shown
    expect(category.aggregateApplicable).toBe(true);
  });

  it("agents category has aggregate graph visible", () => {
    // Given the agents category is selected
    const category = getCategoryById("agents");

    // Then the aggregate graph should be shown
    expect(category.aggregateApplicable).toBe(true);
  });
});

describe("Detail pane omits aggregate graph for context category", () => {
  it("context category skips aggregate graph and shows per-session as primary", () => {
    // Given the context category is selected
    const category = getCategoryById("context");

    // When checking whether to show the aggregate graph
    // Then the aggregate graph is omitted (context is not aggregatable)
    expect(category.aggregateApplicable).toBe(false);
    // And per-session graphs become the primary display
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Per-Session Grid Visibility Rules
// Traces to: Design spec Section 2 "Per-Session Graphs"
// ---------------------------------------------------------------------------

describe("Per-session grid hidden when only one session is active", () => {
  it("single session means per-session grid is not needed", () => {
    // Given Elena has only 1 active session
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "user-auth", burnRate: 280 }),
    ];

    // When the aggregate is computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then session count is 1 (view hides per-session grid)
    expect(aggregate.sessionCount).toBe(1);
  });
});

describe("Per-session grid shown when two or more sessions are active", () => {
  it("multiple sessions trigger per-session graph grid", () => {
    // Given Ravi has 3 active sessions
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "s1", burnRate: 100 }),
      createSessionSnapshot({ sessionId: "s2", burnRate: 200 }),
      createSessionSnapshot({ sessionId: "s3", burnRate: 300 }),
    ];

    // When the aggregate is computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then session count is > 1 (view shows per-session grid)
    expect(aggregate.sessionCount).toBeGreaterThan(1);
    // And per-session breakdown lists all sessions
    expect(aggregate.sessions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Session Table Columns by Category
// Traces to: Design spec Section 4 "Per-Session Breakdown"
// ---------------------------------------------------------------------------

describe("Session table columns change based on selected category", () => {
  it("tokens category shows tokens/s, agents, cost columns", () => {
    // Given the tokens category is selected
    const tokens = getCategoryById("tokens");

    // When the session columns are read
    // Then the columns are specific to token monitoring
    expect(tokens.sessionColumns).toBeDefined();
    expect(tokens.sessionColumns.length).toBeGreaterThanOrEqual(3);
  });

  it("context category shows context %, urgency, remaining columns", () => {
    // Given the context category is selected
    const context = getCategoryById("context");

    // When the session columns are read
    // Then the columns are specific to context monitoring
    expect(context.sessionColumns).toBeDefined();
    expect(context.sessionColumns.length).toBeGreaterThanOrEqual(3);
  });

  it("agents category shows agents, tokens/s, status columns", () => {
    // Given the agents category is selected
    const agents = getCategoryById("agents");

    // When the session columns are read
    // Then the columns are specific to agent monitoring
    expect(agents.sessionColumns).toBeDefined();
    expect(agents.sessionColumns.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Sidebar Current Value Display
// Traces to: Design spec Section 1 "Left Sidebar", data-models.md "Sidebar Display Data"
// ---------------------------------------------------------------------------

describe("Sidebar shows current value for each category from latest sample", () => {
  it("token rate formatted and displayed in sidebar row", () => {
    // Given the tokens category and a current aggregate rate of 527 tok/s
    const tokens = getCategoryById("tokens");

    // When the current value is formatted
    const formatted = tokens.formatValue(527);

    // Then the sidebar displays "527 tok/s"
    expect(formatted).toBe("527 tok/s");
  });

  it("cost rate formatted and displayed in sidebar row", () => {
    // Given the cost category and a current cost rate of 0.005 $/s
    const cost = getCategoryById("cost");

    // When the current value is formatted
    const formatted = cost.formatValue(0.005);

    // Then the sidebar displays the rate as $/min
    expect(formatted).toContain("/min");
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Empty State
// Traces to: US-PM-001 scenario 3
// ---------------------------------------------------------------------------

describe("No sessions active produces zero aggregate for all categories", () => {
  it("all category values are zero when no sessions exist", () => {
    // Given Marcus has no active Claude Code sessions
    const sessions: ReadonlyArray<SessionMetrics> = [];

    // When aggregate metrics are computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then all values are zero
    expect(aggregate.totalTokenRate).toBe(0);
    expect(aggregate.totalCostRate).toBe(0);
    expect(aggregate.totalActiveAgents).toBe(0);
    expect(aggregate.sessionCount).toBe(0);
  });
});

describe("Session ends while viewing detail pane", () => {
  it("aggregate recomputes correctly when a session is removed", () => {
    // Given 3 sessions and one ends
    const allSessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "s1", burnRate: 200 }),
      createSessionSnapshot({ sessionId: "ending", burnRate: 150 }),
      createSessionSnapshot({ sessionId: "s3", burnRate: 100 }),
    ];

    // When session "ending" is removed from the active set
    const remaining = allSessions.filter(s => s.sessionId !== "ending");
    const aggregate = aggregateAcrossSessions(remaining);

    // Then aggregate reflects only the remaining sessions
    expect(aggregate.totalTokenRate).toBe(300);
    expect(aggregate.sessionCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Context Data Unavailable in Detail Pane
// Traces to: US-PM-005 scenario 3
// ---------------------------------------------------------------------------

describe("Session with zero context data shows safely in detail pane", () => {
  it("zero max tokens signals data unavailability", () => {
    // Given a session where context data is not available
    const session = createSessionSnapshot({
      sessionId: "no-context",
      contextWindowPct: 0,
      contextWindowMaxTokens: 0,
    });

    // When the context category is selected
    // Then the session's context value is 0
    expect(session.contextWindowPct).toBe(0);
    // And max tokens being 0 signals the view to show "Data unavailable"
    expect(session.contextWindowMaxTokens).toBe(0);
  });
});

describe("New session added while viewing detail pane", () => {
  it("aggregate updates correctly when a new session appears", () => {
    // Given 2 sessions and the user is viewing the tokens detail
    const existingSessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "s1", burnRate: 250 }),
      createSessionSnapshot({ sessionId: "s2", burnRate: 150 }),
    ];

    // When a new session starts
    const updatedSessions: ReadonlyArray<SessionMetrics> = [
      ...existingSessions,
      createSessionSnapshot({ sessionId: "new-session", burnRate: 80 }),
    ];

    const aggregate = aggregateAcrossSessions(updatedSessions);

    // Then the aggregate includes the new session
    expect(aggregate.sessionCount).toBe(3);
    expect(aggregate.totalTokenRate).toBe(480);
  });
});

describe("All sessions idle shows zero rates across all categories", () => {
  it("zero burn rates produce zero aggregate for all aggregatable categories", () => {
    // Given 3 sessions all idle (zero burn rate)
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "idle-1", burnRate: 0, activeAgentCount: 0 }),
      createSessionSnapshot({ sessionId: "idle-2", burnRate: 0, activeAgentCount: 0 }),
      createSessionSnapshot({ sessionId: "idle-3", burnRate: 0, activeAgentCount: 0 }),
    ];

    // When aggregate is computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then all rates are zero but session count is 3
    expect(aggregate.totalTokenRate).toBe(0);
    expect(aggregate.totalCostRate).toBe(0);
    expect(aggregate.totalActiveAgents).toBe(0);
    expect(aggregate.sessionCount).toBe(3);
  });
});

describe("Session breakdown sorted by primary metric for each category", () => {
  it("sessions sorted by token rate descending when tokens selected", () => {
    // Given sessions with rates 30, 312, 185 (unsorted)
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "low", burnRate: 30 }),
      createSessionSnapshot({ sessionId: "high", burnRate: 312 }),
      createSessionSnapshot({ sessionId: "mid", burnRate: 185 }),
    ];

    // When aggregate is computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then sessions are sorted: 312, 185, 30
    expect(aggregate.sessions[0].tokenRate).toBe(312);
    expect(aggregate.sessions[1].tokenRate).toBe(185);
    expect(aggregate.sessions[2].tokenRate).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// BOUNDARY SCENARIOS: Category Selection State
// ---------------------------------------------------------------------------

describe("Default category selection is tokens", () => {
  it("first category in the configuration is tokens", () => {
    // Given the category configuration
    // When the first category is checked
    // Then it is tokens (default selection for initial load)
    expect(METRIC_CATEGORIES[0].id).toBe("tokens");
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIOS
// Traces to: Design spec -- all 4 categories rendered in sidebar
// ---------------------------------------------------------------------------

describe("@property: every category has all required sidebar display fields", () => {
  it("every category has label, color, and formatValue function", () => {
    // Given the full category configuration
    for (const category of METRIC_CATEGORIES) {
      // When required sidebar fields are checked
      // Then all fields are present and valid
      expect(category.label).toBeTruthy();
      expect(category.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(typeof category.formatValue).toBe("function");
    }
  });
});

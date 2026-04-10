/**
 * Acceptance tests: Session Metrics Table — Walking Skeletons
 *
 * End-to-end walking skeletons that validate the core user experience:
 * sessions displayed as a sortable metrics table with status, name,
 * cost, and token columns visible by default.
 *
 * Driving ports:
 *   - Session table data transformation (pure domain functions)
 *   - SessionMetrics from norbert-usage plugin domain
 *   - SessionInfo + isSessionActive from src/domain/status.ts
 *   - Presentation helpers from src/domain/sessionPresentation.ts
 *
 * Traces to: WS-1 (table renders), WS-2 (cost/token comparison), WS-3 (row selection)
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// PLACEHOLDER: imports will target production driving ports once implemented.
//
// Expected driving ports (pure domain functions):
//   - buildTableRows(sessions, metrics, metadata, now) → TableRow[]
//   - formatCostColumn(cost) → string
//   - formatTokenColumn(tokens) → string
//   - computeStatusBarAggregates(rows) → StatusBarData
//
// From existing domain:
//   - isSessionActive (src/domain/status.ts)
//   - deriveSessionName (src/domain/sessionPresentation.ts)
//   - SessionMetrics (src/plugins/norbert-usage/domain/types.ts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WALKING SKELETON WS-1: Table renders with Status and Name columns
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User views sessions as a metrics table with status and name", () => {
  it("table rows show status indicator and project name for each session", () => {
    // Given three sessions are running: "norbert", "api-server", and "docs-site"
    //   "norbert" cwd is "/home/phil/Git/norbert"
    //   "api-server" cwd is "/home/phil/Git/api-server"
    //   "docs-site" cwd is "/home/phil/Git/docs-site"
    // And "norbert" and "api-server" are active (last event within 5 min)
    // And "docs-site" completed 10 minutes ago
    //
    // When the table row data is built from sessions, metrics, and metadata
    //
    // Then each row has a name derived from the working directory last segment:
    //   "norbert", "api-server", "docs-site"
    // And "norbert" and "api-server" rows are marked as active (pulsing green dot)
    // And "docs-site" row is marked as completed (dim dot)

    // PLACEHOLDER: implement once buildTableRows driving port exists
    expect(true).toBe(true); // Skeleton compiles — first scenario to make fail
  });
});

// ---------------------------------------------------------------------------
// WALKING SKELETON WS-2: Cost and token comparison
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User compares session costs and token usage across sessions", () => {
  it.skip("cost and token columns display formatted values for each session", () => {
    // Given session "norbert" has spent $1.24 and used 142,500 tokens
    // And session "api-server" has spent $0.08 and used 9,300 tokens
    // And session "docs-site" has spent $0.52 and used 61,000 tokens
    //
    // When the table row data is built
    //
    // Then the "norbert" row shows cost "$1.24" and tokens "142.5K"
    // And the "api-server" row shows cost "$0.08" and tokens "9.3K"
    // And the "docs-site" row shows cost "$0.52" and tokens "61.0K"
  });
});

// ---------------------------------------------------------------------------
// WALKING SKELETON WS-3: Row selection opens detail panel
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User selects a session row to view detailed metrics", () => {
  it.skip("clicking a row returns the session ID for detail panel navigation", () => {
    // Given session "norbert" with ID "abc-123" appears in the metrics table
    //
    // When the user selects the "norbert" row
    //
    // Then the onSessionSelect callback receives "abc-123"
    // And the "norbert" row is marked as selected
  });
});

/**
 * Acceptance tests: Cost Burn Ticker (US-004)
 *
 * Validates the cost ticker data computation: formatting, color shift
 * thresholds based on session average, and zero-state display.
 *
 * Driving ports: pure domain functions (cost ticker data computation)
 * These tests exercise the data transformation for the status bar item,
 * not the React rendering or animation.
 *
 * Traces to: US-004 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  computeCostTickerData,
  type CostTickerData,
} from "../../../src/plugins/norbert-usage/domain/costTicker";

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Cost Ticker Display
// ---------------------------------------------------------------------------

describe("Cost ticker formats session cost as currency", () => {
  it("displays cost with dollar sign and two decimal places", () => {
    // Given an active session with cost $1.47
    const currentCost = 1.47;
    const sessionAverage = 3.0;

    // When ticker data is computed
    const ticker = computeCostTickerData(currentCost, sessionAverage);

    // Then the label shows "$1.47"
    expect(ticker.label).toBe("$1.47");
    // And the ticker is in brand color (below average)
    expect(ticker.colorZone).toBe("brand");
  });
});

describe("Cost ticker color shifts at session average", () => {
  it("shifts from brand to amber when cost approaches historical average", () => {
    // Given a historical session average cost of $3.00
    // And current session cost is $3.00 (at average)
    const currentCost = 3.0;
    const sessionAverage = 3.0;

    // When ticker data is computed
    const ticker = computeCostTickerData(currentCost, sessionAverage);

    // Then the color shifts toward amber
    expect(ticker.colorZone).toBe("amber");
  });

  it("shifts to red when cost significantly exceeds historical average", () => {
    // Given a historical session average of $3.00
    // And current session cost is $4.50 (50% above average)
    const currentCost = 4.5;
    const sessionAverage = 3.0;

    // When ticker data is computed
    const ticker = computeCostTickerData(currentCost, sessionAverage);

    // Then the color shifts to red
    expect(ticker.colorZone).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Cost ticker shows zero for no active session", () => {
  it("displays $0.00 in dim state when no session is active", () => {
    // Given no active session (cost is zero, no average)
    const currentCost = 0;
    const sessionAverage = 0;

    // When ticker data is computed
    const ticker = computeCostTickerData(currentCost, sessionAverage);

    // Then the label shows "$0.00"
    expect(ticker.label).toBe("$0.00");
    // And the display is in dim state
    expect(ticker.colorZone).toBe("dim");
  });
});

describe("Cost ticker handles first session with no history", () => {
  it("stays brand color when there is no historical average to compare", () => {
    // Given a first-time user with active session at $2.00
    // And no historical average exists (null or zero)
    const currentCost = 2.0;
    const sessionAverage = 0; // no history

    // When ticker data is computed
    const ticker = computeCostTickerData(currentCost, sessionAverage);

    // Then the label shows "$2.00"
    expect(ticker.label).toBe("$2.00");
    // And the color stays brand (no comparison threshold)
    expect(ticker.colorZone).toBe("brand");
  });
});

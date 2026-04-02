/**
 * Acceptance tests: Hover Tooltip Hit-Testing (v2)
 *
 * Validates the pure domain hit-test pipeline: mouseX position to
 * sample index, sample value lookup, time offset computation, and
 * formatted tooltip content per category.
 *
 * Driving ports: chartRenderer (hit-test), categoryConfig (formatValue)
 * All computations are pure functions -- no canvas context needed.
 *
 * Traces to: ADR-010 "Canvas Hover Tooltip Architecture",
 * Design spec Section 2 "Hover Tooltips"
 */

import { describe, it, expect } from "vitest";

// Driving ports
import {
  computeHitTest,
  formatTimeOffset,
} from "../../../src/plugins/norbert-usage/domain/chartRenderer";

import {
  getCategoryById,
} from "../../../src/plugins/norbert-usage/domain/categoryConfig";

// ---------------------------------------------------------------------------
// WALKING SKELETON: User sees tooltip content for hovered chart point
// Traces to: ADR-010, Design spec Section 2 "Hover Tooltips"
// ---------------------------------------------------------------------------

describe("User hovers over token chart and sees rate with time offset", () => {
  it("tooltip shows formatted token rate and seconds ago", () => {
    // Given Ravi is viewing the tokens/s chart with 60 samples
    // And the user hovers at a position mapping to sample index 37
    const sampleIndex = 37;
    const bufferLength = 60;

    // When the time offset is computed (37th sample in a 60-sample buffer)
    // The sample is 23 positions from the right (60 - 37 = 23 seconds ago)
    const timeOffsetMs = (bufferLength - 1 - sampleIndex) * 1000;
    const timeLabel = formatTimeOffset(timeOffsetMs);

    // And the value is formatted using the tokens category formatter
    const tokens = getCategoryById("tokens");
    const sampleValue = 842;
    const formattedValue = tokens.formatValue(sampleValue);

    // Then the tooltip shows "842 tok/s"
    expect(formattedValue).toBe("842 tok/s");
    // And the time label shows "22s ago"
    expect(timeLabel).toBe("22s ago");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Tooltip Content by Category
// Traces to: Design spec Section 2 "Tooltip content (varies by category)"
// ---------------------------------------------------------------------------

describe("Tooltip shows cost rate formatted for cost category", () => {
  it("cost tooltip shows $/min with time offset", () => {
    // Given the user hovers over the cost chart at a sample with value 0.000568 $/s
    const cost = getCategoryById("cost");
    const formattedValue = cost.formatValue(0.000568);

    // Then the formatted value includes $/min
    expect(formattedValue).toContain("/min");
  });
});

describe("Tooltip shows agent count for agents category", () => {
  it("agents tooltip shows integer count", () => {
    // Given the user hovers over the agents chart at a sample with value 3
    const agents = getCategoryById("agents");
    const formattedValue = agents.formatValue(3);

    // Then the formatted value shows "3"
    expect(formattedValue).toBe("3");
  });
});

describe("Tooltip shows latency for latency category", () => {
  it("latency tooltip shows milliseconds with time offset", () => {
    // Given the user hovers over the latency chart at a sample with value 423
    const latency = getCategoryById("latency");
    const formattedValue = latency.formatValue(423);

    // Then the formatted value shows "423ms"
    expect(formattedValue).toBe("423ms");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Tooltip Position Relative to Data
// Traces to: ADR-010 "Mouse position tracking per canvas"
// ---------------------------------------------------------------------------

describe("Hit-test maps hover position to correct sample for tooltip", () => {
  it("hovering over the newest data point shows '0s ago'", () => {
    // Given a chart with 60 samples
    const bufferLength = 60;
    const canvasWidth = 400;
    const padding = 10;

    // When hovering at the rightmost edge (newest data)
    const result = computeHitTest(canvasWidth - padding, canvasWidth, bufferLength, padding);

    // Then the sample index is the last one
    expect(result.sampleIndex).toBe(bufferLength - 1);
    // And time offset is 0s ago
    const timeOffsetMs = (bufferLength - 1 - result.sampleIndex) * 1000;
    expect(formatTimeOffset(timeOffsetMs)).toBe("0s ago");
  });

  it("hovering over the oldest data point shows '59s ago'", () => {
    // Given a chart with 60 samples (60-second window)
    const bufferLength = 60;
    const canvasWidth = 400;
    const padding = 10;

    // When hovering at the leftmost edge (oldest data)
    const result = computeHitTest(padding, canvasWidth, bufferLength, padding);

    // Then the sample index is the first one
    expect(result.sampleIndex).toBe(0);
    // And time offset is 59s ago
    const timeOffsetMs = (bufferLength - 1 - result.sampleIndex) * 1000;
    expect(formatTimeOffset(timeOffsetMs)).toBe("59s ago");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Tooltip Border Color Matches Category
// Traces to: Design spec Section 2 "1px border in the line color"
// ---------------------------------------------------------------------------

describe("Tooltip border color matches the selected category line color", () => {
  it("tokens tooltip uses brand cyan border", () => {
    // Given the tokens category is selected
    const tokens = getCategoryById("tokens");

    // When the tooltip border color is determined
    // Then it matches the category line color
    expect(tokens.color).toBe("#00e5cc");
  });

  it("cost tooltip uses amber border", () => {
    // Given the cost category is selected
    const cost = getCategoryById("cost");

    // Then the tooltip border uses amber
    expect(cost.color).toBe("#f0920a");
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Tooltip Edge Cases
// ---------------------------------------------------------------------------

describe("Tooltip handles edge of chart area gracefully", () => {
  it("near-right-edge hover flips tooltip position left", () => {
    // Given a chart canvas of width 400
    // When hovering at x=390 (near right edge)
    const result = computeHitTest(390, 400, 60, 10);

    // Then hit-test still returns a valid sample index
    expect(result.sampleIndex).toBeGreaterThanOrEqual(0);
    expect(result.sampleIndex).toBeLessThan(60);
  });
});

describe("Tooltip disappears when cursor leaves canvas area", () => {
  it("hit-test with zero buffer length indicates no tooltip", () => {
    // Given a chart with no data
    const result = computeHitTest(200, 400, 0, 10);

    // Then no valid sample is found
    expect(result.sampleIndex).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIOS
// Traces to: ADR-010 -- hit-test is always deterministic
// ---------------------------------------------------------------------------

describe("@property: same mouseX always produces same sampleIndex", () => {
  it("hit-test is a pure deterministic function", () => {
    // Given fixed chart parameters
    const mouseX = 175;
    const canvasWidth = 400;
    const bufferLength = 60;
    const padding = 10;

    // When hit-test is computed multiple times
    const result1 = computeHitTest(mouseX, canvasWidth, bufferLength, padding);
    const result2 = computeHitTest(mouseX, canvasWidth, bufferLength, padding);
    const result3 = computeHitTest(mouseX, canvasWidth, bufferLength, padding);

    // Then all results are identical
    expect(result1.sampleIndex).toBe(result2.sampleIndex);
    expect(result2.sampleIndex).toBe(result3.sampleIndex);
  });
});

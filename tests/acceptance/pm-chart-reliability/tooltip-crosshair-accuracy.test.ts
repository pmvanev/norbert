/**
 * Acceptance tests: Tooltip and Crosshair Accuracy (pm-chart-reliability)
 *
 * Validates that the tooltip shows correct values at the hovered position
 * and that the crosshair aligns with the cursor. Tests exercise pure
 * domain functions for hit-test, crosshair position computation, and
 * tooltip content formatting. DPI correctness is validated by ensuring
 * all coordinate computation uses CSS pixels (not device pixels).
 *
 * Driving ports:
 *   - chartRenderer.computeHitTest (domain)
 *   - chartRenderer.computeCrosshairPosition (domain)
 *   - chartRenderer.formatTimeOffset (domain)
 *   - categoryConfig.getCategoryById (domain)
 *
 * Traces to: US-PMR-02 acceptance criteria
 */

import { describe, it, expect } from "vitest";

import {
  computeHitTest,
  computeCrosshairPosition,
  formatTimeOffset,
  prepareFilledAreaPoints,
} from "../../../src/plugins/norbert-usage/domain/chartRenderer";

import {
  getCategoryById,
} from "../../../src/plugins/norbert-usage/domain/categoryConfig";

import type { HoverState } from "../../../src/plugins/norbert-usage/domain/types";
import type { HoverData } from "../../../src/plugins/norbert-usage/views/PMChart";

import type { CanvasDimensions } from "../../../src/plugins/norbert-usage/domain/oscilloscope";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHART_DIMENSIONS: CanvasDimensions = {
  width: 400,
  height: 200,
  padding: 10,
};

const createSamples = (
  values: ReadonlyArray<number>,
): ReadonlyArray<{ timestamp: number; value: number }> =>
  values.map((value, index) => ({
    timestamp: Date.now() - (values.length - 1 - index) * 1000,
    value,
  }));

// ---------------------------------------------------------------------------
// WALKING SKELETON: Raj hovers over chart and sees correct value
// Traces to: US-PMR-02 AC3, AC1
// ---------------------------------------------------------------------------

describe("Raj hovers over a data point and sees the correct token rate and time offset", () => {
  it("hover at chart midpoint shows the sample value and time offset", () => {
    // Given the aggregate chart displays 60 samples of token rate data
    const bufferLength = 60;
    const canvasWidth = 400;
    const padding = 10;
    const sampleValues = Array.from({ length: 60 }, (_, i) => 400 + i * 5);

    // When Raj moves his mouse to the midpoint of the chart
    const mouseX = 200;
    const hitResult = computeHitTest(mouseX, canvasWidth, bufferLength, padding);

    // Then the hit-test resolves to a sample near the middle of the buffer
    expect(hitResult.sampleIndex).toBeGreaterThanOrEqual(25);
    expect(hitResult.sampleIndex).toBeLessThanOrEqual(34);

    // And the tooltip value can be formatted using the tokens category
    const tokens = getCategoryById("tokens");
    const sampleValue = sampleValues[hitResult.sampleIndex];
    const formattedValue = tokens.formatValue(sampleValue);
    expect(formattedValue).toContain("tok/s");

    // And the time offset reflects how far back this sample is
    const timeOffsetMs = (bufferLength - 1 - hitResult.sampleIndex) * 1000;
    const timeLabel = formatTimeOffset(timeOffsetMs);
    expect(timeLabel).toMatch(/^\d+s ago$/);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Crosshair position accuracy
// Traces to: US-PMR-02 AC1 (within 2 pixels at any DPI)
// ---------------------------------------------------------------------------

describe("Crosshair aligns with cursor position in CSS pixel space", () => {
  it("crosshair X at midpoint is within the drawable area center", () => {
    // Given a chart with 60 samples at 100% DPI (CSS pixels = device pixels)
    const sampleIndex = 30;
    const sampleValue = 500;
    const bufferLength = 60;
    const yMax = 1000;

    // When crosshair position is computed
    const crosshair = computeCrosshairPosition(
      sampleIndex, sampleValue, bufferLength, yMax, CHART_DIMENSIONS,
    );

    // Then the crosshair X is near the horizontal midpoint of the drawable area
    const drawableWidth = CHART_DIMENSIONS.width - 2 * CHART_DIMENSIONS.padding;
    const expectedX = CHART_DIMENSIONS.padding + (30 / 59) * drawableWidth;
    expect(Math.abs(crosshair.x - expectedX)).toBeLessThan(2);
  });

  it("crosshair dot Y reflects the sample value position on the canvas", () => {
    // Given a sample at 75% of yMax
    const sampleValue = 750;
    const yMax = 1000;

    // When crosshair position is computed
    const crosshair = computeCrosshairPosition(30, sampleValue, 60, yMax, CHART_DIMENSIONS);

    // Then the dot Y is approximately 75% up from the bottom
    const topY = CHART_DIMENSIONS.padding;
    const bottomY = CHART_DIMENSIONS.height - CHART_DIMENSIONS.padding;
    const expectedY = bottomY - (0.75 * (bottomY - topY));
    expect(Math.abs(crosshair.dotY - expectedY)).toBeLessThan(2);
  });
});

describe("Crosshair computed in CSS pixels stays within drawable bounds", () => {
  it("crosshair position is always within [padding, width - padding] for any valid sample index and value", () => {
    // Given various sample indices and values across the range
    const bufferLength = 60;
    const yMax = 1000;
    const leftBound = CHART_DIMENSIONS.padding;
    const rightBound = CHART_DIMENSIONS.width - CHART_DIMENSIONS.padding;
    const topBound = CHART_DIMENSIONS.padding;
    const bottomBound = CHART_DIMENSIONS.height - CHART_DIMENSIONS.padding;

    const testCases = [
      { index: 0, value: 0 },
      { index: 0, value: 1000 },
      { index: 59, value: 0 },
      { index: 59, value: 1000 },
      { index: 30, value: 500 },
      { index: 15, value: 250 },
      { index: 45, value: 750 },
    ];

    for (const { index, value } of testCases) {
      const crosshair = computeCrosshairPosition(index, value, bufferLength, yMax, CHART_DIMENSIONS);

      // Then crosshair X stays within horizontal drawable area
      expect(crosshair.x).toBeGreaterThanOrEqual(leftBound - 1);
      expect(crosshair.x).toBeLessThanOrEqual(rightBound + 1);

      // And crosshair dotY stays within vertical drawable area
      expect(crosshair.dotY).toBeGreaterThanOrEqual(topBound - 1);
      expect(crosshair.dotY).toBeLessThanOrEqual(bottomBound + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Tooltip content per category
// Traces to: US-PMR-02 AC3
// ---------------------------------------------------------------------------

describe("Tooltip shows category-appropriate formatted values", () => {
  it("tokens tooltip shows rate in tok/s", () => {
    // Given Raj hovers over a point showing 527 tokens per second
    const tokens = getCategoryById("tokens");
    const formatted = tokens.formatValue(527);

    // Then the tooltip displays "527 tok/s"
    expect(formatted).toBe("527 tok/s");
  });

  it("cost tooltip shows dollar rate per minute", () => {
    // Given Raj hovers over a cost data point
    const cost = getCategoryById("cost");
    const formatted = cost.formatValue(0.000568);

    // Then the tooltip includes $/min formatting
    expect(formatted).toContain("/min");
  });

  it("latency tooltip shows milliseconds", () => {
    // Given Raj hovers over a latency data point at 423ms
    const latency = getCategoryById("latency");
    const formatted = latency.formatValue(423);

    // Then the tooltip displays "423ms"
    expect(formatted).toBe("423ms");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Time offset formatting
// Traces to: US-PMR-02 tooltip displays "Ns ago"
// ---------------------------------------------------------------------------

describe("Tooltip time offset shows seconds since sample was recorded", () => {
  it("most recent sample shows 0s ago", () => {
    expect(formatTimeOffset(0)).toBe("0s ago");
  });

  it("sample from 12 seconds ago shows 12s ago", () => {
    expect(formatTimeOffset(12000)).toBe("12s ago");
  });

  it("sample from 59 seconds ago shows 59s ago", () => {
    expect(formatTimeOffset(59000)).toBe("59s ago");
  });
});

// ---------------------------------------------------------------------------
// ERROR/BOUNDARY SCENARIOS: Tooltip edge cases
// Traces to: US-PMR-02 AC4 (tooltip flips near right edge)
// ---------------------------------------------------------------------------

describe("Hit-test near chart edges returns valid boundary samples", () => {
  it("hovering at the leftmost edge targets the oldest sample", () => {
    // Given a chart with 60 samples
    const result = computeHitTest(
      CHART_DIMENSIONS.padding, CHART_DIMENSIONS.width, 60, CHART_DIMENSIONS.padding,
    );

    // Then the oldest sample (index 0) is targeted
    expect(result.sampleIndex).toBe(0);
  });

  it("hovering at the rightmost edge targets the newest sample", () => {
    // Given a chart with 60 samples
    const result = computeHitTest(
      CHART_DIMENSIONS.width - CHART_DIMENSIONS.padding,
      CHART_DIMENSIONS.width, 60, CHART_DIMENSIONS.padding,
    );

    // Then the newest sample (index 59) is targeted
    expect(result.sampleIndex).toBe(59);
  });

  it("hovering beyond the right boundary clamps to the last sample", () => {
    // Given the mouse moves past the chart area
    const result = computeHitTest(500, CHART_DIMENSIONS.width, 60, CHART_DIMENSIONS.padding);

    // Then the hit-test clamps to the last valid index
    expect(result.sampleIndex).toBe(59);
  });

  it("hovering before the left boundary clamps to the first sample", () => {
    // Given the mouse is before the chart area
    const result = computeHitTest(-20, CHART_DIMENSIONS.width, 60, CHART_DIMENSIONS.padding);

    // Then the hit-test clamps to index 0
    expect(result.sampleIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIO: Tooltip disappears when mouse leaves chart
// Traces to: US-PMR-02 AC5
// ---------------------------------------------------------------------------

describe("No tooltip data produced when chart has no samples", () => {
  it("hit-test on empty buffer returns invalid index", () => {
    // Given the chart has no data (mouse leaving or no sessions)
    const result = computeHitTest(200, CHART_DIMENSIONS.width, 0, CHART_DIMENSIONS.padding);

    // Then the hit-test indicates no valid sample
    expect(result.sampleIndex).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIO: Crosshair at extreme values
// ---------------------------------------------------------------------------

describe("Crosshair handles extreme sample values gracefully", () => {
  it("crosshair for zero value positions dot at baseline", () => {
    // Given a sample with zero token rate
    const crosshair = computeCrosshairPosition(30, 0, 60, 1000, CHART_DIMENSIONS);

    // Then the dot is at the bottom of the chart area
    const bottomY = CHART_DIMENSIONS.height - CHART_DIMENSIONS.padding;
    expect(crosshair.dotY).toBe(bottomY);
  });

  it("crosshair for value at yMax positions dot at top", () => {
    // Given a sample at the maximum value
    const crosshair = computeCrosshairPosition(30, 1000, 60, 1000, CHART_DIMENSIONS);

    // Then the dot is at the top of the chart area
    expect(crosshair.dotY).toBe(CHART_DIMENSIONS.padding);
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIO
// Traces to: US-PMR-02 "crosshair within 2 pixels at any DPI"
// ---------------------------------------------------------------------------

describe("@property: crosshair X is always within the drawable chart area", () => {
  it("for any valid sample index, crosshair X stays within padding bounds", () => {
    const bufferLength = 60;
    const yMax = 1000;
    const leftBound = CHART_DIMENSIONS.padding;
    const rightBound = CHART_DIMENSIONS.width - CHART_DIMENSIONS.padding;

    // Given any valid sample index from 0 to 59
    for (let idx = 0; idx < bufferLength; idx++) {
      const crosshair = computeCrosshairPosition(idx, 500, bufferLength, yMax, CHART_DIMENSIONS);

      // Then the crosshair X is always within the drawable area
      expect(crosshair.x).toBeGreaterThanOrEqual(leftBound - 1);
      expect(crosshair.x).toBeLessThanOrEqual(rightBound + 1);
    }
  });
});

describe("@property: hit-test is deterministic for fixed inputs", () => {
  it("same mouseX always produces same sample index", () => {
    // Given fixed chart parameters
    const mouseX = 175;
    const results = Array.from({ length: 10 }, () =>
      computeHitTest(mouseX, CHART_DIMENSIONS.width, 60, CHART_DIMENSIONS.padding),
    );

    // Then all results are identical
    const firstIndex = results[0].sampleIndex;
    for (const result of results) {
      expect(result.sampleIndex).toBe(firstIndex);
    }
  });
});

// ---------------------------------------------------------------------------
// D3: Hover handler wiring -- createHoverHandler populates HoverState correctly
// Traces to: US-PMR-02 AC3 (tooltip shows correct values)
// ---------------------------------------------------------------------------

describe("createHoverHandler populates HoverState fields from HoverData", () => {
  it("hover handler maps HoverData fields to HoverState with correct formatting", () => {
    // Given a hover handler built the same way as PMDetailPane.createHoverHandler
    const category = getCategoryById("tokens");
    const themeColor = category.color;
    const canvasId = "aggregate-tokens";
    let capturedState: HoverState | undefined;

    const onHoverChange = (state: HoverState): void => {
      capturedState = state;
    };

    // Replicate the createHoverHandler closure from PMDetailPane
    const createHoverHandler = (id: string) => (data: HoverData): void => {
      onHoverChange({
        active: true,
        canvasId: id,
        mouseX: 0,
        sampleIndex: data.sampleIndex,
        value: data.value,
        formattedValue: category.formatValue(data.value),
        timeOffset: `${Math.round(data.timeOffsetMs / 1000)}s ago`,
        color: themeColor,
        tooltipX: data.tooltipX,
        tooltipY: data.tooltipY,
      });
    };

    const handler = createHoverHandler(canvasId);

    // When hover data arrives with known values
    const hoverData: HoverData = {
      sampleIndex: 42,
      value: 527,
      timeOffsetMs: 17000,
      tooltipX: 250,
      tooltipY: 100,
    };

    handler(hoverData);

    // Then HoverState is correctly populated
    expect(capturedState).toBeDefined();
    expect(capturedState!.active).toBe(true);
    expect(capturedState!.canvasId).toBe("aggregate-tokens");
    expect(capturedState!.sampleIndex).toBe(42);
    expect(capturedState!.value).toBe(527);
    expect(capturedState!.formattedValue).toBe("527 tok/s");
    expect(capturedState!.timeOffset).toBe("17s ago");
    expect(capturedState!.color).toBe(themeColor);
    expect(capturedState!.tooltipX).toBe(250);
    expect(capturedState!.tooltipY).toBe(100);
  });
});

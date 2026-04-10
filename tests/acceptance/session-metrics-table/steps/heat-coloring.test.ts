/**
 * Acceptance tests: Session Metrics Table -- Heat-Colored Cells
 *
 * Validates that metric cells shade from neutral through amber to red
 * as values increase, enabling at-a-glance resource identification
 * similar to Windows Task Manager.
 *
 * Driving ports:
 *   - computeHeatLevel(value, columnId) -> HeatLevel ('neutral' | 'amber' | 'red')
 *   - deriveHeatClass(heatLevel) -> string (CSS class)
 *
 * Traces to: Milestone 2 -- Heat Coloring
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  computeHeatLevel,
  deriveHeatClass,
} from "../../../../src/plugins/norbert-session/domain/sessionMetricsTable";
import type { HeatLevel, HeatColumnId } from "../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEAT_ORDINAL: Record<HeatLevel, number> = {
  neutral: 0,
  amber: 1,
  red: 2,
};

// ---------------------------------------------------------------------------
// COST HEAT SHADING
// ---------------------------------------------------------------------------

describe("Cost cell shading reflects spending level", () => {
  it("high cost gets red, medium gets amber, low gets neutral", () => {
    // Given session "norbert" has cost $4.50
    // And session "api-server" has cost $0.08
    // And session "docs-site" has cost $0.80
    const norbert = computeHeatLevel(4.5, "cost");
    const apiServer = computeHeatLevel(0.08, "cost");
    const docsSite = computeHeatLevel(0.8, "cost");

    // Then "norbert" cost heat level is "red"
    expect(norbert).toBe("red");
    // And "api-server" cost heat level is "neutral"
    expect(apiServer).toBe("neutral");
    // And "docs-site" cost heat level is "amber"
    expect(docsSite).toBe("amber");
  });
});

// ---------------------------------------------------------------------------
// CONTEXT UTILIZATION HEAT SHADING
// ---------------------------------------------------------------------------

describe("Context utilization cell shading warns of compaction risk", () => {
  it("high context utilization gets red heat level", () => {
    // Given session "norbert" is at 92% context utilization
    // And session "api-server" is at 30% context utilization
    const norbert = computeHeatLevel(92, "contextPercent");
    const apiServer = computeHeatLevel(30, "contextPercent");

    // Then "norbert" context heat level is "red"
    expect(norbert).toBe("red");
    // And "api-server" context heat level is "neutral"
    expect(apiServer).toBe("neutral");
  });
});

// ---------------------------------------------------------------------------
// BURN RATE HEAT SHADING
// ---------------------------------------------------------------------------

describe("Burn rate cell shading highlights fast token consumption", () => {
  it("high burn rate gets red heat level", () => {
    // Given session "norbert" has burn rate 450 tok/s
    // And session "api-server" has burn rate 25 tok/s
    const norbert = computeHeatLevel(450, "burnRate");
    const apiServer = computeHeatLevel(25, "burnRate");

    // Then "norbert" burn rate heat level is "red"
    expect(norbert).toBe("red");
    // And "api-server" burn rate heat level is "neutral"
    expect(apiServer).toBe("neutral");
  });
});

// ---------------------------------------------------------------------------
// TOKEN COUNT HEAT SHADING
// ---------------------------------------------------------------------------

describe("Token count cell shading reflects volume", () => {
  it("high token count gets red, low gets neutral", () => {
    // Given session "norbert" has used 500,000 tokens
    // And session "api-server" has used 5,000 tokens
    const norbert = computeHeatLevel(500_000, "totalTokens");
    const apiServer = computeHeatLevel(5_000, "totalTokens");

    // Then "norbert" tokens heat level is "red"
    expect(norbert).toBe("red");
    // And "api-server" tokens heat level is "neutral"
    expect(apiServer).toBe("neutral");
  });
});

// ---------------------------------------------------------------------------
// API HEALTH HEAT SHADING
// ---------------------------------------------------------------------------

describe("API health cell shading highlights error-prone sessions", () => {
  it("low API success rate gets red heat level", () => {
    // Given session "norbert" has 99.8% API success rate
    // And session "flaky-build" has 85% API success rate
    const norbert = computeHeatLevel(99.8, "apiHealth");
    const flakyBuild = computeHeatLevel(85, "apiHealth");

    // Then "flaky-build" API health heat level is "red"
    expect(flakyBuild).toBe("red");
    // And "norbert" API health heat level is "neutral"
    expect(norbert).toBe("neutral");
  });
});

// ---------------------------------------------------------------------------
// REAL-TIME UPDATE
// ---------------------------------------------------------------------------

describe("Heat coloring adjusts when metrics update", () => {
  it("increasing cost transitions heat level from neutral to amber/red", () => {
    // Given session "norbert" cost was $0.10 (neutral heat level)
    const initial = computeHeatLevel(0.1, "cost");
    expect(initial).toBe("neutral");

    // When the cost increases to $3.00
    const updated = computeHeatLevel(3.0, "cost");

    // Then the heat level is "red" ($3.00 > $2.00 red threshold)
    expect(updated).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// ERROR PATHS
// ---------------------------------------------------------------------------

describe("Heat coloring handles zero and missing values", () => {
  it("zero values produce neutral heat level", () => {
    // Given session "idle" has cost 0, tokens 0, burn rate 0
    const columns: HeatColumnId[] = [
      "cost",
      "totalTokens",
      "burnRate",
      "contextPercent",
      "apiHealth",
    ];

    // When heat levels are computed for all columns
    // Then all heat levels are "neutral"
    for (const col of columns) {
      // For apiHealth, 0 means 0% success rate which is bad -- but test says
      // "zero and missing" => neutral. We treat 0 as a missing/no-data value.
      expect(computeHeatLevel(0, col)).toBe("neutral");
    }
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: Monotonicity
// ---------------------------------------------------------------------------

// @property
describe("Heat shade intensity never decreases as metric value increases", () => {
  it("for any two values a < b, heat(a) <= heat(b)", () => {
    const standardColumns: HeatColumnId[] = [
      "cost",
      "totalTokens",
      "burnRate",
      "contextPercent",
    ];

    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.constantFrom(...standardColumns),
        (a, b, column) => {
          const low = Math.min(a, b);
          const high = Math.max(a, b);
          const heatLow = computeHeatLevel(low, column);
          const heatHigh = computeHeatLevel(high, column);
          expect(HEAT_ORDINAL[heatLow]).toBeLessThanOrEqual(
            HEAT_ORDINAL[heatHigh],
          );
        },
      ),
      { numRuns: 500 },
    );
  });

  it("for apiHealth (inverted), higher success rate never produces higher heat", () => {
    // Exclude zero: zero is a "no data" sentinel tested separately in the
    // zero/missing scenario, not a valid success rate for monotonicity.
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        (a, b) => {
          const lowRate = Math.min(a, b);
          const highRate = Math.max(a, b);
          const heatLow = computeHeatLevel(lowRate, "apiHealth");
          const heatHigh = computeHeatLevel(highRate, "apiHealth");
          // Higher success rate => lower or equal heat
          expect(HEAT_ORDINAL[heatHigh]).toBeLessThanOrEqual(
            HEAT_ORDINAL[heatLow],
          );
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ---------------------------------------------------------------------------
// CSS CLASS MAPPING
// ---------------------------------------------------------------------------

describe("deriveHeatClass maps HeatLevel to CSS class string", () => {
  it("produces distinct CSS class for each heat level", () => {
    const neutralClass = deriveHeatClass("neutral");
    const amberClass = deriveHeatClass("amber");
    const redClass = deriveHeatClass("red");

    expect(neutralClass).toBe("heat-neutral");
    expect(amberClass).toBe("heat-amber");
    expect(redClass).toBe("heat-red");
  });
});

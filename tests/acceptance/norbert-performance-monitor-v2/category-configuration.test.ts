/**
 * Acceptance tests: Category Configuration (v2)
 *
 * Validates that the 4 metric categories are correctly defined with
 * distinct colors, Y-axis units, aggregate applicability, formatting
 * functions, stats config, and session table columns.
 *
 * Driving ports: categoryConfig module (METRIC_CATEGORIES const array)
 * These tests exercise the configuration data and formatting functions.
 *
 * Traces to: Design spec Section 1 "Metric Categories", ADR-009,
 * architecture-design.md "Category Configuration" section
 */

import { describe, it, expect } from "vitest";

// Driving port: categoryConfig (new v2 domain module)
// These imports will resolve once the module is implemented.
import {
  METRIC_CATEGORIES,
  getCategoryById,
  type MetricCategory,
  type MetricCategoryId,
} from "../../../src/plugins/norbert-usage/domain/categoryConfig";

// ---------------------------------------------------------------------------
// WALKING SKELETON: User sees 4 distinct metric categories in sidebar
// Traces to: Design spec Section 1, US-PM-001
// ---------------------------------------------------------------------------

describe("User sees four distinct metric categories for monitoring", () => {
  it("four categories are defined: tokens, cost, agents, latency", () => {
    // Given the performance monitor v2 category configuration
    // When the category list is loaded
    const categoryIds = METRIC_CATEGORIES.map((c) => c.id);

    // Then four categories exist
    expect(METRIC_CATEGORIES).toHaveLength(4);
    // And the categories are tokens, cost, agents, latency
    expect(categoryIds).toContain("tokens");
    expect(categoryIds).toContain("cost");
    expect(categoryIds).toContain("agents");
    expect(categoryIds).toContain("latency");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Category Labels and Colors
// Traces to: Design spec Section 1 "Metric Categories" table
// ---------------------------------------------------------------------------

describe("Each category has a distinct display label", () => {
  it("tokens category is labeled 'Tokens/s'", () => {
    // Given the tokens category configuration
    const tokens = getCategoryById("tokens");

    // When the label is read
    // Then the label is "Tokens/s"
    expect(tokens.label).toBe("Tokens/s");
  });

  it("cost category is labeled 'Cost'", () => {
    // Given the cost category configuration
    const cost = getCategoryById("cost");

    // When the label is read
    // Then the label is "Cost"
    expect(cost.label).toBe("Cost");
  });

  it("agents category is labeled 'Agents'", () => {
    // Given the agents category configuration
    const agents = getCategoryById("agents");

    // When the label is read
    // Then the label is "Agents"
    expect(agents.label).toBe("Agents");
  });

  it("latency category is labeled 'Latency'", () => {
    // Given the latency category configuration
    const latency = getCategoryById("latency");

    // When the label is read
    // Then the label is "Latency"
    expect(latency.label).toBe("Latency");
  });
});

describe("Each category has a distinct line color", () => {
  it("tokens uses brand cyan, cost uses amber, agents uses blue, latency uses muted teal", () => {
    // Given all four category configurations
    const tokens = getCategoryById("tokens");
    const cost = getCategoryById("cost");
    const agents = getCategoryById("agents");
    const latency = getCategoryById("latency");

    // When the line colors are read
    // Then tokens uses brand cyan (#00e5cc)
    expect(tokens.color).toBe("#00e5cc");
    // And cost uses amber (#f0920a)
    expect(cost.color).toBe("#f0920a");
    // And agents uses blue (#4a9eff)
    expect(agents.color).toBe("#4a9eff");
    // And latency uses muted teal (#7aa89e)
    expect(latency.color).toBe("#7aa89e");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Value Formatting
// Traces to: Design spec Section 1 sidebar current value display
// ---------------------------------------------------------------------------

describe("Token rate formatted with unit suffix", () => {
  it("rates below 1000 show integer with tok/s suffix", () => {
    // Given a token rate of 527 tok/s
    const tokens = getCategoryById("tokens");

    // When the value is formatted
    const formatted = tokens.formatValue(527);

    // Then it shows "527 tok/s"
    expect(formatted).toBe("527 tok/s");
  });

  it("rates above 1000 show k suffix with one decimal", () => {
    // Given a token rate of 1234 tok/s
    const tokens = getCategoryById("tokens");

    // When the value is formatted
    const formatted = tokens.formatValue(1234);

    // Then it shows "1.2k tok/s"
    expect(formatted).toBe("1.2k tok/s");
  });
});

describe("Cost rate formatted as dollars per minute", () => {
  it("cost rate shows currency with per-minute unit", () => {
    // Given a cost rate of 0.005 (dollars per second)
    const cost = getCategoryById("cost");

    // When the value is formatted
    const formatted = cost.formatValue(0.005);

    // Then it shows "$0.30/min"
    expect(formatted).toBe("$0.30/min");
  });

  it("zero cost rate shows $0.00/min", () => {
    // Given a cost rate of 0
    const cost = getCategoryById("cost");

    // When the value is formatted
    const formatted = cost.formatValue(0);

    // Then it shows "$0.00/min"
    expect(formatted).toBe("$0.00/min");
  });
});

describe("Agent count formatted as integer", () => {
  it("agent count shows integer value", () => {
    // Given 3 active agents
    const agents = getCategoryById("agents");

    // When the value is formatted
    const formatted = agents.formatValue(3);

    // Then it shows "3"
    expect(formatted).toBe("3");
  });
});

describe("Latency formatted with millisecond or second suffix", () => {
  it("latency shows milliseconds for values below 1000", () => {
    // Given latency at 423ms
    const latency = getCategoryById("latency");

    // When the value is formatted
    const formatted = latency.formatValue(423);

    // Then it shows "423ms"
    expect(formatted).toBe("423ms");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Aggregate Applicability (ADR-009)
// Traces to: ADR-009, Design spec Section 1 "Aggregate Graph Applicability"
// ---------------------------------------------------------------------------

describe("Tokens, cost, and agents support aggregate graphs", () => {
  it("tokens is aggregate-applicable with sum strategy", () => {
    // Given the tokens category
    const tokens = getCategoryById("tokens");

    // When aggregate applicability is checked
    // Then aggregate is applicable
    expect(tokens.aggregateApplicable).toBe(true);
    // And the strategy is sum
    expect(tokens.aggregateStrategy).toBe("sum");
  });

  it("cost is aggregate-applicable with sum strategy", () => {
    // Given the cost category
    const cost = getCategoryById("cost");

    // When aggregate applicability is checked
    // Then aggregate is applicable
    expect(cost.aggregateApplicable).toBe(true);
    expect(cost.aggregateStrategy).toBe("sum");
  });

  it("agents is aggregate-applicable with sum strategy", () => {
    // Given the agents category
    const agents = getCategoryById("agents");

    // When aggregate applicability is checked
    // Then aggregate is applicable
    expect(agents.aggregateApplicable).toBe(true);
    expect(agents.aggregateStrategy).toBe("sum");
  });
});

describe("Latency supports aggregate graph", () => {
  it("latency is aggregate-applicable with sum strategy", () => {
    // Given the latency category
    const latency = getCategoryById("latency");

    // When aggregate applicability is checked
    // Then aggregate is applicable
    expect(latency.aggregateApplicable).toBe(true);
    // And the strategy is sum
    expect(latency.aggregateStrategy).toBe("sum");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Stats Grid Configuration
// Traces to: Design spec Section 3 "Stats Grid"
// ---------------------------------------------------------------------------

describe("Each category defines 6 stats grid cells", () => {
  it("tokens stats include peak, sessions, average, total tokens, cost rate, tool calls", () => {
    // Given the tokens category
    const tokens = getCategoryById("tokens");

    // When the stats config is read
    const labels = tokens.statsConfig.map((s) => s.label);

    // Then 6 stat cells are defined
    expect(tokens.statsConfig).toHaveLength(6);
    // And they include the expected stats
    expect(labels).toContain("Peak");
    expect(labels).toContain("Sessions");
  });

  it("latency stats include current, sessions, peak, requests, average, model", () => {
    // Given the latency category
    const latency = getCategoryById("latency");

    // When the stats config is read
    const labels = latency.statsConfig.map((s) => s.label);

    // Then 6 stat cells are defined
    expect(latency.statsConfig).toHaveLength(6);
    // And they include latency-specific stats
    expect(labels).toContain("Current");
    expect(labels).toContain("Sessions");
    expect(labels).toContain("Peak");
    expect(labels).toContain("Requests");
    expect(labels).toContain("Average");
    expect(labels).toContain("Model");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Session Table Configuration
// Traces to: Design spec Section 4 "Per-Session Breakdown"
// ---------------------------------------------------------------------------

describe("Each category defines session table columns", () => {
  it("tokens category table has session ID, tokens/s, agents, cost columns", () => {
    // Given the tokens category
    const tokens = getCategoryById("tokens");

    // When the session columns are read
    // Then columns include the expected headers
    expect(tokens.sessionColumns).toEqual(["Session ID", "Tokens/s", "Agents", "Cost"]);
  });

  it("latency category table has session ID, latency, requests, model columns", () => {
    // Given the latency category
    const latency = getCategoryById("latency");

    // When the session columns are read
    // Then columns include the expected headers
    expect(latency.sessionColumns).toEqual(["Session ID", "Latency", "Requests", "Model"]);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Invalid Category Lookup
// ---------------------------------------------------------------------------

describe("Looking up a nonexistent category returns undefined", () => {
  it("unknown category ID returns undefined", () => {
    // Given an invalid category ID
    // When looking up the category
    const result = getCategoryById("nonexistent" as MetricCategoryId);

    // Then no category is returned
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Formatting Edge Cases
// ---------------------------------------------------------------------------

describe("Token rate formatter handles zero", () => {
  it("zero token rate formats as '0 tok/s'", () => {
    // Given zero token rate
    const tokens = getCategoryById("tokens");

    // When zero is formatted
    const formatted = tokens.formatValue(0);

    // Then it shows "0 tok/s"
    expect(formatted).toBe("0 tok/s");
  });
});

describe("Token rate formatter handles very large values", () => {
  it("rate of 15000 formats with k suffix", () => {
    // Given a very high token rate
    const tokens = getCategoryById("tokens");

    // When the large value is formatted
    const formatted = tokens.formatValue(15000);

    // Then it shows "15.0k tok/s"
    expect(formatted).toBe("15.0k tok/s");
  });
});

describe("Cost formatter handles very small rates", () => {
  it("very small cost rate shows extra decimal precision", () => {
    // Given a very small cost rate (Sonnet session)
    const cost = getCategoryById("cost");

    // When the tiny value is formatted
    const formatted = cost.formatValue(0.00001);

    // Then the formatting does not show "$0.00/min" (loses precision)
    expect(formatted).not.toBe("$0.00/min");
    // And it contains a meaningful value
    expect(formatted).toContain("$");
  });
});

describe("Latency formatter handles values at and above 1000ms", () => {
  it("latency at 2100ms shows seconds format", () => {
    // Given latency at 2100ms
    const latency = getCategoryById("latency");

    // When 2100 is formatted
    const formatted = latency.formatValue(2100);

    // Then it shows "2.1s"
    expect(formatted).toBe("2.1s");
  });
});

describe("Agent count formatter handles zero agents", () => {
  it("zero agents formats as '0'", () => {
    // Given zero active agents
    const agents = getCategoryById("agents");

    // When zero is formatted
    const formatted = agents.formatValue(0);

    // Then it shows "0"
    expect(formatted).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIOS
// Traces to: Architecture design "Maintainability" -- all categories unique
// ---------------------------------------------------------------------------

describe("@property: all categories have unique identifiers and colors", () => {
  it("no two categories share an ID or a line color", () => {
    // Given the full set of metric categories
    const ids = METRIC_CATEGORIES.map((c) => c.id);
    const colors = METRIC_CATEGORIES.map((c) => c.color);

    // When uniqueness is checked
    // Then all IDs are unique
    expect(new Set(ids).size).toBe(ids.length);
    // And all colors are unique
    expect(new Set(colors).size).toBe(colors.length);
  });
});

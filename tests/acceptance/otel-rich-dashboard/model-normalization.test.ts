/**
 * Acceptance tests: Model Name Normalization (US-008)
 *
 * Validates that model names with context window suffixes (e.g., "[1m]")
 * are stripped at ingestion so metrics and events aggregate under the
 * same model identity.
 *
 * Driving ports: model name normalizer (pure function)
 *
 * Traces to: US-008 acceptance criteria
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// PLACEHOLDER: imports will target production driving ports once implemented
// ---------------------------------------------------------------------------
// import {
//   normalizeModelName,
// } from "../../../src-tauri/bindings/modelNormalizer";

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Happy Path
// ---------------------------------------------------------------------------

describe("Model name normalization strips context window suffixes", () => {
  it.skip("model name with context window suffix is normalized", () => {
    // Given a cost metric arrives with model "claude-opus-4-6[1m]"
    // When the model name is normalized
    // Then the stored model name is "claude-opus-4-6"
  });

  it.skip("model name without suffix passes through unchanged", () => {
    // Given a cost metric arrives with model "claude-opus-4-6"
    // When the model name is normalized
    // Then the stored model name remains "claude-opus-4-6"
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED: Roundtrip consistency
// ---------------------------------------------------------------------------

describe("Model normalization consistency", () => {
  // @property
  it.skip("normalized model names from metrics match event model names", () => {
    // Given any metric with a model attribute containing a bracket suffix
    // When the suffix is stripped
    // Then the resulting name matches the model name used in log events
  });
});

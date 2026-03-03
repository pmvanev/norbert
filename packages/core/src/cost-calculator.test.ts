/**
 * Unit tests for cost calculator -- pure function: tokens + model -> cost estimate.
 *
 * Property-based: cost is always >= 0 and monotonically increasing with tokens.
 * Example-based: known model rates produce expected costs.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { estimateCost } from './cost-calculator.js';

describe('estimateCost', () => {
  // Property: cost is always non-negative for non-negative token counts
  it('always produces non-negative cost', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000 }),
        fc.nat({ max: 1_000_000 }),
        fc.constantFrom('claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3.5', 'unknown-model'),
        (inputTokens, outputTokens, model) => {
          const cost = estimateCost(inputTokens, outputTokens, model);
          expect(cost).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property: more tokens implies greater or equal cost
  it('monotonically increases with more input tokens', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 500_000 }),
        fc.nat({ max: 500_000 }),
        fc.nat({ max: 500_000 }),
        fc.constantFrom('claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3.5'),
        (inputTokens, extraTokens, outputTokens, model) => {
          const costLow = estimateCost(inputTokens, outputTokens, model);
          const costHigh = estimateCost(inputTokens + extraTokens, outputTokens, model);
          expect(costHigh).toBeGreaterThanOrEqual(costLow);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Example: known model rate computation
  it('computes correct cost for claude-sonnet-4', () => {
    // 1M input tokens @ $3/M + 1M output tokens @ $15/M = $18
    const cost = estimateCost(1_000_000, 1_000_000, 'claude-sonnet-4');
    expect(cost).toBeCloseTo(18.0, 2);
  });

  it('computes correct cost for claude-opus-4', () => {
    // 1M input @ $15/M + 1M output @ $75/M = $90
    const cost = estimateCost(1_000_000, 1_000_000, 'claude-opus-4');
    expect(cost).toBeCloseTo(90.0, 2);
  });

  it('uses default rate for unknown models', () => {
    // Default: $3/M input + $15/M output (same as sonnet-4)
    const cost = estimateCost(1_000_000, 1_000_000, 'unknown-future-model');
    expect(cost).toBeCloseTo(18.0, 2);
  });

  it('returns 0 for zero tokens', () => {
    const cost = estimateCost(0, 0, 'claude-sonnet-4');
    expect(cost).toBe(0);
  });
});

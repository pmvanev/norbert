/**
 * Unit tests for session comparator -- pure comparison logic.
 *
 * Step: 05-01
 * Story: US-007
 *
 * Tests the compareSessions pure function which computes:
 *   - Deltas for tokens, cost, agents, errors, duration
 *   - Change percentages (handling division by zero)
 *   - Agent comparisons: new, removed, unchanged
 *   - Projected monthly savings from cost delta
 */

import { describe, it, expect } from 'vitest';
import type { Session } from './session.js';
import type { AgentNode } from './trace.js';
import { compareSessions } from './session-comparator.js';

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  startTime: '2026-03-01T10:00:00.000Z',
  endTime: '2026-03-01T10:10:00.000Z',
  model: 'claude-sonnet-4',
  agentCount: 2,
  eventCount: 10,
  totalInputTokens: 5000,
  totalOutputTokens: 2500,
  estimatedCost: 0.0525,
  mcpErrorCount: 1,
  status: 'completed',
  ...overrides,
});

const makeAgent = (overrides: Partial<AgentNode> = {}): AgentNode => ({
  agentId: 'agent-1',
  parentAgentId: undefined,
  toolCallCount: 3,
  inputTokens: 2000,
  outputTokens: 1000,
  estimatedCost: 0.021,
  status: 'completed',
  children: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Deltas
// ---------------------------------------------------------------------------

describe('compareSessions', () => {
  describe('deltas', () => {
    it('computes token delta as current minus previous total tokens', () => {
      const previous = makeSession({ totalInputTokens: 5000, totalOutputTokens: 2500 });
      const current = makeSession({ id: 'session-2', totalInputTokens: 3000, totalOutputTokens: 1500 });

      const result = compareSessions(previous, current, [], []);

      // Current total = 4500, Previous total = 7500, delta = -3000
      expect(result.deltas.tokensDelta).toBe(-3000);
    });

    it('computes cost delta as current minus previous', () => {
      const previous = makeSession({ estimatedCost: 0.10 });
      const current = makeSession({ id: 'session-2', estimatedCost: 0.06 });

      const result = compareSessions(previous, current, [], []);

      expect(result.deltas.costDelta).toBeCloseTo(-0.04, 5);
    });

    it('computes agent count delta as current minus previous', () => {
      const previous = makeSession({ agentCount: 3 });
      const current = makeSession({ id: 'session-2', agentCount: 5 });

      const result = compareSessions(previous, current, [], []);

      expect(result.deltas.agentCountDelta).toBe(2);
    });

    it('computes error count delta as current minus previous', () => {
      const previous = makeSession({ mcpErrorCount: 5 });
      const current = makeSession({ id: 'session-2', mcpErrorCount: 2 });

      const result = compareSessions(previous, current, [], []);

      expect(result.deltas.errorCountDelta).toBe(-3);
    });
  });

  // ---------------------------------------------------------------------------
  // Change percentages
  // ---------------------------------------------------------------------------

  describe('change percentages', () => {
    it('computes percentage change for tokens', () => {
      const previous = makeSession({ totalInputTokens: 4000, totalOutputTokens: 1000 });
      const current = makeSession({ id: 'session-2', totalInputTokens: 3000, totalOutputTokens: 2000 });

      const result = compareSessions(previous, current, [], []);

      // Previous total = 5000, Current total = 5000, change = 0%
      expect(result.changePercents.tokens).toBe(0);
    });

    it('computes percentage change for cost', () => {
      const previous = makeSession({ estimatedCost: 0.10 });
      const current = makeSession({ id: 'session-2', estimatedCost: 0.05 });

      const result = compareSessions(previous, current, [], []);

      // (0.05 - 0.10) / 0.10 * 100 = -50%
      expect(result.changePercents.cost).toBeCloseTo(-50, 1);
    });

    it('returns 0 percent change when previous value is zero (division by zero)', () => {
      const previous = makeSession({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        estimatedCost: 0,
        agentCount: 0,
        mcpErrorCount: 0,
      });
      const current = makeSession({
        id: 'session-2',
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        estimatedCost: 0.05,
        agentCount: 2,
        mcpErrorCount: 1,
      });

      const result = compareSessions(previous, current, [], []);

      expect(result.changePercents.tokens).toBe(0);
      expect(result.changePercents.cost).toBe(0);
      expect(result.changePercents.agents).toBe(0);
      expect(result.changePercents.errors).toBe(0);
    });

    it('computes duration change percentage', () => {
      const previous = makeSession({
        startTime: '2026-03-01T10:00:00.000Z',
        endTime: '2026-03-01T10:10:00.000Z', // 10 minutes
      });
      const current = makeSession({
        id: 'session-2',
        startTime: '2026-03-02T10:00:00.000Z',
        endTime: '2026-03-02T10:05:00.000Z', // 5 minutes
      });

      const result = compareSessions(previous, current, [], []);

      // (5 - 10) / 10 * 100 = -50%
      expect(result.changePercents.duration).toBeCloseTo(-50, 1);
    });

    it('returns 0 duration change percent when sessions have no end time', () => {
      const previous = makeSession({ endTime: undefined });
      const current = makeSession({ id: 'session-2', endTime: undefined });

      const result = compareSessions(previous, current, [], []);

      expect(result.changePercents.duration).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Agent comparisons
  // ---------------------------------------------------------------------------

  describe('agent comparisons', () => {
    it('labels agents present in both sessions as unchanged', () => {
      const prevAgent = makeAgent({ agentId: 'agent-alpha', estimatedCost: 0.05 });
      const curAgent = makeAgent({ agentId: 'agent-alpha', estimatedCost: 0.03 });

      const result = compareSessions(
        makeSession(),
        makeSession({ id: 'session-2' }),
        [prevAgent],
        [curAgent]
      );

      const alpha = result.agentComparisons.find(a => a.agentId === 'agent-alpha');
      expect(alpha).toBeDefined();
      expect(alpha!.status).toBe('unchanged');
      expect(alpha!.previousCost).toBe(0.05);
      expect(alpha!.currentCost).toBe(0.03);
      expect(alpha!.costDelta).toBeCloseTo(-0.02, 5);
    });

    it('labels agents only in previous session as removed', () => {
      const prevAgent = makeAgent({ agentId: 'agent-beta', estimatedCost: 0.04 });

      const result = compareSessions(
        makeSession(),
        makeSession({ id: 'session-2' }),
        [prevAgent],
        []
      );

      const beta = result.agentComparisons.find(a => a.agentId === 'agent-beta');
      expect(beta).toBeDefined();
      expect(beta!.status).toBe('removed');
      expect(beta!.previousCost).toBe(0.04);
      expect(beta!.currentCost).toBe(0);
    });

    it('labels agents only in current session as new', () => {
      const curAgent = makeAgent({ agentId: 'agent-gamma', estimatedCost: 0.02 });

      const result = compareSessions(
        makeSession(),
        makeSession({ id: 'session-2' }),
        [],
        [curAgent]
      );

      const gamma = result.agentComparisons.find(a => a.agentId === 'agent-gamma');
      expect(gamma).toBeDefined();
      expect(gamma!.status).toBe('new');
      expect(gamma!.previousCost).toBe(0);
      expect(gamma!.currentCost).toBe(0.02);
    });

    it('computes cost change percent for agent comparison with zero previous cost', () => {
      const curAgent = makeAgent({ agentId: 'agent-new', estimatedCost: 0.05 });

      const result = compareSessions(
        makeSession(),
        makeSession({ id: 'session-2' }),
        [],
        [curAgent]
      );

      const newAgent = result.agentComparisons.find(a => a.agentId === 'agent-new');
      expect(newAgent).toBeDefined();
      expect(newAgent!.costChangePercent).toBe(0); // division by zero guarded
    });
  });

  // ---------------------------------------------------------------------------
  // Projected monthly savings
  // ---------------------------------------------------------------------------

  describe('projected monthly savings', () => {
    it('computes positive savings when cost decreased', () => {
      const previous = makeSession({ estimatedCost: 0.10 });
      const current = makeSession({ id: 'session-2', estimatedCost: 0.06 });

      const result = compareSessions(previous, current, [], []);

      // Cost delta = -0.04, savings = 0.04 * 20 working days * estimated sessions/day
      expect(result.projectedMonthlySavings).toBeGreaterThan(0);
    });

    it('computes zero or negative savings when cost increased', () => {
      const previous = makeSession({ estimatedCost: 0.05 });
      const current = makeSession({ id: 'session-2', estimatedCost: 0.10 });

      const result = compareSessions(previous, current, [], []);

      expect(result.projectedMonthlySavings).toBeLessThanOrEqual(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Return shape
  // ---------------------------------------------------------------------------

  describe('return shape', () => {
    it('includes both session objects in the result', () => {
      const previous = makeSession({ id: 'prev-id' });
      const current = makeSession({ id: 'curr-id' });

      const result = compareSessions(previous, current, [], []);

      expect(result.previousSession).toEqual(previous);
      expect(result.currentSession).toEqual(current);
    });
  });
});

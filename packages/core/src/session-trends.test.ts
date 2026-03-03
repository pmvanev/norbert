/**
 * Tests for session trends pure functions:
 *   - computeDailyTrends: group sessions by date, aggregate counts/tokens/cost
 *   - computeBaselines: average cost, P95 cost, average duration, confidence
 *   - sessionsToCsv: format sessions as CSV string
 *
 * Story: US-008
 * Step: 05-02
 *
 * Property-based tests for domain invariants.
 * Example-based tests for specific scenarios.
 */

import { describe, it, expect } from 'vitest';
import type { Session } from './session.js';
import {
  computeDailyTrends,
  computeBaselines,
  computeTrendAnalysis,
  sessionsToCsv,
} from './session-trends.js';

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: overrides.id ?? 'session-1',
  startTime: overrides.startTime ?? '2026-03-01T10:00:00.000Z',
  endTime: 'endTime' in overrides ? overrides.endTime : '2026-03-01T10:30:00.000Z',
  model: overrides.model ?? 'claude-sonnet-4',
  agentCount: overrides.agentCount ?? 1,
  eventCount: overrides.eventCount ?? 5,
  totalInputTokens: overrides.totalInputTokens ?? 1000,
  totalOutputTokens: overrides.totalOutputTokens ?? 500,
  estimatedCost: overrides.estimatedCost ?? 0.012,
  mcpErrorCount: overrides.mcpErrorCount ?? 0,
  status: overrides.status ?? 'completed',
});

// ---------------------------------------------------------------------------
// computeDailyTrends
// ---------------------------------------------------------------------------

describe('computeDailyTrends', () => {
  it('returns empty array for empty sessions', () => {
    const trends = computeDailyTrends([]);
    expect(trends).toEqual([]);
  });

  it('groups sessions by date and aggregates counts, tokens, and cost', () => {
    const sessions: readonly Session[] = [
      makeSession({
        id: 'a',
        startTime: '2026-03-01T10:00:00.000Z',
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        estimatedCost: 0.01,
      }),
      makeSession({
        id: 'b',
        startTime: '2026-03-01T14:00:00.000Z',
        totalInputTokens: 2000,
        totalOutputTokens: 800,
        estimatedCost: 0.02,
      }),
      makeSession({
        id: 'c',
        startTime: '2026-03-02T09:00:00.000Z',
        totalInputTokens: 500,
        totalOutputTokens: 200,
        estimatedCost: 0.005,
      }),
    ];

    const trends = computeDailyTrends(sessions);

    expect(trends).toHaveLength(2);

    // First day: 2 sessions
    const day1 = trends.find(t => t.date === '2026-03-01');
    expect(day1).toBeDefined();
    expect(day1!.sessionCount).toBe(2);
    expect(day1!.totalTokens).toBe(1000 + 500 + 2000 + 800);
    expect(day1!.totalCost).toBeCloseTo(0.03, 6);

    // Second day: 1 session
    const day2 = trends.find(t => t.date === '2026-03-02');
    expect(day2).toBeDefined();
    expect(day2!.sessionCount).toBe(1);
    expect(day2!.totalTokens).toBe(500 + 200);
    expect(day2!.totalCost).toBeCloseTo(0.005, 6);
  });

  it('sorts trends by date ascending', () => {
    const sessions: readonly Session[] = [
      makeSession({ id: 'z', startTime: '2026-03-05T10:00:00.000Z' }),
      makeSession({ id: 'a', startTime: '2026-03-01T10:00:00.000Z' }),
      makeSession({ id: 'm', startTime: '2026-03-03T10:00:00.000Z' }),
    ];

    const trends = computeDailyTrends(sessions);
    expect(trends.map(t => t.date)).toEqual(['2026-03-01', '2026-03-03', '2026-03-05']);
  });
});

// ---------------------------------------------------------------------------
// computeBaselines
// ---------------------------------------------------------------------------

describe('computeBaselines', () => {
  it('returns zero baselines for empty sessions', () => {
    const baselines = computeBaselines([]);
    expect(baselines.averageCost).toBe(0);
    expect(baselines.p95Cost).toBe(0);
    expect(baselines.averageDuration).toBe(0);
    expect(baselines.sampleSize).toBe(0);
    expect(baselines.isConfident).toBe(false);
    expect(baselines.confidenceNote).toBeDefined();
  });

  it('computes average cost across sessions', () => {
    const sessions: readonly Session[] = [
      makeSession({ estimatedCost: 0.10 }),
      makeSession({ estimatedCost: 0.20 }),
      makeSession({ estimatedCost: 0.30 }),
    ];

    const baselines = computeBaselines(sessions);
    expect(baselines.averageCost).toBeCloseTo(0.20, 6);
  });

  it('computes P95 cost using nearest-rank method', () => {
    // 20 sessions with costs 1..20
    const sessions: readonly Session[] = Array.from({ length: 20 }, (_, i) =>
      makeSession({ id: `s-${i}`, estimatedCost: i + 1 })
    );

    const baselines = computeBaselines(sessions);
    // P95 of [1..20]: 95th percentile index = ceil(0.95 * 20) = 19 => value 19
    expect(baselines.p95Cost).toBe(19);
  });

  it('computes average duration in seconds from start/end times', () => {
    const sessions: readonly Session[] = [
      makeSession({
        id: 'dur-1',
        startTime: '2026-03-01T10:00:00.000Z',
        endTime: '2026-03-01T10:10:00.000Z', // 600s
      }),
      makeSession({
        id: 'dur-2',
        startTime: '2026-03-01T11:00:00.000Z',
        endTime: '2026-03-01T11:20:00.000Z', // 1200s
      }),
    ];

    const baselines = computeBaselines(sessions);
    expect(baselines.averageDuration).toBe(900); // (600 + 1200) / 2
  });

  it('skips sessions with undefined endTime for duration calculation', () => {
    const sessions: readonly Session[] = [
      makeSession({
        id: 'dur-with',
        startTime: '2026-03-01T10:00:00.000Z',
        endTime: '2026-03-01T10:10:00.000Z', // 600s
      }),
      makeSession({
        id: 'dur-without',
        startTime: '2026-03-01T11:00:00.000Z',
        endTime: undefined, // active session, no duration
      }),
    ];

    const baselines = computeBaselines(sessions);
    // Only one completed session with 600s
    expect(baselines.averageDuration).toBe(600);
  });

  it('marks baselines as not confident when fewer than 10 sessions', () => {
    const sessions: readonly Session[] = [
      makeSession({ id: 's-1' }),
      makeSession({ id: 's-2' }),
      makeSession({ id: 's-3' }),
    ];

    const baselines = computeBaselines(sessions);
    expect(baselines.isConfident).toBe(false);
    expect(baselines.confidenceNote).toBeDefined();
    expect(baselines.confidenceNote!.length).toBeGreaterThan(0);
  });

  it('marks baselines as confident when 10 or more sessions', () => {
    const sessions: readonly Session[] = Array.from({ length: 10 }, (_, i) =>
      makeSession({ id: `s-${i}` })
    );

    const baselines = computeBaselines(sessions);
    expect(baselines.isConfident).toBe(true);
    expect(baselines.confidenceNote).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computeTrendAnalysis
// ---------------------------------------------------------------------------

describe('computeTrendAnalysis', () => {
  it('composes daily trends and baselines', () => {
    const sessions: readonly Session[] = [
      makeSession({ id: 'a', startTime: '2026-03-01T10:00:00.000Z' }),
      makeSession({ id: 'b', startTime: '2026-03-02T10:00:00.000Z' }),
    ];

    const analysis = computeTrendAnalysis(sessions);

    expect(analysis.dailyTrends).toHaveLength(2);
    expect(analysis.baselines).toBeDefined();
    expect(analysis.baselines.sampleSize).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// sessionsToCsv
// ---------------------------------------------------------------------------

describe('sessionsToCsv', () => {
  it('returns header-only CSV for empty sessions', () => {
    const csv = sessionsToCsv([]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('date');
    expect(lines[0]).toContain('sessions');
    expect(lines[0]).toContain('tokens');
    expect(lines[0]).toContain('cost');
  });

  it('aggregates sessions per day into CSV rows', () => {
    const sessions: readonly Session[] = [
      makeSession({
        id: 'csv-a',
        startTime: '2026-03-01T10:00:00.000Z',
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        estimatedCost: 0.01,
      }),
      makeSession({
        id: 'csv-b',
        startTime: '2026-03-01T14:00:00.000Z',
        totalInputTokens: 2000,
        totalOutputTokens: 800,
        estimatedCost: 0.02,
      }),
      makeSession({
        id: 'csv-c',
        startTime: '2026-03-02T09:00:00.000Z',
        totalInputTokens: 500,
        totalOutputTokens: 200,
        estimatedCost: 0.005,
      }),
    ];

    const csv = sessionsToCsv(sessions);
    const lines = csv.trim().split('\n');

    // header + 2 days
    expect(lines).toHaveLength(3);

    // First data row: 2026-03-01, 2 sessions, 4300 tokens, 0.03 cost
    expect(lines[1]).toContain('2026-03-01');
    expect(lines[1]).toContain('2');
    expect(lines[1]).toContain('4300');
  });

  it('produces valid CSV with no unescaped commas in values', () => {
    const sessions: readonly Session[] = [
      makeSession({
        id: 'csv-val',
        startTime: '2026-03-01T10:00:00.000Z',
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        estimatedCost: 0.01,
      }),
    ];

    const csv = sessionsToCsv(sessions);
    const lines = csv.trim().split('\n');

    // Each line should have same number of commas as the header
    const headerCommaCount = (lines[0].match(/,/g) ?? []).length;
    for (const line of lines.slice(1)) {
      const dataCommaCount = (line.match(/,/g) ?? []).length;
      expect(dataCommaCount).toBe(headerCommaCount);
    }
  });
});

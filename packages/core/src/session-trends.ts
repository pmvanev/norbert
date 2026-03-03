/**
 * Session trends -- pure functions for trend analysis, baselines, and CSV export.
 *
 * Computes daily trends, baselines (average cost, P95 cost, average duration),
 * and confidence indicators from session data. All functions are pure.
 *
 * Step: 05-02
 * Story: US-008
 */

import type { Session } from './session.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyTrend {
  readonly date: string;          // YYYY-MM-DD
  readonly sessionCount: number;
  readonly totalTokens: number;
  readonly totalCost: number;
}

export interface SessionBaselines {
  readonly averageCost: number;
  readonly p95Cost: number;
  readonly averageDuration: number;  // in seconds
  readonly sampleSize: number;
  readonly isConfident: boolean;     // false if < 10 sessions
  readonly confidenceNote: string | undefined;
}

export interface TrendAnalysis {
  readonly dailyTrends: readonly DailyTrend[];
  readonly baselines: SessionBaselines;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum session count to consider baselines statistically confident. */
const CONFIDENCE_THRESHOLD = 10;

const INSUFFICIENT_DATA_NOTE =
  'Preliminary baselines based on limited data. Collect at least 10 sessions for confident estimates.';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Extract YYYY-MM-DD from an ISO timestamp. */
const extractDate = (timestamp: string): string => timestamp.slice(0, 10);

/** Compute duration in seconds between two ISO timestamps. */
const computeDurationSeconds = (startTime: string, endTime: string): number => {
  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  return durationMs / 1000;
};

/**
 * Compute P95 cost using the nearest-rank method.
 *
 * Sorts costs ascending, then picks the value at index ceil(0.95 * n) - 1.
 * Returns 0 for empty input.
 */
const computeP95 = (costs: readonly number[]): number => {
  if (costs.length === 0) return 0;

  const sorted = [...costs].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[index];
};

// ---------------------------------------------------------------------------
// Public API: computeDailyTrends
// ---------------------------------------------------------------------------

/**
 * Group sessions by date and aggregate session count, total tokens, and total cost.
 *
 * Returns trends sorted by date ascending.
 */
export const computeDailyTrends = (sessions: readonly Session[]): readonly DailyTrend[] => {
  if (sessions.length === 0) return [];

  const byDate = new Map<string, { sessionCount: number; totalTokens: number; totalCost: number }>();

  for (const session of sessions) {
    const date = extractDate(session.startTime);
    const existing = byDate.get(date) ?? { sessionCount: 0, totalTokens: 0, totalCost: 0 };
    byDate.set(date, {
      sessionCount: existing.sessionCount + 1,
      totalTokens: existing.totalTokens + session.totalInputTokens + session.totalOutputTokens,
      totalCost: existing.totalCost + session.estimatedCost,
    });
  }

  return [...byDate.entries()]
    .map(([date, aggregate]) => ({
      date,
      sessionCount: aggregate.sessionCount,
      totalTokens: aggregate.totalTokens,
      totalCost: aggregate.totalCost,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// ---------------------------------------------------------------------------
// Public API: computeBaselines
// ---------------------------------------------------------------------------

/**
 * Compute session baselines: average cost, P95 cost, average duration, confidence.
 *
 * Sessions without an endTime are excluded from duration calculations.
 * Fewer than CONFIDENCE_THRESHOLD sessions triggers a confidence note.
 */
export const computeBaselines = (sessions: readonly Session[]): SessionBaselines => {
  const sampleSize = sessions.length;

  if (sampleSize === 0) {
    return {
      averageCost: 0,
      p95Cost: 0,
      averageDuration: 0,
      sampleSize: 0,
      isConfident: false,
      confidenceNote: INSUFFICIENT_DATA_NOTE,
    };
  }

  const costs = sessions.map(s => s.estimatedCost);
  const averageCost = costs.reduce((sum, c) => sum + c, 0) / sampleSize;
  const p95Cost = computeP95(costs);

  // Duration: only completed sessions (with endTime)
  const completedSessions = sessions.filter(s => s.endTime !== undefined);
  const durations = completedSessions.map(s =>
    computeDurationSeconds(s.startTime, s.endTime!)
  );
  const averageDuration =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

  const isConfident = sampleSize >= CONFIDENCE_THRESHOLD;

  return {
    averageCost,
    p95Cost,
    averageDuration,
    sampleSize,
    isConfident,
    confidenceNote: isConfident ? undefined : INSUFFICIENT_DATA_NOTE,
  };
};

// ---------------------------------------------------------------------------
// Public API: computeTrendAnalysis
// ---------------------------------------------------------------------------

/**
 * Compose daily trends and baselines into a single trend analysis.
 */
export const computeTrendAnalysis = (sessions: readonly Session[]): TrendAnalysis => ({
  dailyTrends: computeDailyTrends(sessions),
  baselines: computeBaselines(sessions),
});

// ---------------------------------------------------------------------------
// Public API: sessionsToCsv
// ---------------------------------------------------------------------------

/**
 * Format sessions as a CSV string with daily aggregation.
 *
 * Headers: date, sessions, tokens, cost
 * One row per distinct date, sorted by date ascending.
 */
export const sessionsToCsv = (sessions: readonly Session[]): string => {
  const header = 'date,sessions,tokens,cost';
  const trends = computeDailyTrends(sessions);

  const rows = trends.map(trend =>
    `${trend.date},${trend.sessionCount},${trend.totalTokens},${trend.totalCost}`
  );

  return [header, ...rows].join('\n');
};

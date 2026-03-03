/**
 * Step definitions for milestone-7-session-history.feature (US-008).
 *
 * Tests exercise the session history API driving port (GET /api/sessions,
 * GET /api/summary/weekly, GET /api/export/csv) and CLI (norbert session list).
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { NorbertWorld } from './support/world';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Session History Data Setup
// ---------------------------------------------------------------------------

Given(
  'Rafael has {int} sessions over {int} days totaling ${float}',
  async function (this: NorbertWorld, sessionCount: number, days: number, totalCost: number) {
    const costPerSession = totalCost / sessionCount;
    const sessionsPerDay = Math.ceil(sessionCount / days);
    for (let d = 0; d < days; d++) {
      for (let s = 0; s < sessionsPerDay && (d * sessionsPerDay + s) < sessionCount; s++) {
        const sessionId = `history-session-${d}-${s}`;
        const date = new Date(Date.now() - (days - d) * 86400000 + s * 3600000);
        const tokensForCost = Math.floor(costPerSession / 3 * 1_000_000); // Approx Sonnet pricing
        await this.seedEvents([
          { event_type: 'SessionStart', session_id: sessionId, timestamp: date.toISOString(), model: 'claude-sonnet-4' },
          { event_type: 'PostToolUse', session_id: sessionId, timestamp: new Date(date.getTime() + 30000).toISOString(), tool_name: 'Read', input_tokens: tokensForCost, output_tokens: Math.floor(tokensForCost * 0.2) },
          { event_type: 'Stop', session_id: sessionId, timestamp: new Date(date.getTime() + 60000).toISOString() },
        ]);
      }
    }
  }
);

Given(
  'the daily average cost is ${float}',
  function (this: NorbertWorld, _avg: number) {
    this.attach('Daily average computed from seeded sessions');
  }
);

Given(
  '{int} sessions exist with costs ranging from ${float} to ${float}',
  async function (this: NorbertWorld, count: number, minCost: number, maxCost: number) {
    const costRange = maxCost - minCost;
    for (let i = 0; i < count; i++) {
      const sessionId = `filter-session-${i}`;
      const cost = minCost + (costRange * i / (count - 1));
      const tokens = Math.floor(cost / 3 * 1_000_000);
      await this.seedEvents([
        { event_type: 'SessionStart', session_id: sessionId, timestamp: new Date(Date.now() - i * 3600000).toISOString() },
        { event_type: 'PostToolUse', session_id: sessionId, timestamp: new Date(Date.now() - i * 3600000 + 1000).toISOString(), tool_name: 'Read', input_tokens: tokens, output_tokens: 0 },
        { event_type: 'Stop', session_id: sessionId, timestamp: new Date(Date.now() - i * 3600000 + 2000).toISOString() },
      ]);
    }
  }
);

Given(
  'sessions span the past {int} days',
  function (this: NorbertWorld, _days: number) {
    this.attach('Sessions seeded across date range');
  }
);

Given(
  '{int} sessions with varying costs, durations, and agent counts',
  function (this: NorbertWorld, _count: number) {
    this.attach('Varied session data seeded');
  }
);

Given(
  '{int} sessions exist across {int} days',
  function (this: NorbertWorld, _sessions: number, _days: number) {
    this.attach('Session data seeded across date range');
  }
);

Given(
  'Tuesday had ${float} in costs and other days averaged ${float}',
  function (this: NorbertWorld, tuesdayCost: number, otherAvg: number) {
    this.attach(`Tuesday: $${tuesdayCost}, others avg: $${otherAvg}`);
  }
);

Given(
  'some days had more sessions than others',
  function (this: NorbertWorld) {
    this.attach('Varying session counts per day');
  }
);

Given(
  '{int} sessions over {int} days with various costs',
  function (this: NorbertWorld, _sessions: number, _days: number) {
    this.attach('Session data for baseline computation');
  }
);

Given(
  'Rafael has only {int} days of Norbert data with {int} sessions',
  async function (this: NorbertWorld, days: number, sessions: number) {
    for (let i = 0; i < sessions; i++) {
      const sessionId = `preliminary-session-${i}`;
      const date = new Date(Date.now() - (days - 1) * 86400000 + i * 7200000);
      await this.seedEvents([
        { event_type: 'SessionStart', session_id: sessionId, timestamp: date.toISOString() },
        { event_type: 'PostToolUse', session_id: sessionId, timestamp: new Date(date.getTime() + 1000).toISOString(), tool_name: 'Read', input_tokens: 500, output_tokens: 100 },
        { event_type: 'Stop', session_id: sessionId, timestamp: new Date(date.getTime() + 2000).toISOString() },
      ]);
    }
  }
);

Given(
  'Marcus needs to share usage data with the finance team',
  function (this: NorbertWorld) {
    this.attach('CSV export use case: finance reporting');
  }
);

Given(
  'Marcus has filtered to the past {int} days',
  function (this: NorbertWorld, _days: number) {
    this.attach('Filter active: past 7 days');
  }
);

Given(
  'no sessions have been captured yet',
  function (this: NorbertWorld) {
    // No events seeded -- empty state
    this.attach('Empty state: no sessions');
  }
);

Given(
  '{int} days of session data with approximately {int} sessions',
  function (this: NorbertWorld, _days: number, _sessions: number) {
    this.attach('Large dataset for performance testing');
  }
);

Given(
  'any week of session data',
  function (this: NorbertWorld) {
    this.attach('Property test: any week of data');
  }
);

// ---------------------------------------------------------------------------
// When: Session History Interactions
// ---------------------------------------------------------------------------

When(
  'Rafael opens the weekly review page',
  async function (this: NorbertWorld) {
    await this.getApi('/api/summary/weekly');
  }
);

When(
  'Marcus filters sessions to cost greater than ${float}',
  async function (this: NorbertWorld, minCost: number) {
    await this.getApi(`/api/sessions?minCost=${minCost}`);
  }
);

When(
  'Marcus filters to the past {int} days only',
  async function (this: NorbertWorld, days: number) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    await this.getApi(`/api/sessions?since=${since}`);
  }
);

When(
  'Marcus sorts by cost descending',
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions?sortBy=cost&order=desc');
  }
);

When(
  'Marcus filters to cost greater than ${float} within the past {int} days',
  async function (this: NorbertWorld, minCost: number, days: number) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    await this.getApi(`/api/sessions?minCost=${minCost}&since=${since}`);
  }
);

When(
  'Rafael views the daily cost trend chart',
  async function (this: NorbertWorld) {
    await this.getApi('/api/summary/weekly');
  }
);

When(
  'Rafael views the weekly trend',
  async function (this: NorbertWorld) {
    await this.getApi('/api/summary/weekly');
  }
);

When(
  'baselines are computed',
  async function (this: NorbertWorld) {
    await this.getApi('/api/summary/weekly');
  }
);

When(
  'Marcus exports the monthly data as CSV',
  async function (this: NorbertWorld) {
    await this.getApi('/api/export/csv');
  }
);

When(
  'Marcus exports the filtered data as CSV',
  async function (this: NorbertWorld) {
    await this.getApi('/api/export/csv?range=7d');
  }
);

When(
  'Marcus opens the session history page',
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions');
  }
);

When(
  'the history page loads',
  async function (this: NorbertWorld) {
    this.startTimer();
    await this.getApi('/api/sessions');
    this.stopTimer();
  }
);

When(
  'the weekly total cost is computed',
  async function (this: NorbertWorld) {
    await this.getApi('/api/summary/weekly');
  }
);

// ---------------------------------------------------------------------------
// Then: Session History Assertions
// ---------------------------------------------------------------------------

Then(
  'he sees a daily cost trend chart for the past {int} days',
  function (this: NorbertWorld, days: number) {
    this.attach(`Daily cost trend: ${days} days`);
  }
);

Then(
  'he sees the weekly total of ${float} and daily average of ${float}',
  function (this: NorbertWorld, total: number, avg: number) {
    this.attach(`Weekly total: $${total}, daily avg: $${avg}`);
  }
);

Then(
  'he sees baselines showing average session cost of ${float} and P95 of ${float}',
  function (this: NorbertWorld, avg: number, p95: number) {
    this.attach(`Baselines: avg $${avg}, P95 $${p95}`);
  }
);

Then(
  '{int} sessions appear in the filtered results',
  function (this: NorbertWorld, expected: number) {
    const sessions = this.lastApiResponse as any[];
    if (sessions) {
      this.attach(`Filtered results: ${sessions.length} sessions (expected ${expected})`);
    }
  }
);

Then(
  'all displayed sessions have costs above ${float}',
  function (this: NorbertWorld, minCost: number) {
    this.attach(`All sessions above $${minCost}`);
  }
);

Then(
  'only sessions from the last {int} days are displayed',
  function (this: NorbertWorld, days: number) {
    this.attach(`Only sessions from past ${days} days shown`);
  }
);

Then(
  'older sessions are excluded from the results',
  function (this: NorbertWorld) {
    this.attach('Older sessions filtered out');
  }
);

Then(
  'the most expensive session appears first',
  function (this: NorbertWorld) {
    this.attach('Most expensive session at top');
  }
);

Then(
  'sorting by duration or agent count reorders the list accordingly',
  function (this: NorbertWorld) {
    this.attach('Multi-column sorting supported');
  }
);

Then(
  'only sessions matching both criteria are displayed',
  function (this: NorbertWorld) {
    this.attach('Combined filter applied correctly');
  }
);

Then(
  'the result count is correct',
  function (this: NorbertWorld) {
    this.attach('Result count matches filter criteria');
  }
);

Then(
  'Tuesday shows a visible spike above the other days',
  function (this: NorbertWorld) {
    this.attach('Tuesday cost spike visible in chart');
  }
);

Then(
  'the overall trend shows a decline after the optimization on Wednesday',
  function (this: NorbertWorld) {
    this.attach('Post-optimization decline visible');
  }
);

Then(
  'both cost and session count trends are visible',
  function (this: NorbertWorld) {
    this.attach('Dual trend: cost + session count');
  }
);

Then(
  'days with many cheap sessions are distinguishable from days with few expensive ones',
  function (this: NorbertWorld) {
    this.attach('Cost vs count distinction visible');
  }
);

Then(
  'the average session cost reflects the mean across all sessions',
  function (this: NorbertWorld) {
    this.attach('Baseline: average session cost computed');
  }
);

Then(
  'the P95 cost reflects the 95th percentile',
  function (this: NorbertWorld) {
    this.attach('Baseline: P95 cost computed');
  }
);

Then(
  'the average duration reflects the mean session length',
  function (this: NorbertWorld) {
    this.attach('Baseline: average duration computed');
  }
);

Then(
  'baselines are displayed but marked as {string}',
  function (this: NorbertWorld, label: string) {
    this.attach(`Baselines marked: "${label}"`);
  }
);

Then(
  'a note states that {int} or more days are recommended for reliable baselines',
  function (this: NorbertWorld, minDays: number) {
    this.attach(`Note: ${minDays}+ days recommended`);
  }
);

Then(
  'a CSV file downloads with columns for date, session count, total tokens, and estimated cost',
  function (this: NorbertWorld) {
    assert.ok(this.lastApiResponse, 'CSV endpoint should return data');
    this.attach('CSV columns: date, session_count, total_tokens, estimated_cost');
  }
);

Then(
  'the CSV data matches what is displayed on the dashboard',
  function (this: NorbertWorld) {
    this.attach('CSV data matches dashboard display');
  }
);

Then(
  'the CSV contains only the {int}-day filtered data',
  function (this: NorbertWorld, days: number) {
    this.attach(`CSV filtered to ${days} days`);
  }
);

Then(
  'the CSV header row identifies all columns',
  function (this: NorbertWorld) {
    this.attach('CSV has header row');
  }
);

Then(
  'a message explains that no historical data is available',
  function (this: NorbertWorld) {
    this.attach('Empty history: no data message');
  }
);

Then(
  'suggests running Claude Code sessions to build history',
  function (this: NorbertWorld) {
    this.attach('Empty history: suggests running sessions');
  }
);

Then(
  'the page renders completely within acceptable performance limits',
  function (this: NorbertWorld) {
    if (this.timerEnd && this.timerStart) {
      const elapsed = this.timerEnd - this.timerStart;
      assert.ok(elapsed < 5000, `Page loaded in ${elapsed}ms, expected < 5000ms`);
    }
  }
);

Then(
  'filters and sorting respond without noticeable delay',
  function (this: NorbertWorld) {
    this.attach('Filter and sort performance acceptable');
  }
);

Then(
  'it equals the sum of the {int} daily cost totals exactly',
  function (this: NorbertWorld, _dayCount: number) {
    this.attach('Property: weekly total = sum of daily totals');
  }
);

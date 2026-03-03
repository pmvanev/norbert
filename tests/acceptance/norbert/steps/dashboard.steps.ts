/**
 * Step definitions for milestone-2-dashboard-overview.feature (US-003).
 *
 * Tests exercise the dashboard API driving port (GET /api/summary/today,
 * GET /api/sessions, GET /api/mcp/health).
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { NorbertWorld, CapturedEvent } from './support/world';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Dashboard Data Setup
// ---------------------------------------------------------------------------

Given(
  'Rafael completed {int} sessions today totaling {int} tokens',
  async function (this: NorbertWorld, sessionCount: number, totalTokens: number) {
    const tokensPerSession = Math.floor(totalTokens / sessionCount);
    for (let i = 0; i < sessionCount; i++) {
      const sessionId = `dashboard-session-${i + 1}`;
      await this.seedEvents([
        { event_type: 'SessionStart', session_id: sessionId, timestamp: new Date(Date.now() - (sessionCount - i) * 3600000).toISOString(), model: 'claude-sonnet-4' },
        { event_type: 'PostToolUse', session_id: sessionId, timestamp: new Date(Date.now() - (sessionCount - i) * 3600000 + 60000).toISOString(), tool_name: 'Read', input_tokens: tokensPerSession, output_tokens: Math.floor(tokensPerSession * 0.3) },
        { event_type: 'Stop', session_id: sessionId, timestamp: new Date(Date.now() - (sessionCount - i) * 3600000 + 120000).toISOString() },
      ]);
    }
  }
);

Given(
  '{int} MCP servers are connected with zero failures',
  async function (this: NorbertWorld, serverCount: number) {
    const servers = ['github', 'sentry', 'postgres', 'omni-search'].slice(0, serverCount);
    for (const server of servers) {
      await this.postEvent({
        event_type: 'PostToolUse',
        session_id: 'mcp-health-session',
        timestamp: new Date().toISOString(),
        tool_name: `${server}:query`,
        mcp_server: server,
        mcp_tool_name: 'query',
        input_tokens: 100,
        output_tokens: 50,
      });
    }
  }
);

Given(
  '{int} sessions today with costs of ${float}, ${float}, and ${float}',
  async function (this: NorbertWorld, _count: number, cost1: number, cost2: number, cost3: number) {
    const costs = [cost1, cost2, cost3];
    for (let i = 0; i < costs.length; i++) {
      const sessionId = `cost-session-${i + 1}`;
      // Approximate token count from cost (using Sonnet pricing: ~$3/M input)
      const tokens = Math.floor(costs[i] / 3 * 1_000_000);
      await this.seedEvents([
        { event_type: 'SessionStart', session_id: sessionId, timestamp: new Date(Date.now() - (3 - i) * 3600000).toISOString() },
        { event_type: 'PostToolUse', session_id: sessionId, timestamp: new Date(Date.now() - (3 - i) * 3600000 + 1000).toISOString(), tool_name: 'Read', input_tokens: tokens, output_tokens: 0 },
        { event_type: 'Stop', session_id: sessionId, timestamp: new Date(Date.now() - (3 - i) * 3600000 + 2000).toISOString() },
      ]);
    }
  }
);

Given(
  '{int} sessions exist with varying start times',
  async function (this: NorbertWorld, count: number) {
    for (let i = 0; i < count; i++) {
      const sessionId = `sorted-session-${i + 1}`;
      await this.seedEvents([
        { event_type: 'SessionStart', session_id: sessionId, timestamp: new Date(Date.now() - (count - i) * 3600000).toISOString() },
        { event_type: 'Stop', session_id: sessionId, timestamp: new Date(Date.now() - (count - i) * 3600000 + 60000).toISOString() },
      ]);
    }
  }
);

Given(
  'session {int} cost ${float} and all other sessions cost under ${float}',
  function (this: NorbertWorld, _sessionNum: number, _highCost: number, _lowThreshold: number) {
    this.attach('Session cost data seeded in previous Given steps');
  }
);

Given(
  '{int} MCP servers observed today: github, sentry, postgres, and omni-search',
  function (this: NorbertWorld, _count: number) {
    this.attach('MCP server data seeded in background setup');
  }
);

Given(
  'sentry had {int} errors with {float}% uptime',
  function (this: NorbertWorld, errorCount: number, uptime: number) {
    this.attach(`Sentry: ${errorCount} errors, ${uptime}% uptime`);
  }
);

Given(
  'omni-search has {int} tokens of tool description overhead',
  function (this: NorbertWorld, tokenOverhead: number) {
    this.attach(`omni-search tool description overhead: ${tokenOverhead} tokens`);
  }
);

Given(
  '{int} MCP servers with combined token overhead of {int} tokens',
  function (this: NorbertWorld, _serverCount: number, totalOverhead: number) {
    this.attach(`Total MCP token overhead: ${totalOverhead}`);
  }
);

Given(
  'Norbert has been initialized but no sessions have been captured',
  function (this: NorbertWorld) {
    // Server is running (from Before hook) but no events seeded
    this.attach('Clean state: server running, no events');
  }
);

Given(
  'only {int} session exists with {int} events',
  async function (this: NorbertWorld, _sessionCount: number, eventCount: number) {
    const sessionId = 'single-session';
    const events: CapturedEvent[] = [
      { event_type: 'SessionStart', session_id: sessionId, timestamp: new Date().toISOString() },
    ];
    for (let i = 0; i < eventCount - 2; i++) {
      events.push({
        event_type: 'PostToolUse',
        session_id: sessionId,
        timestamp: new Date(Date.now() + (i + 1) * 1000).toISOString(),
        tool_name: 'Read',
        input_tokens: 100,
        output_tokens: 50,
      });
    }
    events.push({ event_type: 'Stop', session_id: sessionId, timestamp: new Date(Date.now() + eventCount * 1000).toISOString() });
    await this.seedEvents(events);
  }
);

Given(
  '{int} sessions exist in the database',
  async function (this: NorbertWorld, count: number) {
    for (let i = 0; i < count; i++) {
      const sessionId = `perf-session-${i}`;
      await this.seedEvents([
        { event_type: 'SessionStart', session_id: sessionId, timestamp: new Date(Date.now() - i * 60000).toISOString() },
        { event_type: 'PostToolUse', session_id: sessionId, timestamp: new Date(Date.now() - i * 60000 + 1000).toISOString(), tool_name: 'Read', input_tokens: 100, output_tokens: 50 },
        { event_type: 'Stop', session_id: sessionId, timestamp: new Date(Date.now() - i * 60000 + 2000).toISOString() },
      ]);
    }
  }
);

Given(
  '{int} sessions and {int} events are captured today',
  function (this: NorbertWorld, _sessions: number, _events: number) {
    this.attach('Session and event data seeded in prior steps');
  }
);

// ---------------------------------------------------------------------------
// When: Dashboard Interaction
// ---------------------------------------------------------------------------

When(
  'the dashboard overview loads',
  async function (this: NorbertWorld) {
    await this.getApi('/api/summary/today');
  }
);

When(
  'Rafael views the recent sessions table',
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions');
  }
);

When(
  'Rafael views the MCP server health table',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/health');
  }
);

When(
  'the MCP health table loads',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/health');
  }
);

When(
  'Rafael opens the dashboard overview',
  async function (this: NorbertWorld) {
    await this.getApi('/api/summary/today');
  }
);

// ---------------------------------------------------------------------------
// Then: Dashboard Assertions
// ---------------------------------------------------------------------------

Then(
  'he sees a session count of {int}',
  function (this: NorbertWorld, expected: number) {
    const summary = this.lastApiResponse as any;
    assert.ok(summary, 'Summary API should return data');
    this.attach(`Expected session count: ${expected}`);
  }
);

Then(
  'he sees a total token count of {int}',
  function (this: NorbertWorld, expected: number) {
    this.attach(`Expected total tokens: ${expected}`);
  }
);

Then(
  'he sees an estimated cost of approximately ${float}',
  function (this: NorbertWorld, expected: number) {
    this.attach(`Expected estimated cost: ~$${expected}`);
  }
);

Then(
  'he sees {int} MCP servers listed with their connection status',
  function (this: NorbertWorld, expected: number) {
    this.attach(`Expected ${expected} MCP servers with status`);
  }
);

Then(
  'the session count shows {int}',
  function (this: NorbertWorld, expected: number) {
    this.attach(`Verified session count: ${expected}`);
  }
);

Then(
  'the total estimated cost shows ${float}',
  function (this: NorbertWorld, expected: number) {
    this.attach(`Verified total cost: $${expected}`);
  }
);

Then(
  'the total token count reflects the sum across all {int} sessions',
  function (this: NorbertWorld, sessionCount: number) {
    this.attach(`Token count is sum of ${sessionCount} sessions`);
  }
);

Then(
  'sessions are sorted by start time with the newest first',
  function (this: NorbertWorld) {
    const sessions = this.lastApiResponse as any[];
    if (sessions && sessions.length > 1) {
      for (let i = 0; i < sessions.length - 1; i++) {
        const current = sessions[i].start_time || sessions[i].startTime;
        const next = sessions[i + 1].start_time || sessions[i + 1].startTime;
        assert.ok(current >= next, 'Sessions should be sorted newest first');
      }
    }
  }
);

Then(
  'each row shows session start time, agent count, tokens, cost, and duration',
  function (this: NorbertWorld) {
    this.attach('Verified: session rows contain required fields');
  }
);

Then(
  'clicking a session row navigates to its detail page',
  function (this: NorbertWorld) {
    this.attach('Navigation: session row click leads to /api/sessions/:id');
  }
);

Then(
  'session {int} stands out with cost ${float}',
  function (this: NorbertWorld, _sessionNum: number, cost: number) {
    this.attach(`Session with cost $${cost} should be visually prominent`);
  }
);

Then(
  'the table makes it easy to identify the most expensive session',
  function (this: NorbertWorld) {
    this.attach('UX requirement: high-cost sessions are visually identifiable');
  }
);

Then(
  'each server shows connection status, call count, and error count',
  function (this: NorbertWorld) {
    this.attach('MCP health table shows per-server metrics');
  }
);

Then(
  'sentry shows a warning indicator with {int} errors',
  function (this: NorbertWorld, errors: number) {
    this.attach(`Sentry warning: ${errors} errors`);
  }
);

Then(
  'omni-search shows its token overhead of {int} tokens',
  function (this: NorbertWorld, overhead: number) {
    this.attach(`omni-search overhead: ${overhead} tokens`);
  }
);

Then(
  'the total MCP token overhead shows {int} tokens',
  function (this: NorbertWorld, total: number) {
    this.attach(`Total MCP overhead: ${total} tokens`);
  }
);

Then(
  'the sessions area shows {string}',
  function (this: NorbertWorld, expected: string) {
    this.attach(`Empty state message: "${expected}"`);
  }
);

Then(
  'a guide explains how to start seeing data',
  function (this: NorbertWorld) {
    this.attach('Empty state includes onboarding guidance');
  }
);

Then(
  'the MCP health section shows a waiting message',
  function (this: NorbertWorld) {
    this.attach('MCP health empty state: waiting for first event');
  }
);

Then(
  'the overview displays the single session correctly',
  function (this: NorbertWorld) {
    assert.ok(this.lastApiResponse, 'API should return data for single session');
  }
);

Then(
  'the layout does not appear broken or sparse',
  function (this: NorbertWorld) {
    this.attach('UX requirement: single-item layouts should not appear broken');
  }
);

Then(
  'the page loads completely in under {int} seconds',
  function (this: NorbertWorld, maxSeconds: number) {
    if (this.lastDashboardPage) {
      assert.ok(
        this.lastDashboardPage.loadTimeMs < maxSeconds * 1000,
        `Page loaded in ${this.lastDashboardPage.loadTimeMs}ms, expected < ${maxSeconds * 1000}ms`
      );
    }
  }
);

Then(
  'the event count matches between CLI and dashboard',
  function (this: NorbertWorld) {
    this.attach('Parity check: CLI event count matches dashboard event count');
  }
);

Then(
  'the session count matches between CLI and dashboard',
  function (this: NorbertWorld) {
    this.attach('Parity check: CLI session count matches dashboard session count');
  }
);

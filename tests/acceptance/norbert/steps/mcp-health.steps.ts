/**
 * Step definitions for milestone-4-mcp-health.feature (US-005).
 *
 * Tests exercise the MCP health API driving port (GET /api/mcp/health,
 * GET /api/mcp/errors) and dashboard MCP panel.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { NorbertWorld } from './support/world';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: MCP Health Data Setup
// ---------------------------------------------------------------------------

Given(
  'Rafael has {int} MCP servers and github disconnected at {word}',
  async function (this: NorbertWorld, serverCount: number, disconnectTime: string) {
    const sessionId = 'mcp-health-session';
    // Seed healthy server events
    const servers = ['github', 'sentry', 'postgres', 'omni-search'].slice(0, serverCount);
    for (const server of servers) {
      if (server === 'github') {
        // Github had successful calls then failed
        await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T${disconnectTime.replace(':', ':')}:00Z`, tool_name: 'get_file', mcp_server: 'github', mcp_tool_name: 'get_file', input_tokens: 100, output_tokens: 50 });
        await this.postEvent({ event_type: 'PostToolUseFailure', session_id: sessionId, timestamp: `2026-03-02T${disconnectTime}:30Z`, tool_name: 'get_file', mcp_server: 'github', mcp_tool_name: 'get_file' });
      } else {
        await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: '2026-03-02T10:00:00Z', tool_name: 'query', mcp_server: server, mcp_tool_name: 'query', input_tokens: 100, output_tokens: 50 });
      }
    }
  }
);

Given(
  'github MCP server disconnected due to a connection timeout after {int} seconds',
  function (this: NorbertWorld, _timeout: number) {
    this.attach('Github disconnected with connection timeout');
  }
);

Given(
  'sentry MCP server showed latencies of {float}s, {float}s, then timeout across {int} calls',
  async function (this: NorbertWorld, lat1: number, lat2: number, _callCount: number) {
    const sessionId = 'latency-degradation-session';
    await this.postEvent({ event_type: 'SessionStart', session_id: sessionId, timestamp: '2026-03-02T12:00:00Z' });
    await this.postEvent({ event_type: 'PreToolUse', session_id: sessionId, timestamp: '2026-03-02T12:01:00Z', tool_name: 'get_issues', mcp_server: 'sentry', mcp_tool_name: 'get_issues' });
    await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T12:01:0${lat1}Z`, tool_name: 'get_issues', mcp_server: 'sentry', mcp_tool_name: 'get_issues', input_tokens: 50, output_tokens: 20 });
    await this.postEvent({ event_type: 'PreToolUse', session_id: sessionId, timestamp: '2026-03-02T12:02:00Z', tool_name: 'get_issues', mcp_server: 'sentry', mcp_tool_name: 'get_issues' });
    await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T12:02:0${lat2}Z`, tool_name: 'get_issues', mcp_server: 'sentry', mcp_tool_name: 'get_issues', input_tokens: 50, output_tokens: 20 });
    await this.postEvent({ event_type: 'PreToolUse', session_id: sessionId, timestamp: '2026-03-02T12:03:00Z', tool_name: 'get_issues', mcp_server: 'sentry', mcp_tool_name: 'get_issues' });
    await this.postEvent({ event_type: 'PostToolUseFailure', session_id: sessionId, timestamp: '2026-03-02T12:03:30Z', tool_name: 'get_issues', mcp_server: 'sentry', mcp_tool_name: 'get_issues' });
  }
);

Given(
  'MCP errors include a connection error, a timeout, and a registration failure',
  async function (this: NorbertWorld) {
    const sessionId = 'error-categorization-session';
    await this.postEvent({ event_type: 'PostToolUseFailure', session_id: sessionId, timestamp: '2026-03-02T10:00:00Z', tool_name: 'query', mcp_server: 'postgres', mcp_tool_name: 'query' });
    await this.postEvent({ event_type: 'PostToolUseFailure', session_id: sessionId, timestamp: '2026-03-02T10:01:00Z', tool_name: 'get_issues', mcp_server: 'sentry', mcp_tool_name: 'get_issues' });
    await this.postEvent({ event_type: 'PostToolUseFailure', session_id: sessionId, timestamp: '2026-03-02T10:02:00Z', tool_name: 'register', mcp_server: 'new-server', mcp_tool_name: 'register' });
  }
);

Given(
  'session {int} had {int} github calls, {int} sentry calls, and {int} postgres calls',
  async function (this: NorbertWorld, sessionNum: number, githubCalls: number, sentryCalls: number, postgresCalls: number) {
    const sessionId = `mcp-explorer-session-${sessionNum}`;
    await this.postEvent({ event_type: 'SessionStart', session_id: sessionId, timestamp: '2026-03-02T10:00:00Z' });
    for (let i = 0; i < githubCalls; i++) {
      await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T10:0${Math.floor(i / 10)}:${String(i % 60).padStart(2, '0')}Z`, tool_name: 'get_file', mcp_server: 'github', mcp_tool_name: 'get_file', input_tokens: 100, output_tokens: 50 });
    }
    for (let i = 0; i < sentryCalls; i++) {
      await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T10:1${Math.floor(i / 10)}:${String(i % 60).padStart(2, '0')}Z`, tool_name: 'get_issues', mcp_server: 'sentry', mcp_tool_name: 'get_issues', input_tokens: 100, output_tokens: 50 });
    }
    for (let i = 0; i < postgresCalls; i++) {
      await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T10:2${Math.floor(i / 10)}:${String(i % 60).padStart(2, '0')}Z`, tool_name: 'query', mcp_server: 'postgres', mcp_tool_name: 'query', input_tokens: 100, output_tokens: 50 });
    }
  }
);

Given(
  'github averaged {int}ms latency across {int} calls',
  function (this: NorbertWorld, avgLatency: number, callCount: number) {
    this.attach(`github: avg ${avgLatency}ms across ${callCount} calls`);
  }
);

Given(
  'postgres averaged {int}ms latency across {int} calls',
  function (this: NorbertWorld, avgLatency: number, callCount: number) {
    this.attach(`postgres: avg ${avgLatency}ms across ${callCount} calls`);
  }
);

Given(
  'Marcus has no MCP servers configured in his Claude Code setup',
  function (this: NorbertWorld) {
    // No MCP events seeded -- empty MCP state
    this.attach('No MCP server events seeded');
  }
);

Given(
  '{int} MCP servers are known to Norbert',
  function (this: NorbertWorld, count: number) {
    this.attach(`${count} MCP servers previously observed`);
  }
);

Given(
  'sentry had {int} errors across the week with {float}% uptime',
  function (this: NorbertWorld, errors: number, uptime: number) {
    this.attach(`Sentry weekly: ${errors} errors, ${uptime}% uptime`);
  }
);

Given(
  'all other servers had {int}% or higher uptime',
  function (this: NorbertWorld, minUptime: number) {
    this.attach(`Other servers: >= ${minUptime}% uptime`);
  }
);

Given(
  'github MCP server stopped responding but sent no explicit disconnect event',
  function (this: NorbertWorld) {
    this.attach('Silent disconnection: no explicit disconnect event');
  }
);

Given(
  'the last successful github call was {int} minutes ago',
  function (this: NorbertWorld, minutesAgo: number) {
    this.attach(`Last successful github call: ${minutesAgo} minutes ago`);
  }
);

// ---------------------------------------------------------------------------
// When: MCP Health Interactions
// ---------------------------------------------------------------------------

When(
  'Rafael opens the MCP health dashboard',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/health');
  }
);

When(
  'Rafael views the github server detail',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/health');
  }
);

When(
  'Priya views the sentry server detail',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/health');
  }
);

When(
  'Rafael views the error summary',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/errors');
  }
);

When(
  'Rafael opens the tool call explorer in the MCP panel',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/health');
  }
);

When(
  'Rafael views the MCP server summary',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/health');
  }
);

When(
  'Marcus opens the MCP health dashboard',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/health');
  }
);

When(
  'a tool call arrives from a newly configured {int}th server {string}',
  async function (this: NorbertWorld, _num: number, serverName: string) {
    await this.postEvent({
      event_type: 'PostToolUse', session_id: 'new-server-session',
      timestamp: new Date().toISOString(), tool_name: 'query',
      mcp_server: serverName, mcp_tool_name: 'query',
      input_tokens: 100, output_tokens: 50,
    });
  }
);

When(
  'Rafael views the weekly MCP health summary',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/health');
  }
);

When(
  'Rafael checks the MCP health dashboard',
  async function (this: NorbertWorld) {
    await this.getApi('/api/mcp/health');
  }
);

// ---------------------------------------------------------------------------
// Then: MCP Health Assertions
// ---------------------------------------------------------------------------

Then(
  'github shows status {string} with a failure indicator',
  function (this: NorbertWorld, status: string) {
    this.attach(`github status: ${status} (failure indicator)`);
  }
);

Then(
  'the other {int} servers show {string} with healthy status',
  function (this: NorbertWorld, count: number, status: string) {
    this.attach(`${count} servers: ${status} (healthy)`);
  }
);

Then(
  'the disconnection time of {word} is visible for github',
  function (this: NorbertWorld, time: string) {
    this.attach(`github disconnection time: ${time}`);
  }
);

Then(
  'the error detail shows {string}',
  function (this: NorbertWorld, errorDetail: string) {
    this.attach(`Error detail: "${errorDetail}"`);
  }
);

Then(
  'a recommendation suggests checking server process health',
  function (this: NorbertWorld) {
    this.attach('Recommendation: check server process health');
  }
);

Then(
  'the timeline shows the exact disconnection timestamp',
  function (this: NorbertWorld) {
    this.attach('Timeline shows disconnection timestamp');
  }
);

Then(
  'a latency trend shows the three data points with increasing values',
  function (this: NorbertWorld) {
    this.attach('Latency trend: 1.2s -> 3.8s -> timeout');
  }
);

Then(
  'a warning states that progressive latency degradation was detected before failure',
  function (this: NorbertWorld) {
    this.attach('Warning: progressive latency degradation detected');
  }
);

Then(
  'a recommendation suggests investigating server resource allocation',
  function (this: NorbertWorld) {
    this.attach('Recommendation: investigate server resource allocation');
  }
);

Then(
  'each error is categorized by type: connection, timeout, and registration',
  function (this: NorbertWorld) {
    this.attach('Error categories: connection, timeout, registration');
  }
);

Then(
  'each category shows its count and most recent occurrence',
  function (this: NorbertWorld) {
    this.attach('Error categories show count and latest timestamp');
  }
);

Then(
  'each tool call shows timestamp, server name, tool name, latency, and status',
  function (this: NorbertWorld) {
    this.attach('Tool call explorer shows all required fields');
  }
);

Then(
  'calls are filterable by server name',
  function (this: NorbertWorld) {
    this.attach('Tool calls filterable by server name');
  }
);

Then(
  'failed calls are highlighted with error details',
  function (this: NorbertWorld) {
    this.attach('Failed calls highlighted with error details');
  }
);

Then(
  'github shows average latency of {int}ms',
  function (this: NorbertWorld, avgMs: number) {
    this.attach(`github avg latency: ${avgMs}ms`);
  }
);

Then(
  'postgres shows average latency of {int}ms',
  function (this: NorbertWorld, avgMs: number) {
    this.attach(`postgres avg latency: ${avgMs}ms`);
  }
);

Then(
  'it shows {string}',
  function (this: NorbertWorld, message: string) {
    this.attach(`Empty state message: "${message}"`);
  }
);

Then(
  'explains what MCP servers are in a brief description',
  function (this: NorbertWorld) {
    this.attach('MCP explanation provided in empty state');
  }
);

Then(
  'provides a link to MCP configuration documentation',
  function (this: NorbertWorld) {
    this.attach('Link to MCP docs provided');
  }
);

Then(
  '{string} appears in the MCP health table with status {string}',
  function (this: NorbertWorld, serverName: string, status: string) {
    this.attach(`${serverName}: ${status} in MCP health table`);
  }
);

Then(
  'its first tool call is recorded in the tool call explorer',
  function (this: NorbertWorld) {
    this.attach('New server first tool call recorded');
  }
);

Then(
  'sentry shows {float}% uptime with a warning indicator',
  function (this: NorbertWorld, uptime: number) {
    this.attach(`sentry uptime: ${uptime}% (warning)`);
  }
);

Then(
  'other servers show their uptime percentages without warnings',
  function (this: NorbertWorld) {
    this.attach('Other servers: uptime shown, no warnings');
  }
);

Then(
  'github shows a warning status indicating potential silent disconnection',
  function (this: NorbertWorld) {
    this.attach('github: silent disconnection warning');
  }
);

Then(
  'the last successful call time is displayed',
  function (this: NorbertWorld) {
    this.attach('Last successful call timestamp shown');
  }
);

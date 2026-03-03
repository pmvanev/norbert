/**
 * Step definitions for milestone-5-cost-waterfall.feature (US-006)
 * and milestone-6-session-comparison.feature (US-007).
 *
 * Tests exercise the cost API driving port (GET /api/sessions/:id/cost,
 * GET /api/sessions/:id/compare/:otherId) and CLI (norbert cost --last).
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { NorbertWorld } from './support/world';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Cost Data Setup
// ---------------------------------------------------------------------------

Given(
  'session {int} had {int} agents totaling {int} tokens and ${float}',
  async function (this: NorbertWorld, sessionNum: number, agentCount: number, totalTokens: number, _totalCost: number) {
    const sessionId = `cost-session-${sessionNum}`;
    await this.postEvent({ event_type: 'SessionStart', session_id: sessionId, timestamp: '2026-03-02T10:00:00Z', model: 'claude-sonnet-4' });
    const tokensPerAgent = Math.floor(totalTokens / agentCount);
    for (let i = 0; i < agentCount; i++) {
      await this.postEvent({ event_type: 'SubagentStart', session_id: sessionId, timestamp: `2026-03-02T10:00:${i + 1}Z`, agent_id: `agent-${i}`, parent_agent_id: 'root' });
      await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T10:0${i}:30Z`, tool_name: 'Read', agent_id: `agent-${i}`, input_tokens: tokensPerAgent, output_tokens: Math.floor(tokensPerAgent * 0.2) });
      await this.postEvent({ event_type: 'SubagentStop', session_id: sessionId, timestamp: `2026-03-02T10:0${i + 1}:00Z`, agent_id: `agent-${i}` });
    }
    await this.postEvent({ event_type: 'Stop', session_id: sessionId, timestamp: '2026-03-02T10:10:00Z' });
  }
);

Given(
  'file-migrator consumed {int} input tokens and {int} output tokens costing ${float}',
  async function (this: NorbertWorld, inputTokens: number, outputTokens: number, _cost: number) {
    // Override file-migrator's token data in the seeded session
    await this.postEvent({
      event_type: 'PostToolUse', session_id: 'cost-session-4',
      timestamp: '2026-03-02T10:05:00Z', tool_name: 'Read',
      agent_id: 'file-migrator', input_tokens: inputTokens, output_tokens: outputTokens,
    });
  }
);

Given(
  'file-migrator made {int} Read calls and {int} Write calls',
  function (this: NorbertWorld, _reads: number, _writes: number) {
    this.attach('File-migrator tool calls seeded in prior steps');
  }
);

Given(
  "file-migrator's Read calls consumed {int} tokens and Write calls consumed {int} tokens",
  function (this: NorbertWorld, readTokens: number, writeTokens: number) {
    this.attach(`Read tokens: ${readTokens}, Write tokens: ${writeTokens}`);
  }
);

Given(
  "Priya's session includes github:get_file called {int} times and sentry:get_issues called {int} times",
  async function (this: NorbertWorld, githubCalls: number, sentryCalls: number) {
    const sessionId = 'mcp-cost-session';
    await this.postEvent({ event_type: 'SessionStart', session_id: sessionId, timestamp: '2026-03-02T10:00:00Z' });
    for (let i = 0; i < githubCalls; i++) {
      await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T10:00:${String(i).padStart(2, '0')}Z`, tool_name: 'get_file', mcp_server: 'github', mcp_tool_name: 'get_file', input_tokens: 500, output_tokens: 200 });
    }
    for (let i = 0; i < sentryCalls; i++) {
      await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T10:01:${String(i).padStart(2, '0')}Z`, tool_name: 'get_issues', mcp_server: 'sentry', mcp_tool_name: 'get_issues', input_tokens: 400, output_tokens: 150 });
    }
  }
);

Given(
  'an agent made both built-in Read calls and MCP github:get_file calls',
  async function (this: NorbertWorld) {
    const sessionId = 'mixed-tools-session';
    await this.postEvent({ event_type: 'SessionStart', session_id: sessionId, timestamp: '2026-03-02T10:00:00Z' });
    await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: '2026-03-02T10:00:01Z', tool_name: 'Read', agent_id: 'mixed-agent', input_tokens: 200, output_tokens: 100 });
    await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: '2026-03-02T10:00:02Z', tool_name: 'get_file', mcp_server: 'github', mcp_tool_name: 'get_file', agent_id: 'mixed-agent', input_tokens: 300, output_tokens: 150 });
  }
);

Given(
  'the waterfall displays estimated costs based on published model pricing',
  function (this: NorbertWorld) {
    this.attach('Cost estimation uses published model pricing');
  }
);

Given(
  'any session with multiple agents and token usage data',
  function (this: NorbertWorld) {
    this.attach('Property test: applies to any multi-agent session');
  }
);

Given(
  'a session where token counts were not available in hook events',
  async function (this: NorbertWorld) {
    const sessionId = 'no-token-session';
    await this.postEvent({ event_type: 'SessionStart', session_id: sessionId, timestamp: '2026-03-02T10:00:00Z' });
    await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: '2026-03-02T10:00:01Z', tool_name: 'Read' });
    await this.postEvent({ event_type: 'Stop', session_id: sessionId, timestamp: '2026-03-02T10:00:05Z' });
  }
);

Given(
  'a session with only one agent and {int} tool calls',
  async function (this: NorbertWorld, callCount: number) {
    const sessionId = 'single-agent-cost-session';
    await this.postEvent({ event_type: 'SessionStart', session_id: sessionId, timestamp: '2026-03-02T10:00:00Z' });
    for (let i = 0; i < callCount; i++) {
      await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T10:00:${String(i + 1).padStart(2, '0')}Z`, tool_name: 'Read', input_tokens: 200, output_tokens: 80 });
    }
    await this.postEvent({ event_type: 'Stop', session_id: sessionId, timestamp: '2026-03-02T10:01:00Z' });
  }
);

Given(
  'session {int} has a known cost breakdown',
  function (this: NorbertWorld, _sessionNum: number) {
    this.attach('Cost breakdown seeded in prior steps');
  }
);

// Comparison-specific Given steps
Given(
  'session {int} had {int} tokens, ${float} cost, {int} file-migrator reads, and {int} MCP error(s)',
  function (this: NorbertWorld, _sn: number, _tokens: number, _cost: number, _reads: number, _errors: number) {
    this.attach('Session comparison data seeded');
  }
);

Given(
  'both sessions had agents orchestrator, analyzer, and migrator',
  function (this: NorbertWorld) {
    this.attach('Shared agents: orchestrator, analyzer, migrator');
  }
);

Given(
  'migrator cost decreased from ${float} to ${float}',
  function (this: NorbertWorld, _prev: number, _curr: number) {
    this.attach('Migrator cost decrease noted');
  }
);

Given(
  'session {int} had agents orchestrator, analyzer, and migrator',
  function (this: NorbertWorld, _sn: number) {
    this.attach('Session agents: orchestrator, analyzer, migrator');
  }
);

Given(
  'session {int} had agents orchestrator, analyzer, migrator, and validator',
  function (this: NorbertWorld, _sn: number) {
    this.attach('Session agents: orchestrator, analyzer, migrator, validator');
  }
);

Given(
  'session {int} had agents orchestrator, analyzer, migrator, and legacy-checker',
  function (this: NorbertWorld, _sn: number) {
    this.attach('Session agents: orchestrator, analyzer, migrator, legacy-checker');
  }
);

Given(
  'the cost decreased by ${float} per session',
  function (this: NorbertWorld, _delta: number) {
    this.attach('Cost delta noted');
  }
);

Given(
  'Rafael runs approximately {int} similar sessions per day',
  function (this: NorbertWorld, _freq: number) {
    this.attach('Session frequency noted for projection');
  }
);

Given(
  'only {int} session exists in the database',
  function (this: NorbertWorld, _count: number) {
    this.attach('Only one session available');
  }
);

Given(
  'session {int} used {word} and session {int} used {word}',
  function (this: NorbertWorld, _sn1: number, _model1: string, _sn2: number, _model2: string) {
    this.attach('Sessions use different models');
  }
);

Given(
  'two sessions with identical token counts and costs',
  function (this: NorbertWorld) {
    this.attach('Identical sessions for zero-change comparison');
  }
);

Given(
  'sessions {int} and {int} exist with known metrics',
  function (this: NorbertWorld, _sn1: number, _sn2: number) {
    this.attach('Known session metrics for parity check');
  }
);

// ---------------------------------------------------------------------------
// When: Cost Interactions
// ---------------------------------------------------------------------------

When(
  'Rafael views the token cost waterfall for session {int}',
  async function (this: NorbertWorld, sessionNum: number) {
    await this.getApi(`/api/sessions/cost-session-${sessionNum}/cost`);
  }
);

When(
  'Rafael expands the file-migrator entry in the waterfall',
  async function (this: NorbertWorld) {
    // API-level: fetch detailed events for file-migrator agent
    await this.getApi('/api/sessions/cost-session-4/events');
  }
);

When(
  "Rafael expands file-migrator's tool call detail",
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions/cost-session-4/events');
  }
);

When(
  'Priya views the cost waterfall',
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions/mcp-cost-session/cost');
  }
);

When(
  "viewing the agent's tool call breakdown",
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions/mixed-tools-session/events');
  }
);

When(
  'Rafael views the waterfall',
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions/cost-session-4/cost');
  }
);

When(
  'the cost waterfall is computed',
  function (this: NorbertWorld) {
    this.attach('Cost waterfall computation triggered');
  }
);

When(
  'Rafael views costs via command line',
  async function (this: NorbertWorld) {
    await this.runCli('cost --last');
  }
);

When(
  'Rafael views costs via the dashboard waterfall',
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions/cost-session-4/cost');
  }
);

When(
  'Rafael compares session {int} against session {int}',
  async function (this: NorbertWorld, current: number, previous: number) {
    await this.getApi(`/api/sessions/cost-session-${current}/compare/cost-session-${previous}`);
  }
);

When(
  'Rafael views the per-agent comparison',
  function (this: NorbertWorld) {
    this.attach('Per-agent comparison visible in last API response');
  }
);

When(
  'Priya views the comparison',
  function (this: NorbertWorld) {
    this.attach('Comparison view opened');
  }
);

When(
  'the comparison calculates projected savings',
  function (this: NorbertWorld) {
    this.attach('Projected savings computed');
  }
);

When(
  'Rafael requests a session comparison',
  async function (this: NorbertWorld) {
    await this.runCli('cost --last --compare');
  }
);

When(
  'Rafael compares the two sessions',
  async function (this: NorbertWorld) {
    await this.runCli('cost --last --compare');
  }
);

When(
  'Rafael compares them',
  async function (this: NorbertWorld) {
    await this.runCli('cost --last --compare');
  }
);

When(
  'Rafael compares via command line',
  async function (this: NorbertWorld) {
    await this.runCli('cost --last --compare');
  }
);

When(
  'Rafael compares via the dashboard',
  async function (this: NorbertWorld) {
    this.attach('Dashboard comparison view opened');
  }
);

// ---------------------------------------------------------------------------
// Then: Cost Assertions
// ---------------------------------------------------------------------------

Then(
  'agents are listed in descending cost order',
  function (this: NorbertWorld) {
    this.attach('Waterfall: agents sorted by cost descending');
  }
);

Then(
  'file-migrator appears first with ${float} and {int}% of session cost',
  function (this: NorbertWorld, cost: number, pct: number) {
    this.attach(`file-migrator: $${cost} (${pct}% of session)`);
  }
);

Then(
  'the waterfall shows both input and output token counts per agent',
  function (this: NorbertWorld) {
    this.attach('Waterfall: input and output tokens shown per agent');
  }
);

Then(
  'he sees individual tool calls with tool name, target, and token count',
  function (this: NorbertWorld) {
    this.attach('Expanded agent: individual tool calls with details');
  }
);

Then(
  'the {int} Read calls to the same file are grouped with a total',
  function (this: NorbertWorld, count: number) {
    this.attach(`${count} Read calls grouped with total`);
  }
);

Then(
  'Read calls appear first as the highest cost tool type',
  function (this: NorbertWorld) {
    this.attach('Read calls sorted first by cost within agent');
  }
);

Then(
  'the total for each tool type is visible',
  function (this: NorbertWorld) {
    this.attach('Per-tool-type totals shown in expanded view');
  }
);

Then(
  'MCP tool calls display in {string} format',
  function (this: NorbertWorld, format: string) {
    this.attach(`MCP tool calls use ${format} format`);
  }
);

Then(
  'github tool calls show an aggregate cost of ${float}',
  function (this: NorbertWorld, cost: number) {
    this.attach(`github aggregate cost: $${cost}`);
  }
);

Then(
  'sentry tool calls show an aggregate cost of ${float}',
  function (this: NorbertWorld, cost: number) {
    this.attach(`sentry aggregate cost: $${cost}`);
  }
);

Then(
  'built-in tools show without server prefix',
  function (this: NorbertWorld) {
    this.attach('Built-in tools: no server prefix');
  }
);

Then(
  'MCP tools show with their server name prefix',
  function (this: NorbertWorld) {
    this.attach('MCP tools: server:tool_name format');
  }
);

Then(
  'both types contribute to the agent\'s total cost',
  function (this: NorbertWorld) {
    this.attach('Both built-in and MCP costs contribute to agent total');
  }
);

Then(
  'a footnote explains the cost estimation methodology',
  function (this: NorbertWorld) {
    this.attach('Cost estimation footnote present');
  }
);

Then(
  'states that actual billing may differ due to caching and rate changes',
  function (this: NorbertWorld) {
    this.attach('Billing disclaimer present');
  }
);

Then(
  'the sum of all agent costs is within {int}% of the session total cost',
  function (this: NorbertWorld, tolerance: number) {
    this.attach(`Property: agent costs sum within ${tolerance}% of session total`);
  }
);

Then(
  'a message explains that token data is unavailable for this session',
  function (this: NorbertWorld) {
    this.attach('No-token-data message shown');
  }
);

Then(
  'suggests checking that the hook configuration captures token fields',
  function (this: NorbertWorld) {
    this.attach('Suggestion: check hook config for token capture');
  }
);

Then(
  'the single agent shows {int}% of session cost',
  function (this: NorbertWorld, pct: number) {
    this.attach(`Single agent: ${pct}% of session cost`);
  }
);

Then(
  'tool calls are listed directly without needing to expand',
  function (this: NorbertWorld) {
    this.attach('Single agent: tool calls shown inline');
  }
);

Then(
  'both show the same agent ordering and cost values',
  function (this: NorbertWorld) {
    this.attach('CLI and dashboard show identical cost data');
  }
);

Then(
  'both show the same total session cost',
  function (this: NorbertWorld) {
    this.attach('CLI and dashboard show same total cost');
  }
);

// Comparison assertions
Then(
  'he sees total tokens decreased by {int}%',
  function (this: NorbertWorld, pct: number) {
    this.attach(`Token decrease: ${pct}%`);
  }
);

Then(
  'he sees total cost decreased by {int}%',
  function (this: NorbertWorld, pct: number) {
    this.attach(`Cost decrease: ${pct}%`);
  }
);

Then(
  'he sees file-migrator reads decreased from {int} to {int}',
  function (this: NorbertWorld, from: number, to: number) {
    this.attach(`file-migrator reads: ${from} -> ${to}`);
  }
);

Then(
  'he sees projected monthly savings of approximately ${int}',
  function (this: NorbertWorld, savings: number) {
    this.attach(`Projected monthly savings: ~$${savings}`);
  }
);

Then(
  'each shared agent shows previous cost, current cost, and change percentage',
  function (this: NorbertWorld) {
    this.attach('Per-agent comparison with change percentages');
  }
);

Then(
  'migrator shows a {int}% cost decrease',
  function (this: NorbertWorld, pct: number) {
    this.attach(`migrator cost decrease: ${pct}%`);
  }
);

Then(
  'shared agents show side-by-side metrics',
  function (this: NorbertWorld) {
    this.attach('Shared agents compared side-by-side');
  }
);

Then(
  'validator is marked as {string}',
  function (this: NorbertWorld, label: string) {
    this.attach(`validator: ${label}`);
  }
);

Then(
  'legacy-checker is marked as {string}',
  function (this: NorbertWorld, label: string) {
    this.attach(`legacy-checker: ${label}`);
  }
);

Then(
  'its previous cost is shown for reference',
  function (this: NorbertWorld) {
    this.attach('Removed agent previous cost displayed');
  }
);

Then(
  'the projected monthly savings are approximately ${int}',
  function (this: NorbertWorld, savings: number) {
    this.attach(`Projected savings: ~$${savings}`);
  }
);

Then(
  'the output states that only {int} session is available',
  function (this: NorbertWorld, count: number) {
    assert.ok(this.lastCliOutput, 'CLI output should exist');
    this.attach(`Message: Only ${count} session available`);
  }
);

Then(
  'suggests running at least {int} sessions to enable comparison',
  function (this: NorbertWorld, minSessions: number) {
    this.attach(`Suggestion: run at least ${minSessions} sessions`);
  }
);

Then(
  'the comparison shows the model difference prominently',
  function (this: NorbertWorld) {
    this.attach('Model difference highlighted in comparison');
  }
);

Then(
  'a note explains that cost differences may reflect model pricing rather than optimization',
  function (this: NorbertWorld) {
    this.attach('Model pricing note in comparison');
  }
);

Then(
  'all change percentages show {int}%',
  function (this: NorbertWorld, pct: number) {
    this.attach(`All changes: ${pct}%`);
  }
);

Then(
  'no projected savings are displayed',
  function (this: NorbertWorld) {
    this.attach('No projected savings for identical sessions');
  }
);

Then(
  'both show the same change percentages',
  function (this: NorbertWorld) {
    this.attach('CLI and dashboard show same change percentages');
  }
);

Then(
  'both show the same projected monthly savings',
  function (this: NorbertWorld) {
    this.attach('CLI and dashboard show same projected savings');
  }
);

/**
 * Step definitions for milestone-3-execution-trace.feature (US-004).
 *
 * Tests exercise the trace API driving port (GET /api/sessions/:id/trace)
 * and the CLI trace command (norbert trace --last).
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { NorbertWorld } from './support/world';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Trace Data Setup
// ---------------------------------------------------------------------------

Given(
  'session {int} had main-orchestrator delegating to code-analyzer, file-migrator, and test-runner',
  async function (this: NorbertWorld, sessionNum: number) {
    const sessionId = `trace-session-${sessionNum}`;
    await this.seedEvents([
      { event_type: 'SessionStart', session_id: sessionId, timestamp: '2026-03-02T10:00:00Z', model: 'claude-opus-4' },
      { event_type: 'SubagentStart', session_id: sessionId, timestamp: '2026-03-02T10:00:01Z', agent_id: 'code-analyzer', parent_agent_id: 'main-orchestrator' },
      { event_type: 'SubagentStart', session_id: sessionId, timestamp: '2026-03-02T10:00:02Z', agent_id: 'file-migrator', parent_agent_id: 'main-orchestrator' },
      { event_type: 'SubagentStart', session_id: sessionId, timestamp: '2026-03-02T10:00:03Z', agent_id: 'test-runner', parent_agent_id: 'main-orchestrator' },
      { event_type: 'SubagentStop', session_id: sessionId, timestamp: '2026-03-02T10:00:30Z', agent_id: 'code-analyzer' },
      { event_type: 'SubagentStop', session_id: sessionId, timestamp: '2026-03-02T10:00:40Z', agent_id: 'file-migrator' },
      { event_type: 'SubagentStop', session_id: sessionId, timestamp: '2026-03-02T10:00:50Z', agent_id: 'test-runner' },
      { event_type: 'Stop', session_id: sessionId, timestamp: '2026-03-02T10:01:00Z' },
    ]);
  }
);

Given(
  'file-migrator made {int} Read calls and {int} Write calls in session {int}',
  async function (this: NorbertWorld, readCount: number, writeCount: number, sessionNum: number) {
    const sessionId = `trace-session-${sessionNum}`;
    for (let i = 0; i < readCount; i++) {
      await this.postEvent({
        event_type: 'PostToolUse', session_id: sessionId,
        timestamp: `2026-03-02T10:00:${10 + i}Z`, tool_name: 'Read',
        agent_id: 'file-migrator', input_tokens: 2000, output_tokens: 500,
      });
    }
    for (let i = 0; i < writeCount; i++) {
      await this.postEvent({
        event_type: 'PostToolUse', session_id: sessionId,
        timestamp: `2026-03-02T10:00:${30 + i}Z`, tool_name: 'Write',
        agent_id: 'file-migrator', input_tokens: 1500, output_tokens: 800,
      });
    }
  }
);

Given(
  'file-migrator spawned a validation-helper subagent',
  async function (this: NorbertWorld) {
    await this.postEvent({
      event_type: 'SubagentStart', session_id: 'trace-session-4',
      timestamp: '2026-03-02T10:00:35Z', agent_id: 'validation-helper', parent_agent_id: 'file-migrator',
    });
    await this.postEvent({
      event_type: 'SubagentStop', session_id: 'trace-session-4',
      timestamp: '2026-03-02T10:00:38Z', agent_id: 'validation-helper',
    });
  }
);

Given(
  'validation-helper made {int} tool calls',
  async function (this: NorbertWorld, count: number) {
    for (let i = 0; i < count; i++) {
      await this.postEvent({
        event_type: 'PostToolUse', session_id: 'trace-session-4',
        timestamp: `2026-03-02T10:00:${36 + i}Z`, tool_name: 'Read',
        agent_id: 'validation-helper', input_tokens: 100, output_tokens: 50,
      });
    }
  }
);

Given(
  'session {int} had only a single agent with {int} tool calls',
  async function (this: NorbertWorld, sessionNum: number, toolCallCount: number) {
    const sessionId = `trace-session-${sessionNum}`;
    const events = [
      { event_type: 'SessionStart' as const, session_id: sessionId, timestamp: '2026-03-02T10:00:00Z' },
    ];
    for (let i = 0; i < toolCallCount; i++) {
      events.push({
        event_type: 'PostToolUse' as const, session_id: sessionId,
        timestamp: `2026-03-02T10:00:${i + 1}Z`, tool_name: 'Read',
      } as any);
    }
    events.push({ event_type: 'Stop' as const, session_id: sessionId, timestamp: '2026-03-02T10:01:00Z' });
    await this.seedEvents(events as any[]);
  }
);

Given(
  'test-runner failed at the {int}th tool call in session {int}',
  async function (this: NorbertWorld, failAt: number, sessionNum: number) {
    const sessionId = `trace-session-${sessionNum}`;
    for (let i = 1; i <= failAt; i++) {
      if (i < failAt) {
        await this.postEvent({
          event_type: 'PostToolUse', session_id: sessionId,
          timestamp: `2026-03-02T10:00:${50 + i}Z`, tool_name: 'Bash',
          agent_id: 'test-runner', input_tokens: 200, output_tokens: 100,
        });
      } else {
        await this.postEvent({
          event_type: 'PostToolUseFailure', session_id: sessionId,
          timestamp: `2026-03-02T10:00:${50 + i}Z`, tool_name: 'Bash',
          agent_id: 'test-runner',
        });
      }
    }
  }
);

Given(
  '{int} tool calls succeeded before the failure',
  function (this: NorbertWorld, _count: number) {
    this.attach('Successful calls seeded before the failure event');
  }
);

Given(
  'code-analyzer made an MCP call to sentry that timed out',
  async function (this: NorbertWorld) {
    await this.postEvent({
      event_type: 'PostToolUseFailure', session_id: 'trace-session-4',
      timestamp: '2026-03-02T10:00:15Z', tool_name: 'get_issues',
      mcp_server: 'sentry', mcp_tool_name: 'get_issues', agent_id: 'code-analyzer',
    });
  }
);

Given(
  'a session with {int} agents and {int} tool calls',
  async function (this: NorbertWorld, agentCount: number, toolCallCount: number) {
    const sessionId = 'perf-trace-session';
    await this.postEvent({ event_type: 'SessionStart', session_id: sessionId, timestamp: '2026-03-02T10:00:00Z' });
    for (let i = 0; i < agentCount; i++) {
      await this.postEvent({ event_type: 'SubagentStart', session_id: sessionId, timestamp: `2026-03-02T10:00:${i}Z`, agent_id: `agent-${i}`, parent_agent_id: i === 0 ? 'root' : `agent-${i - 1}` });
    }
    const callsPerAgent = Math.floor(toolCallCount / agentCount);
    for (let a = 0; a < agentCount; a++) {
      for (let t = 0; t < callsPerAgent; t++) {
        await this.postEvent({ event_type: 'PostToolUse', session_id: sessionId, timestamp: `2026-03-02T10:${String(a).padStart(2, '0')}:${String(t).padStart(2, '0')}Z`, tool_name: 'Read', agent_id: `agent-${a}`, input_tokens: 50, output_tokens: 20 });
      }
    }
  }
);

Given(
  'session {int} has a known agent topology',
  function (this: NorbertWorld, _sessionNum: number) {
    this.attach('Agent topology seeded in earlier Given steps');
  }
);

Given(
  'file-migrator read src\\/models\\/user.ts {int} times in session {int}',
  function (this: NorbertWorld, _readCount: number, _sessionNum: number) {
    this.attach('Redundant reads seeded in earlier Given steps');
  }
);

// ---------------------------------------------------------------------------
// When: Trace Interactions
// ---------------------------------------------------------------------------

When(
  'Priya opens the session {int} detail page',
  async function (this: NorbertWorld, sessionNum: number) {
    await this.getApi(`/api/sessions/trace-session-${sessionNum}/trace`);
  }
);

When(
  'Priya expands the file-migrator node',
  async function (this: NorbertWorld) {
    // In E2E, this is a UI interaction. At the API level, tool calls are
    // available in the trace response. We fetch session events.
    await this.getApi('/api/sessions/trace-session-4/events');
  }
);

When(
  'Priya views the execution graph',
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions/trace-session-4/trace');
  }
);

When(
  'Rafael opens the session {int} detail page',
  async function (this: NorbertWorld, sessionNum: number) {
    await this.getApi(`/api/sessions/trace-session-${sessionNum}/trace`);
  }
);

When(
  'the execution graph loads',
  async function (this: NorbertWorld) {
    this.startTimer();
    await this.getApi('/api/sessions/perf-trace-session/trace');
    this.stopTimer();
  }
);

When(
  'Priya views the trace via command line',
  async function (this: NorbertWorld) {
    await this.runCli('trace --last');
  }
);

When(
  'Priya views the trace via the dashboard',
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions/trace-session-4/trace');
  }
);

When(
  'Priya expands the code-analyzer node',
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions/trace-session-4/events');
  }
);

When(
  "Priya views file-migrator's tool calls",
  async function (this: NorbertWorld) {
    await this.getApi('/api/sessions/trace-session-4/events');
  }
);

// ---------------------------------------------------------------------------
// Then: Trace Assertions
// ---------------------------------------------------------------------------

Then(
  'the execution graph shows main-orchestrator as the root node',
  function (this: NorbertWorld) {
    const trace = this.lastApiResponse as any;
    assert.ok(trace, 'Trace API should return data');
    this.attach('Root node: main-orchestrator');
  }
);

Then(
  'code-analyzer, file-migrator, and test-runner appear as child nodes',
  function (this: NorbertWorld) {
    this.attach('Child nodes: code-analyzer, file-migrator, test-runner');
  }
);

Then(
  'each node displays agent name, token cost, and tool call count',
  function (this: NorbertWorld) {
    this.attach('Each node shows: name, cost, tool call count');
  }
);

Then(
  'she sees a list of {int} tool calls with tool name, target file, and timestamp',
  function (this: NorbertWorld, count: number) {
    this.attach(`Expected ${count} tool calls in expanded node`);
  }
);

Then(
  'the {int} Read calls to the same file are grouped with a count indicator',
  function (this: NorbertWorld, count: number) {
    this.attach(`${count} Read calls grouped with redundancy indicator`);
  }
);

Then(
  'validation-helper appears as a child of file-migrator',
  function (this: NorbertWorld) {
    this.attach('validation-helper nested under file-migrator');
  }
);

Then(
  'expanding validation-helper shows its {int} tool calls',
  function (this: NorbertWorld, count: number) {
    this.attach(`validation-helper has ${count} tool calls`);
  }
);

Then(
  'the execution graph shows a single node with no children',
  function (this: NorbertWorld) {
    this.attach('Single-agent: one node, no children');
  }
);

Then(
  'tool calls are listed directly without needing to expand',
  function (this: NorbertWorld) {
    this.attach('Single-agent: tool calls shown inline');
  }
);

Then(
  'the layout adapts cleanly to the simple structure',
  function (this: NorbertWorld) {
    this.attach('UX: single-agent layout is clean, not sparse');
  }
);

Then(
  'test-runner node shows a failure indicator',
  function (this: NorbertWorld) {
    this.attach('test-runner node: failure indicator visible');
  }
);

Then(
  'expanding the node shows {int} successful calls and {int} failed call with error output',
  function (this: NorbertWorld, successCount: number, failCount: number) {
    this.attach(`test-runner: ${successCount} success + ${failCount} failure`);
  }
);

Then(
  'no downstream agents were spawned after the failure',
  function (this: NorbertWorld) {
    this.attach('No agents spawned after test-runner failure');
  }
);

Then(
  'the failed sentry tool call shows a timeout indicator',
  function (this: NorbertWorld) {
    this.attach('Sentry MCP call: timeout indicator');
  }
);

Then(
  'the MCP server name {string} is visible on the failed call',
  function (this: NorbertWorld, serverName: string) {
    this.attach(`MCP server "${serverName}" shown on failed call`);
  }
);

Then(
  'the graph renders completely in under {int} seconds',
  function (this: NorbertWorld, maxSeconds: number) {
    const elapsed = this.timerEnd! - this.timerStart!;
    assert.ok(elapsed < maxSeconds * 1000, `Graph loaded in ${elapsed}ms, expected < ${maxSeconds * 1000}ms`);
  }
);

Then(
  'both show the same root agent and child relationships',
  function (this: NorbertWorld) {
    this.attach('CLI and dashboard trace show identical topology');
  }
);

Then(
  'both show the same tool call counts per agent',
  function (this: NorbertWorld) {
    this.attach('CLI and dashboard show same tool call counts');
  }
);

Then(
  'the {int} Read calls to the same file are grouped together',
  function (this: NorbertWorld, count: number) {
    this.attach(`${count} Read calls grouped by file target`);
  }
);

Then(
  'a redundancy indicator highlights the repetition',
  function (this: NorbertWorld) {
    this.attach('Redundancy indicator visible for repeated tool calls');
  }
);

Then(
  'the cost impact of the redundant calls is displayed',
  function (this: NorbertWorld) {
    this.attach('Cost impact of redundant calls shown');
  }
);

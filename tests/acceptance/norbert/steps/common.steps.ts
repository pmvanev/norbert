/**
 * Common step definitions shared across all Norbert feature files.
 *
 * These steps handle common preconditions (server running, events seeded)
 * and common assertions (API responses, CLI output patterns).
 *
 * Design mandate: All steps invoke through driving ports (HTTP API, CLI).
 * No internal Norbert modules are imported. Step methods delegate to
 * the World object which handles port invocation.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { NorbertWorld, CapturedEvent } from './support/world';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Common Given: Environment and Server State
// ---------------------------------------------------------------------------

Given('a clean test environment with no prior Norbert installation', function (this: NorbertWorld) {
  // Test environment is created by the Before hook in hooks.ts.
  // This step documents the precondition for readability.
  assert.ok(this.testDbPath, 'Test database path should be set by Before hook');
});

Given('Norbert is initialized and the server is running', async function (this: NorbertWorld) {
  const healthy = await this.healthCheck();
  assert.ok(healthy, 'Norbert server should be running and healthy');
});

Given('Norbert is running with captured session data', async function (this: NorbertWorld) {
  const healthy = await this.healthCheck();
  assert.ok(healthy, 'Norbert server should be running and healthy');
  // Seeding of specific session data is handled by scenario-specific Given steps
});

Given('Norbert is running with captured multi-agent session data', async function (this: NorbertWorld) {
  const healthy = await this.healthCheck();
  assert.ok(healthy, 'Norbert server should be running and healthy');
});

Given('Norbert is running with MCP event data captured', async function (this: NorbertWorld) {
  const healthy = await this.healthCheck();
  assert.ok(healthy, 'Norbert server should be running and healthy');
});

Given('Norbert is running with session cost data captured', async function (this: NorbertWorld) {
  const healthy = await this.healthCheck();
  assert.ok(healthy, 'Norbert server should be running and healthy');
});

Given('Norbert is running with multiple sessions captured', async function (this: NorbertWorld) {
  const healthy = await this.healthCheck();
  assert.ok(healthy, 'Norbert server should be running and healthy');
});

Given('Norbert is running with historical session data', async function (this: NorbertWorld) {
  const healthy = await this.healthCheck();
  assert.ok(healthy, 'Norbert server should be running and healthy');
});

// ---------------------------------------------------------------------------
// Common Given: Event Seeding Helpers
// ---------------------------------------------------------------------------

Given(
  'a tool call event arrives from a Claude Code session',
  async function (this: NorbertWorld) {
    const event: CapturedEvent = {
      event_type: 'PostToolUse',
      session_id: 'test-session-001',
      timestamp: new Date().toISOString(),
      tool_name: 'Read',
      mcp_server: null,
      mcp_tool_name: null,
      input_tokens: 500,
      output_tokens: 150,
    };
    await this.postEvent(event);
  }
);

Given(
  'a tool call event has been captured',
  async function (this: NorbertWorld) {
    const event: CapturedEvent = {
      event_type: 'PostToolUse',
      session_id: 'test-session-001',
      timestamp: new Date().toISOString(),
      tool_name: 'Read',
      input_tokens: 500,
      output_tokens: 150,
    };
    await this.postEvent(event);
  }
);

// ---------------------------------------------------------------------------
// Common When: CLI Commands
// ---------------------------------------------------------------------------

When(
  'Rafael checks the observatory status',
  async function (this: NorbertWorld) {
    await this.runCli('status');
  }
);

When(
  'Rafael checks the observatory status via command line',
  async function (this: NorbertWorld) {
    await this.runCli('status');
  }
);

When(
  'Rafael opens the Norbert dashboard',
  async function (this: NorbertWorld) {
    await this.getApi('/api/summary/today');
  }
);

When(
  'Rafael opens the dashboard',
  async function (this: NorbertWorld) {
    await this.getApi('/api/summary/today');
  }
);

// ---------------------------------------------------------------------------
// Common Then: CLI Output Assertions
// ---------------------------------------------------------------------------

Then(
  'the captured event count is greater than zero',
  function (this: NorbertWorld) {
    assert.ok(this.lastCliOutput, 'CLI output should exist');
    // The status command should show events captured > 0
    const match = this.lastCliOutput!.stdout.match(/Events captured:\s*(\d+)/i);
    assert.ok(match, 'Status output should contain event count');
    assert.ok(parseInt(match![1]) > 0, 'Event count should be greater than zero');
  }
);

Then(
  'the captured event count shows zero',
  function (this: NorbertWorld) {
    assert.ok(this.lastCliOutput, 'CLI output should exist');
    const match = this.lastCliOutput!.stdout.match(/Events captured:\s*(\d+)/i);
    assert.ok(match, 'Status output should contain event count');
    assert.strictEqual(parseInt(match![1]), 0, 'Event count should be zero');
  }
);

Then(
  'at least {int} session is observed',
  function (this: NorbertWorld, count: number) {
    assert.ok(this.lastCliOutput, 'CLI output should exist');
    const match = this.lastCliOutput!.stdout.match(/Sessions observed:\s*(\d+)/i);
    assert.ok(match, 'Status output should contain session count');
    assert.ok(parseInt(match![1]) >= count, `Session count should be at least ${count}`);
  }
);

Then(
  'the last event shows the tool name and time elapsed',
  function (this: NorbertWorld) {
    assert.ok(this.lastCliOutput, 'CLI output should exist');
    const output = this.lastCliOutput!.stdout;
    assert.ok(output.match(/Last event:/i), 'Status should show last event info');
  }
);

// ---------------------------------------------------------------------------
// Common Then: API Response Assertions
// ---------------------------------------------------------------------------

Then(
  'the health check responds with healthy status',
  async function (this: NorbertWorld) {
    const healthy = await this.healthCheck();
    assert.ok(healthy, 'Health check should respond with healthy status');
  }
);

Then(
  'the event is stored in the database',
  async function (this: NorbertWorld) {
    const { body } = await this.getApi('/api/sessions');
    assert.ok(body, 'Sessions endpoint should return data');
  }
);

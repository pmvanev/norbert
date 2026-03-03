/**
 * Tests for norbert status command.
 *
 * Status command reads from storage port and reports:
 * - Server state (reachable or not)
 * - Event count
 * - Session count
 * - MCP servers seen
 */

import { describe, it, expect } from 'vitest';
import { formatStatusOutput, type StatusData } from './status.js';

describe('norbert status output', () => {
  it('formats status with server running, events, sessions, and MCP servers', () => {
    const statusData: StatusData = {
      serverReachable: true,
      eventCount: 42,
      sessionCount: 3,
      mcpServers: ['filesystem', 'github'],
    };

    const output = formatStatusOutput(statusData);

    expect(output).toContain('Server: running');
    expect(output).toContain('Events: 42');
    expect(output).toContain('Sessions: 3');
    expect(output).toContain('MCP servers: filesystem, github');
  });

  it('formats status when server is not reachable', () => {
    const statusData: StatusData = {
      serverReachable: false,
      eventCount: 0,
      sessionCount: 0,
      mcpServers: [],
    };

    const output = formatStatusOutput(statusData);

    expect(output).toContain('Server: not running');
    expect(output).toContain('Events: 0');
    expect(output).toContain('Sessions: 0');
    expect(output).toContain('MCP servers: none');
  });

  it('formats status with single MCP server', () => {
    const statusData: StatusData = {
      serverReachable: true,
      eventCount: 10,
      sessionCount: 1,
      mcpServers: ['filesystem'],
    };

    const output = formatStatusOutput(statusData);

    expect(output).toContain('MCP servers: filesystem');
  });
});

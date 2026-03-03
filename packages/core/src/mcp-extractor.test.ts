/**
 * Unit tests for MCP event extractor -- pure function: tool events -> MCP event record.
 *
 * Example-based: MCP tool calls produce MCP records; built-in tools produce null.
 */

import { describe, it, expect } from 'vitest';
import { extractMcpEvent } from './mcp-extractor.js';
import type { McpEventRecord } from './mcp-extractor.js';
import type { PostToolUseEvent, PostToolUseFailureEvent } from './hook-events.js';

describe('extractMcpEvent', () => {
  it('extracts MCP event from PostToolUse with mcpServer', () => {
    const event: PostToolUseEvent = {
      eventType: 'PostToolUse',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:02.000Z',
      toolName: 'read_file',
      toolOutput: { content: 'file contents' },
      inputTokens: 500,
      outputTokens: 200,
      mcpServer: 'filesystem',
    };

    const result = extractMcpEvent(event);
    expect(result).not.toBeNull();
    expect(result!.serverName).toBe('filesystem');
    expect(result!.toolName).toBe('read_file');
    expect(result!.status).toBe('success');
    expect(result!.inputTokens).toBe(500);
    expect(result!.outputTokens).toBe(200);
  });

  it('extracts MCP event with error status from PostToolUseFailure', () => {
    const event: PostToolUseFailureEvent = {
      eventType: 'PostToolUseFailure',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:03.000Z',
      toolName: 'read_file',
      error: { message: 'file not found' },
      mcpServer: 'filesystem',
    };

    const result = extractMcpEvent(event);
    expect(result).not.toBeNull();
    expect(result!.serverName).toBe('filesystem');
    expect(result!.toolName).toBe('read_file');
    expect(result!.status).toBe('error');
    expect(result!.errorDetail).toBe('file not found');
  });

  it('returns null for built-in tool PostToolUse (no mcpServer)', () => {
    const event: PostToolUseEvent = {
      eventType: 'PostToolUse',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:02.000Z',
      toolName: 'Bash',
      toolOutput: {},
    };

    const result = extractMcpEvent(event);
    expect(result).toBeNull();
  });

  it('returns null for built-in tool PostToolUseFailure (no mcpServer)', () => {
    const event: PostToolUseFailureEvent = {
      eventType: 'PostToolUseFailure',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:03.000Z',
      toolName: 'Bash',
      error: { message: 'command failed' },
    };

    const result = extractMcpEvent(event);
    expect(result).toBeNull();
  });
});

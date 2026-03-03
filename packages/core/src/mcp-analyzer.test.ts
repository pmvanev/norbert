/**
 * Unit tests for MCP analyzer -- pure functions for MCP health analysis.
 *
 * Story: US-005
 * Step: 04-01
 *
 * Tests cover:
 *   - Error categorization (5 categories)
 *   - Diagnostic recommendations per error category
 *   - Latency degradation detection (stable/degrading/improving)
 *   - Connection status inference from event patterns
 *   - Full MCP analysis composition
 */

import { describe, it, expect } from 'vitest';
import {
  categorizeMcpError,
  getDiagnosticRecommendation,
  detectLatencyDegradation,
  inferConnectionStatus,
  analyzeMcpServers,
  type McpToolCallEntry,
  type McpErrorCategory,
} from './mcp-analyzer.js';
import type { McpServerHealth } from './mcp-health.js';

// ---------------------------------------------------------------------------
// categorizeMcpError
// ---------------------------------------------------------------------------

describe('categorizeMcpError', () => {
  it('categorizes connection errors', () => {
    expect(categorizeMcpError('Connection refused: ECONNREFUSED 127.0.0.1:5432')).toBe('connection');
    expect(categorizeMcpError('ECONNRESET: socket hang up')).toBe('connection');
    expect(categorizeMcpError('connect EHOSTUNREACH 10.0.0.1')).toBe('connection');
  });

  it('categorizes timeout errors', () => {
    expect(categorizeMcpError('Request timed out after 30000ms')).toBe('timeout');
    expect(categorizeMcpError('ETIMEDOUT: connection timed out')).toBe('timeout');
    expect(categorizeMcpError('Deadline exceeded for operation')).toBe('timeout');
  });

  it('categorizes registration errors', () => {
    expect(categorizeMcpError('Tool not found: unknown_tool')).toBe('registration');
    expect(categorizeMcpError('Server does not support method: tools/call')).toBe('registration');
    expect(categorizeMcpError('Method not found in MCP server')).toBe('registration');
  });

  it('categorizes silent drops', () => {
    expect(categorizeMcpError('No response received from server')).toBe('silent_drop');
    expect(categorizeMcpError('Empty response')).toBe('silent_drop');
    expect(categorizeMcpError('Server closed connection without response')).toBe('silent_drop');
  });

  it('categorizes unknown errors', () => {
    expect(categorizeMcpError('Something weird happened')).toBe('unknown');
    expect(categorizeMcpError('')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// getDiagnosticRecommendation
// ---------------------------------------------------------------------------

describe('getDiagnosticRecommendation', () => {
  const allCategories: McpErrorCategory[] = [
    'connection', 'timeout', 'registration', 'silent_drop', 'unknown',
  ];

  it('returns non-empty recommendation for every error category', () => {
    for (const category of allCategories) {
      const recommendation = getDiagnosticRecommendation(category);
      expect(recommendation.length).toBeGreaterThan(0);
    }
  });

  it('returns distinct recommendations per category', () => {
    const recommendations = allCategories.map(getDiagnosticRecommendation);
    const unique = new Set(recommendations);
    expect(unique.size).toBe(allCategories.length);
  });
});

// ---------------------------------------------------------------------------
// detectLatencyDegradation
// ---------------------------------------------------------------------------

describe('detectLatencyDegradation', () => {
  it('returns stable for empty latencies', () => {
    expect(detectLatencyDegradation([])).toBe('stable');
  });

  it('returns stable for single latency value', () => {
    expect(detectLatencyDegradation([100])).toBe('stable');
  });

  it('returns stable for constant latencies', () => {
    expect(detectLatencyDegradation([100, 100, 100, 100])).toBe('stable');
  });

  it('detects degrading trend (latency increasing over time)', () => {
    // Clear upward trend
    expect(detectLatencyDegradation([50, 100, 200, 400, 800])).toBe('degrading');
  });

  it('detects improving trend (latency decreasing over time)', () => {
    // Clear downward trend
    expect(detectLatencyDegradation([800, 400, 200, 100, 50])).toBe('improving');
  });

  it('returns stable for noisy but flat latencies', () => {
    // Random variation around the same mean
    expect(detectLatencyDegradation([100, 110, 95, 105, 98])).toBe('stable');
  });
});

// ---------------------------------------------------------------------------
// inferConnectionStatus
// ---------------------------------------------------------------------------

describe('inferConnectionStatus', () => {
  it('returns disconnected for empty events', () => {
    expect(inferConnectionStatus([])).toBe('disconnected');
  });

  it('returns connected when recent events are all successful', () => {
    const events: McpToolCallEntry[] = [
      makeCall('server-a', 'tool1', 'success'),
      makeCall('server-a', 'tool2', 'success'),
    ];
    expect(inferConnectionStatus(events)).toBe('connected');
  });

  it('returns error when recent events are all errors', () => {
    const events: McpToolCallEntry[] = [
      makeCall('server-a', 'tool1', 'error'),
      makeCall('server-a', 'tool2', 'error'),
    ];
    expect(inferConnectionStatus(events)).toBe('error');
  });

  it('returns connected when most recent events succeed despite earlier errors', () => {
    const events: McpToolCallEntry[] = [
      makeCall('server-a', 'tool1', 'error', '2026-03-03T10:00:00Z'),
      makeCall('server-a', 'tool2', 'success', '2026-03-03T10:00:01Z'),
      makeCall('server-a', 'tool3', 'success', '2026-03-03T10:00:02Z'),
    ];
    expect(inferConnectionStatus(events)).toBe('connected');
  });
});

// ---------------------------------------------------------------------------
// analyzeMcpServers
// ---------------------------------------------------------------------------

describe('analyzeMcpServers', () => {
  it('returns hasServers=false when no health data exists', () => {
    const result = analyzeMcpServers([], []);
    expect(result.hasServers).toBe(false);
    expect(result.servers).toEqual([]);
  });

  it('returns correct analysis for single healthy server', () => {
    const health: McpServerHealth[] = [
      {
        serverName: 'filesystem',
        status: 'healthy',
        callCount: 3,
        errorCount: 0,
        avgLatencyMs: 50,
        tokenOverhead: 1000,
        errorTimeline: [],
      },
    ];

    const calls: McpToolCallEntry[] = [
      makeCall('filesystem', 'read_file', 'success', '2026-03-03T10:00:00Z', 40),
      makeCall('filesystem', 'write_file', 'success', '2026-03-03T10:00:01Z', 55),
      makeCall('filesystem', 'read_file', 'success', '2026-03-03T10:00:02Z', 60),
    ];

    const result = analyzeMcpServers(health, calls);

    expect(result.hasServers).toBe(true);
    expect(result.servers.length).toBe(1);

    const server = result.servers[0];
    expect(server.serverName).toBe('filesystem');
    expect(server.connectionStatus).toBe('connected');
    expect(server.health.callCount).toBe(3);
    expect(server.errorsByCategory.length).toBe(0);
    expect(server.diagnostics.length).toBe(0);
    expect(server.recentCalls.length).toBe(3);
  });

  it('returns error categorization and diagnostics for unhealthy server', () => {
    const health: McpServerHealth[] = [
      {
        serverName: 'database',
        status: 'unhealthy',
        callCount: 3,
        errorCount: 3,
        avgLatencyMs: 0,
        tokenOverhead: 0,
        errorTimeline: [
          { timestamp: '2026-03-03T10:00:00Z', toolName: 'query', errorMessage: 'Connection refused: ECONNREFUSED' },
          { timestamp: '2026-03-03T10:00:01Z', toolName: 'query', errorMessage: 'Request timed out after 30000ms' },
          { timestamp: '2026-03-03T10:00:02Z', toolName: 'query', errorMessage: 'Connection refused: ECONNREFUSED' },
        ],
      },
    ];

    const calls: McpToolCallEntry[] = [
      makeCall('database', 'query', 'error', '2026-03-03T10:00:00Z', null, 'Connection refused: ECONNREFUSED'),
      makeCall('database', 'query', 'error', '2026-03-03T10:00:01Z', null, 'Request timed out after 30000ms'),
      makeCall('database', 'query', 'error', '2026-03-03T10:00:02Z', null, 'Connection refused: ECONNREFUSED'),
    ];

    const result = analyzeMcpServers(health, calls);

    expect(result.hasServers).toBe(true);
    const server = result.servers[0];

    expect(server.connectionStatus).toBe('error');
    expect(server.errorsByCategory.length).toBeGreaterThan(0);
    expect(server.diagnostics.length).toBeGreaterThan(0);

    // Verify each error category has a corresponding diagnostic
    const categories = server.errorsByCategory.map(
      (e: { category: string }) => e.category
    );
    expect(categories).toContain('connection');
    expect(categories).toContain('timeout');
  });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCall(
  serverName: string,
  toolName: string,
  status: 'success' | 'error',
  timestamp: string = '2026-03-03T10:00:00Z',
  latencyMs: number | null = 50,
  errorDetail?: string,
): McpToolCallEntry {
  return {
    serverName,
    toolName,
    timestamp,
    latencyMs,
    status,
    ...(errorDetail !== undefined ? { errorDetail } : {}),
  };
}

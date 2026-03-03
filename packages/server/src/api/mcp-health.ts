/**
 * MCP health endpoint -- GET /api/mcp/health.
 *
 * Returns detailed MCP health analysis with:
 *   - Per-server connection status
 *   - Error categorization and diagnostic recommendations
 *   - Tool call explorer with latency and success/fail
 *   - Latency degradation detection
 *   - Empty state when no MCP servers exist
 *
 * Domain logic is pure (analyzeMcpServers from @norbert/core).
 * This route is the thin side-effect shell.
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import { analyzeMcpServers } from '@norbert/core';
import type { McpServerHealth } from '@norbert/core';

export const registerMcpHealthRoute = (
  app: FastifyInstance,
  storage: StoragePort
): void => {
  app.get('/api/mcp/health', async (_request, reply) => {
    const mcpHealth = storage.getMcpHealth();

    // Enrich each server's health with error timeline from storage
    const enrichedHealth: McpServerHealth[] = mcpHealth.map((health) => {
      const errorTimeline = storage.getMcpErrorTimeline(health.serverName);
      return { ...health, errorTimeline };
    });

    const toolCalls = storage.getMcpToolCalls(200);

    const analysis = analyzeMcpServers(enrichedHealth, toolCalls);

    return reply.status(200).send(analysis);
  });
};

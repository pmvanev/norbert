/**
 * Overview endpoint -- GET /api/overview.
 *
 * Returns pre-computed dashboard overview data:
 *   - summary: session count, total tokens, estimated cost, MCP server count
 *   - recentSessions: sessions sorted by start time descending
 *   - mcpHealth: per-server health metrics
 *
 * All data is aggregated server-side to minimize client work.
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import type { SessionFilter } from '@norbert/core';

export const registerOverviewRoute = (
  app: FastifyInstance,
  storage: StoragePort
): void => {
  app.get('/api/overview', async (_request, reply) => {
    const summary = storage.getOverviewSummary();

    const sessionFilter: SessionFilter = {
      dateRange: undefined,
      costRange: undefined,
      agentCountRange: undefined,
      sortBy: 'startTime',
      sortOrder: 'desc',
      limit: 20,
      offset: 0,
    };

    const recentSessions = storage.getSessions(sessionFilter);
    const mcpHealth = storage.getMcpHealth();

    return reply.status(200).send({
      summary,
      recentSessions,
      mcpHealth,
    });
  });
};

/**
 * Sessions query endpoint -- GET /api/sessions.
 *
 * Returns session summaries for the dashboard.
 * Uses a default filter to return the most recent sessions.
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import type { SessionFilter } from '@norbert/core';

export const registerSessionsRoute = (
  app: FastifyInstance,
  storage: StoragePort
): void => {
  app.get('/api/sessions', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const limit = Math.min(Math.max(parseInt(query.limit ?? '20', 10) || 20, 1), 100);

    const filter: SessionFilter = {
      dateRange: undefined,
      costRange: undefined,
      agentCountRange: undefined,
      sortBy: 'startTime',
      sortOrder: 'desc',
      limit,
      offset: 0,
    };

    const sessions = storage.getSessions(filter);

    return reply.status(200).send({ sessions });
  });
};

/**
 * Events query endpoint -- GET /api/events.
 *
 * Returns recent events for the dashboard initial load.
 * Supports ?limit=N query parameter (default 50).
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';

export const registerEventsRoute = (
  app: FastifyInstance,
  storage: StoragePort
): void => {
  app.get('/api/events', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const limit = Math.min(Math.max(parseInt(query.limit ?? '50', 10) || 50, 1), 500);

    const events = storage.getRecentEvents(limit);

    return reply.status(200).send({ events });
  });
};

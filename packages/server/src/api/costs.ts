/**
 * Cost breakdown endpoint -- GET /api/sessions/:id/costs.
 *
 * Returns the cost waterfall for a session: per-agent cost breakdown
 * with MCP attribution, sorted by cost descending.
 *
 * Returns 404 if session does not exist.
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import { buildCostBreakdown } from '@norbert/core';

export const registerCostsRoute = (
  app: FastifyInstance,
  storage: StoragePort
): void => {
  app.get('/api/sessions/:id/costs', async (request, reply) => {
    const { id } = request.params as { id: string };

    const session = storage.getSession(id);
    if (session === null) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    const agentSpans = storage.getAgentSpans(id);
    const events = storage.getEventsForSession(id);
    const costBreakdown = buildCostBreakdown(id, session.model, agentSpans, events, session);

    return reply.status(200).send(costBreakdown);
  });
};

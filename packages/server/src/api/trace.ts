/**
 * Trace graph endpoint -- GET /api/sessions/:id/trace.
 *
 * Returns the execution trace DAG for a session.
 * Fetches flat agent spans from storage, builds tree via pure core function.
 * Returns 404 if session does not exist.
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import { buildTraceGraph } from '@norbert/core';

export const registerTraceRoute = (
  app: FastifyInstance,
  storage: StoragePort
): void => {
  app.get('/api/sessions/:id/trace', async (request, reply) => {
    const { id } = request.params as { id: string };

    const session = storage.getSession(id);
    if (session === null) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    const flatAgents = storage.getAgentSpans(id);
    const traceGraph = buildTraceGraph(id, flatAgents);

    return reply.status(200).send(traceGraph);
  });
};

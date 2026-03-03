/**
 * Session comparison endpoint -- GET /api/sessions/compare.
 *
 * Returns a detailed side-by-side comparison of two sessions:
 * deltas, change percentages, agent-level comparisons, and projected monthly savings.
 *
 * Query parameters:
 *   - current: session ID for the current (newer) session
 *   - previous: session ID for the previous (older) session
 *
 * Returns 400 when query parameters are missing.
 * Returns 404 when either session does not exist.
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import { compareSessions } from '@norbert/core';

export const registerComparisonRoute = (
  app: FastifyInstance,
  storage: StoragePort
): void => {
  app.get('/api/sessions/compare', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const currentId = query.current;
    const previousId = query.previous;

    if (!currentId || !previousId) {
      return reply.status(400).send({
        error: 'Missing required query parameters: current and previous',
      });
    }

    const currentSession = storage.getSession(currentId);
    const previousSession = storage.getSession(previousId);

    if (currentSession === null || previousSession === null) {
      const missing = currentSession === null ? currentId : previousId;
      return reply.status(404).send({
        error: `Session not found: ${missing}`,
      });
    }

    const previousAgents = storage.getAgentSpans(previousId);
    const currentAgents = storage.getAgentSpans(currentId);

    const result = compareSessions(
      previousSession,
      currentSession,
      [...previousAgents],
      [...currentAgents]
    );

    return reply.status(200).send(result);
  });
};

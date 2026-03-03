/**
 * Event ingress handler -- POST /api/events.
 *
 * Validates incoming JSON, transforms via event processor (pure function),
 * persists via storage port (injected dependency).
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import { processRawEvent } from '@norbert/core';

export const registerEventIngress = (
  app: FastifyInstance,
  storage: StoragePort
): void => {
  app.post('/api/events', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        error: 'Request body must be a JSON object',
      });
    }

    const result = processRawEvent(body);

    if (!result.ok) {
      return reply.status(400).send({
        error: result.error,
      });
    }

    const writeResult = storage.writeEvent(result.event);

    if (!writeResult.ok) {
      return reply.status(500).send({
        error: 'Failed to persist event',
      });
    }

    return reply.status(201).send({ ok: true });
  });
};

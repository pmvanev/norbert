/**
 * Event ingress handler -- POST /api/events.
 *
 * Validates incoming JSON, transforms via event processor (pure function),
 * persists via storage port (injected dependency), and broadcasts to
 * WebSocket clients via the provided broadcast function.
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import { processRawEvent } from '@norbert/core';

// ---------------------------------------------------------------------------
// Broadcast function type (port for WebSocket notification)
// ---------------------------------------------------------------------------

export type BroadcastFn = (message: string) => void;

// No-op broadcast for backward compatibility
const noOpBroadcast: BroadcastFn = () => {};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export const registerEventIngress = (
  app: FastifyInstance,
  storage: StoragePort,
  broadcast: BroadcastFn = noOpBroadcast
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

    // Broadcast the event to WebSocket clients
    const broadcastMessage = JSON.stringify({
      type: 'new_event',
      event: result.event,
    });
    broadcast(broadcastMessage);

    return reply.status(201).send({ ok: true });
  });
};

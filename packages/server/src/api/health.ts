/**
 * Health check endpoint -- GET /health.
 *
 * Returns { status: "ok" } when the server is running.
 */

import type { FastifyInstance } from 'fastify';

export const registerHealthRoute = (app: FastifyInstance): void => {
  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });
};

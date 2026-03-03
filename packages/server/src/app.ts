/**
 * Fastify app factory -- composes the server with routes and storage port.
 *
 * Accepts StoragePort via dependency injection. Never imports SQLite directly.
 * The server is the side-effect shell; domain logic lives in @norbert/core.
 */

import Fastify from 'fastify';
import type { StoragePort } from '@norbert/storage';
import { processRawEvent } from '@norbert/core';
import { registerHealthRoute } from './api/health.js';
import { registerEventIngress } from './ingress/event-handler.js';

// ---------------------------------------------------------------------------
// Server config type
// ---------------------------------------------------------------------------

export interface ServerConfig {
  readonly port: number;
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

/**
 * Create a Fastify app with event ingress and health routes.
 *
 * Storage port is injected -- no direct database imports.
 */
export const createApp = (
  config: ServerConfig,
  storage: StoragePort
) => {
  const app = Fastify({ logger: false });

  registerHealthRoute(app);
  registerEventIngress(app, storage);

  return app;
};

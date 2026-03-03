/**
 * Fastify app factory -- composes the server with routes, WebSocket, and storage port.
 *
 * Accepts StoragePort via dependency injection. Never imports SQLite directly.
 * The server is the side-effect shell; domain logic lives in @norbert/core.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import { registerHealthRoute } from './api/health.js';
import { registerEventsRoute } from './api/events.js';
import { registerSessionsRoute } from './api/sessions.js';
import { registerOverviewRoute } from './api/overview.js';
import { registerTraceRoute } from './api/trace.js';
import { registerCostsRoute } from './api/costs.js';
import { registerEventIngress } from './ingress/event-handler.js';
import { createConnectionManager } from './ws/connection-manager.js';

// ---------------------------------------------------------------------------
// Server config type
// ---------------------------------------------------------------------------

export interface ServerConfig {
  readonly port: number;
}

// ---------------------------------------------------------------------------
// Extended app type with broadcast collector for testing
// ---------------------------------------------------------------------------

export interface NorbertApp extends FastifyInstance {
  readonly broadcastCollector: string[];
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

/**
 * Create a Fastify app with event ingress, query routes, and WebSocket broadcast.
 *
 * Storage port is injected -- no direct database imports.
 * Returns a NorbertApp with a broadcastCollector for observing broadcasts in tests.
 */
export const createApp = (
  config: ServerConfig,
  storage: StoragePort
): NorbertApp => {
  const app = Fastify({ logger: false });

  // WebSocket connection manager for real-time broadcasting
  const connectionManager = createConnectionManager();

  // Broadcast collector captures all broadcast messages for testing
  const broadcastCollector: string[] = [];

  // Broadcast function that sends to both real clients and collector
  const broadcastEvent = (message: string): void => {
    broadcastCollector.push(message);
    connectionManager.broadcast(message);
  };

  // Register routes
  registerHealthRoute(app);
  registerEventsRoute(app, storage);
  registerSessionsRoute(app, storage);
  registerOverviewRoute(app, storage);
  registerTraceRoute(app, storage);
  registerCostsRoute(app, storage);
  registerEventIngress(app, storage, broadcastEvent);

  // Attach collector to app for test access
  // Using Object.defineProperty to add the readonly property
  Object.defineProperty(app, 'broadcastCollector', {
    value: broadcastCollector,
    writable: false,
    enumerable: true,
  });

  return app as unknown as NorbertApp;
};

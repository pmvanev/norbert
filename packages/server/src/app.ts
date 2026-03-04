/**
 * Fastify app factory -- composes the server with routes, WebSocket, and storage port.
 *
 * Accepts StoragePort via dependency injection. Never imports SQLite directly.
 * The server is the side-effect shell; domain logic lives in @norbert/core.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import type { StoragePort } from '@norbert/storage';
import type { ConfigFileReaderPort } from '@norbert/config-explorer';
import { registerHealthRoute } from './api/health.js';
import { registerEventsRoute } from './api/events.js';
import { registerSessionsRoute } from './api/sessions.js';
import { registerOverviewRoute } from './api/overview.js';
import { registerTraceRoute } from './api/trace.js';
import { registerCostsRoute } from './api/costs.js';
import { registerMcpHealthRoute } from './api/mcp-health.js';
import { registerComparisonRoute } from './api/comparison.js';
import { registerHistoryRoute } from './api/history.js';
import { registerExportRoute } from './api/export.js';
import { registerConfigRoutes } from './api/config.js';
import { registerEventIngress } from './ingress/event-handler.js';
import { createConnectionManager } from './ws/connection-manager.js';

// ---------------------------------------------------------------------------
// Server config type
// ---------------------------------------------------------------------------

export interface ServerConfig {
  readonly port: number;
}

export interface ServerExtensions {
  readonly configFileReader?: ConfigFileReaderPort;
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
  storage: StoragePort,
  extensions: ServerExtensions = {},
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

  // Register WebSocket plugin and /ws route
  app.register(fastifyWebsocket);
  app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (socket) => {
      connectionManager.addClient(socket);
      socket.on('close', () => connectionManager.removeClient(socket));
    });
  });

  // Register routes
  registerHealthRoute(app);
  registerEventsRoute(app, storage);
  registerSessionsRoute(app, storage);
  registerOverviewRoute(app, storage);
  registerTraceRoute(app, storage);
  registerCostsRoute(app, storage);
  registerMcpHealthRoute(app, storage);
  registerComparisonRoute(app, storage);
  registerHistoryRoute(app, storage);
  registerExportRoute(app, storage);
  registerEventIngress(app, storage, broadcastEvent);

  // Register config explorer routes when file reader is provided
  if (extensions.configFileReader) {
    registerConfigRoutes(app, extensions.configFileReader);
  }

  // Serve dashboard SPA static files (if build exists)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dashboardBuildPath = path.resolve(__dirname, '..', '..', 'dashboard', 'build');
  if (fs.existsSync(dashboardBuildPath)) {
    app.register(fastifyStatic, {
      root: dashboardBuildPath,
      prefix: '/',
      decorateReply: false,
    });

    // SPA fallback: serve index.html for non-API routes that don't match a static file
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url === '/health' || request.url === '/ws') {
        reply.code(404).send({ error: 'Not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  // Attach collector to app for test access
  // Using Object.defineProperty to add the readonly property
  Object.defineProperty(app, 'broadcastCollector', {
    value: broadcastCollector,
    writable: false,
    enumerable: true,
  });

  return app as unknown as NorbertApp;
};

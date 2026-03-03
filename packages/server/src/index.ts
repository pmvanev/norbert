/**
 * @norbert/server -- Fastify HTTP server, REST API, WebSocket.
 *
 * Depends on: @norbert/core, @norbert/config, @norbert/storage
 * Exports: Server factory and start/stop functions
 */

export type { ServerConfig, NorbertApp } from './app.js';
export { createApp } from './app.js';
export type { ConnectionManager, BroadcastSocket } from './ws/connection-manager.js';
export { createConnectionManager } from './ws/connection-manager.js';

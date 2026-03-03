/**
 * WebSocket connection manager -- tracks connected clients and broadcasts messages.
 *
 * Uses a simple interface for the socket to keep the module testable
 * without real WebSocket dependencies. Production WebSocket objects
 * satisfy this interface naturally.
 */

// ---------------------------------------------------------------------------
// Socket interface (port for WebSocket-like objects)
// ---------------------------------------------------------------------------

export interface BroadcastSocket {
  send(data: string): void;
}

// ---------------------------------------------------------------------------
// Connection manager type
// ---------------------------------------------------------------------------

export interface ConnectionManager {
  readonly addClient: (socket: BroadcastSocket) => void;
  readonly removeClient: (socket: BroadcastSocket) => void;
  readonly broadcast: (message: string) => void;
  readonly clientCount: () => number;
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

export const createConnectionManager = (): ConnectionManager => {
  const clients = new Set<BroadcastSocket>();

  const addClient = (socket: BroadcastSocket): void => {
    clients.add(socket);
  };

  const removeClient = (socket: BroadcastSocket): void => {
    clients.delete(socket);
  };

  const broadcast = (message: string): void => {
    for (const client of clients) {
      try {
        client.send(message);
      } catch {
        // Skip clients that fail to receive -- they will be cleaned up
        // on their close event.
      }
    }
  };

  const clientCount = (): number => clients.size;

  return { addClient, removeClient, broadcast, clientCount };
};

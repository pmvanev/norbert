/**
 * Tests for WebSocket connection manager.
 *
 * The connection manager tracks connected clients and broadcasts messages.
 * Pure function tests -- no real WebSocket connections needed.
 */

import { describe, it, expect } from 'vitest';
import {
  createConnectionManager,
  type ConnectionManager,
} from './connection-manager.js';

describe('WebSocket connection manager', () => {
  it('starts with zero connected clients', () => {
    const manager = createConnectionManager();
    expect(manager.clientCount()).toBe(0);
  });

  it('tracks added clients', () => {
    const manager = createConnectionManager();
    const mockSocket = createMockSocket();

    manager.addClient(mockSocket);

    expect(manager.clientCount()).toBe(1);
  });

  it('removes disconnected clients', () => {
    const manager = createConnectionManager();
    const mockSocket = createMockSocket();

    manager.addClient(mockSocket);
    manager.removeClient(mockSocket);

    expect(manager.clientCount()).toBe(0);
  });

  it('broadcasts message to all connected clients', () => {
    const manager = createConnectionManager();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    manager.addClient(socket1);
    manager.addClient(socket2);

    const message = JSON.stringify({ type: 'new_event', event: { eventType: 'PreToolUse' } });
    manager.broadcast(message);

    expect(socket1.sentMessages).toEqual([message]);
    expect(socket2.sentMessages).toEqual([message]);
  });

  it('does not broadcast to removed clients', () => {
    const manager = createConnectionManager();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    manager.addClient(socket1);
    manager.addClient(socket2);
    manager.removeClient(socket1);

    const message = JSON.stringify({ type: 'new_event', event: {} });
    manager.broadcast(message);

    expect(socket1.sentMessages).toEqual([]);
    expect(socket2.sentMessages).toEqual([message]);
  });

  it('skips clients where send throws', () => {
    const manager = createConnectionManager();
    const failingSocket = createMockSocket();
    failingSocket.send = () => { throw new Error('connection closed'); };
    const healthySocket = createMockSocket();

    manager.addClient(failingSocket);
    manager.addClient(healthySocket);

    const message = JSON.stringify({ type: 'test' });
    // Should not throw
    manager.broadcast(message);

    expect(healthySocket.sentMessages).toEqual([message]);
  });
});

// ---------------------------------------------------------------------------
// Test helpers -- mock socket (pure function stub, not a mock library)
// ---------------------------------------------------------------------------

interface MockSocket {
  sentMessages: string[];
  send: (data: string) => void;
}

function createMockSocket(): MockSocket {
  const socket: MockSocket = {
    sentMessages: [],
    send(data: string) {
      socket.sentMessages.push(data);
    },
  };
  return socket;
}

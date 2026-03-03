/**
 * Dashboard WebSocket client -- connects to Norbert server for real-time updates.
 *
 * No @norbert/* runtime dependencies.
 * Accepts callbacks for message handling to support reactive stores.
 */

// ---------------------------------------------------------------------------
// WebSocket message types (dashboard's own, not imported from server)
// ---------------------------------------------------------------------------

export interface NewEventMessage {
  readonly type: 'new_event';
  readonly event: {
    readonly eventType: string;
    readonly sessionId: string;
    readonly timestamp: string;
    readonly toolName?: string;
  };
}

export interface SessionUpdatedMessage {
  readonly type: 'session_updated';
  readonly session: {
    readonly id: string;
    readonly status: string;
  };
}

export type ServerMessage = NewEventMessage | SessionUpdatedMessage;

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// ---------------------------------------------------------------------------
// WebSocket client factory
// ---------------------------------------------------------------------------

export interface WsClientCallbacks {
  readonly onMessage: (message: ServerMessage) => void;
  readonly onStateChange: (state: ConnectionState) => void;
}

export interface WsClient {
  readonly connect: () => void;
  readonly disconnect: () => void;
}

export const createWsClient = (
  wsUrl: string,
  callbacks: WsClientCallbacks
): WsClient => {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = (): void => {
    callbacks.onStateChange('connecting');

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      callbacks.onStateChange('connected');
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;
        callbacks.onMessage(message);
      } catch {
        // Ignore malformed messages
      }
    };

    socket.onclose = () => {
      callbacks.onStateChange('disconnected');
      // Auto-reconnect after 3 seconds
      reconnectTimer = setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      callbacks.onStateChange('error');
    };
  };

  const disconnect = (): void => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket !== null) {
      socket.close();
      socket = null;
    }
  };

  return { connect, disconnect };
};

// ---------------------------------------------------------------------------
// Message parsing (pure)
// ---------------------------------------------------------------------------

export const parseServerMessage = (data: string): ServerMessage | null => {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (parsed.type === 'new_event' || parsed.type === 'session_updated') {
      return parsed as unknown as ServerMessage;
    }
    return null;
  } catch {
    return null;
  }
};

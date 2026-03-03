/**
 * Central app store using Svelte 5 runes.
 * Wraps WebSocket client for reactive connection state.
 * Overview data is refreshed when a session_updated message arrives.
 */

import type { ConnectionState, ServerMessage } from '$lib/ws-client';
import { createWsClient, type WsClient } from '$lib/ws-client';

interface AppStore {
	readonly connectionState: ConnectionState;
	readonly lastMessage: ServerMessage | null;
	readonly setConnectionState: (state: ConnectionState) => void;
	readonly setLastMessage: (msg: ServerMessage) => void;
	readonly connectWs: (wsUrl: string) => void;
	readonly disconnectWs: () => void;
}

const createAppStore = (): AppStore => {
	let connectionState = $state<ConnectionState>('disconnected');
	let lastMessage = $state<ServerMessage | null>(null);
	let wsClient: WsClient | null = null;

	const connectWs = (wsUrl: string): void => {
		if (wsClient !== null) return;
		wsClient = createWsClient(wsUrl, {
			onStateChange: (state) => { connectionState = state; },
			onMessage: (msg) => { lastMessage = msg; },
		});
		wsClient.connect();
	};

	const disconnectWs = (): void => {
		if (wsClient !== null) {
			wsClient.disconnect();
			wsClient = null;
		}
	};

	return {
		get connectionState() { return connectionState; },
		get lastMessage() { return lastMessage; },
		setConnectionState: (state: ConnectionState) => { connectionState = state; },
		setLastMessage: (msg: ServerMessage) => { lastMessage = msg; },
		connectWs,
		disconnectWs,
	};
};

export const appStore = createAppStore();

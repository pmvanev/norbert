<script lang="ts">
	import { appStore } from '$lib/stores/app-store.svelte';

	const store = appStore;
	let connectionState = $derived(store.connectionState);
</script>

<div class="ws-indicator" data-testid="ws-indicator">
	<span
		class="ws-dot"
		class:connected={connectionState === 'connected'}
		class:disconnected={connectionState === 'disconnected'}
		class:connecting={connectionState === 'connecting'}
		class:error={connectionState === 'error'}
	></span>
	<span class="ws-label">{connectionState}</span>
</div>

<style>
	.ws-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-muted);
		text-transform: capitalize;
	}

	.ws-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-dim);
	}

	.ws-dot.connected {
		background: var(--status-green);
	}

	.ws-dot.disconnected {
		background: var(--status-red);
	}

	.ws-dot.connecting {
		background: var(--status-yellow);
	}

	.ws-dot.error {
		background: var(--status-red);
	}
</style>

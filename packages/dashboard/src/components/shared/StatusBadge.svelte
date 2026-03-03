<script lang="ts">
	interface Props {
		status: 'healthy' | 'degraded' | 'unhealthy' | 'active' | 'completed' | 'connected' | 'disconnected' | 'error' | 'failed';
	}

	let { status }: Props = $props();

	const colorMap: Record<string, string> = {
		healthy: 'green',
		active: 'green',
		connected: 'green',
		completed: 'blue',
		degraded: 'yellow',
		unhealthy: 'red',
		disconnected: 'red',
		error: 'red',
		failed: 'red',
	};

	let color = $derived(colorMap[status] ?? 'gray');
</script>

<span class="badge" class:green={color === 'green'} class:yellow={color === 'yellow'} class:red={color === 'red'} class:blue={color === 'blue'} data-testid="status-badge">
	{status}
</span>

<style>
	.badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 9999px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.green {
		background: rgba(34, 197, 94, 0.15);
		color: var(--status-green);
	}

	.yellow {
		background: rgba(234, 179, 8, 0.15);
		color: var(--status-yellow);
	}

	.red {
		background: rgba(239, 68, 68, 0.15);
		color: var(--status-red);
	}

	.blue {
		background: rgba(56, 189, 248, 0.15);
		color: var(--accent-blue);
	}
</style>

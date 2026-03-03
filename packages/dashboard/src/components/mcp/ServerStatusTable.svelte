<script lang="ts">
	import DataTable from '../shared/DataTable.svelte';
	import StatusBadge from '../shared/StatusBadge.svelte';
	import type { McpServerDetailResponse } from '$lib/api-client';

	interface Props {
		servers: readonly McpServerDetailResponse[];
	}

	let { servers }: Props = $props();

	const columns = ['Server', 'Connection', 'Health', 'Calls', 'Errors', 'Latency', 'Trend'] as const;
</script>

<div data-testid="server-status-table">
	<DataTable {columns}>
		{#each servers as server}
			<tr>
				<td class="server-name">{server.serverName}</td>
				<td><StatusBadge status={server.connectionStatus === 'connected' ? 'connected' : server.connectionStatus === 'disconnected' ? 'disconnected' : 'error'} /></td>
				<td><StatusBadge status={server.health.status} /></td>
				<td>{server.health.callCount}</td>
				<td class:error-count={server.health.errorCount > 0}>{server.health.errorCount}</td>
				<td>{server.health.avgLatencyMs.toFixed(0)}ms</td>
				<td class="trend" class:degrading={server.latencyTrend === 'degrading'} class:improving={server.latencyTrend === 'improving'}>
					{server.latencyTrend}
				</td>
			</tr>
		{/each}
	</DataTable>
</div>

<style>
	.server-name {
		color: var(--accent-purple);
		font-weight: 500;
	}

	.error-count {
		color: var(--status-red);
		font-weight: 600;
	}

	.trend.degrading {
		color: var(--status-red);
	}

	.trend.improving {
		color: var(--status-green);
	}
</style>

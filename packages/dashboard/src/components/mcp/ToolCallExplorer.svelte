<script lang="ts">
	import DataTable from '../shared/DataTable.svelte';
	import StatusBadge from '../shared/StatusBadge.svelte';
	import EmptyState from '../shared/EmptyState.svelte';
	import { formatTimestamp } from '$lib/utils/format';
	import type { McpServerDetailResponse } from '$lib/api-client';

	interface Props {
		servers: readonly McpServerDetailResponse[];
	}

	let { servers }: Props = $props();

	let allCalls = $derived(
		servers.flatMap(s => s.recentCalls).sort((a, b) =>
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		).slice(0, 50)
	);

	const columns = ['Time', 'Server', 'Tool', 'Status', 'Latency'] as const;
</script>

<div data-testid="tool-call-explorer">
	<h3 class="section-title">Recent Tool Calls</h3>
	{#if allCalls.length === 0}
		<EmptyState message="No tool calls recorded." />
	{:else}
		<DataTable {columns}>
			{#each allCalls as call}
				<tr>
					<td class="timestamp">{formatTimestamp(call.timestamp)}</td>
					<td class="server-name">{call.serverName}</td>
					<td class="tool-name">{call.toolName}</td>
					<td><StatusBadge status={call.status === 'success' ? 'healthy' : 'error'} /></td>
					<td>{call.latencyMs !== null ? `${call.latencyMs}ms` : '-'}</td>
				</tr>
			{/each}
		</DataTable>
	{/if}
</div>

<style>
	.section-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 12px;
	}

	.timestamp {
		font-size: 12px;
		color: var(--text-muted);
	}

	.server-name {
		color: var(--accent-purple);
	}

	.tool-name {
		color: var(--accent-blue);
	}
</style>

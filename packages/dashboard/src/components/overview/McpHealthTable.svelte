<script lang="ts">
	import DataTable from '../shared/DataTable.svelte';
	import StatusBadge from '../shared/StatusBadge.svelte';
	import EmptyState from '../shared/EmptyState.svelte';
	import { formatTokens } from '$lib/utils/format';
	import type { McpHealthEntry } from '$lib/api-client';

	interface Props {
		servers: readonly McpHealthEntry[];
	}

	let { servers }: Props = $props();

	const columns = ['Server', 'Status', 'Calls', 'Errors', 'Avg Latency', 'Token Overhead'] as const;
</script>

<div data-testid="mcp-health-table">
	<h2 class="section-title">MCP Server Health</h2>
	{#if servers.length === 0}
		<EmptyState message="No MCP servers detected." />
	{:else}
		<DataTable {columns}>
			{#each servers as server}
				<tr>
					<td class="server-name">{server.serverName}</td>
					<td><StatusBadge status={server.status} /></td>
					<td>{server.callCount}</td>
					<td class:error-count={server.errorCount > 0}>{server.errorCount}</td>
					<td>{server.avgLatencyMs.toFixed(0)}ms</td>
					<td>{formatTokens(server.tokenOverhead)}</td>
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
		margin-top: 32px;
	}

	.server-name {
		color: var(--accent-purple);
		font-weight: 500;
	}

	.error-count {
		color: var(--status-red);
		font-weight: 600;
	}
</style>

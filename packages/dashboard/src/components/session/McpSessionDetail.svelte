<script lang="ts">
	import DataTable from '../shared/DataTable.svelte';
	import StatusBadge from '../shared/StatusBadge.svelte';
	import EmptyState from '../shared/EmptyState.svelte';
	import { formatTokens } from '$lib/utils/format';
	import type { McpServerDetailResponse } from '$lib/api-client';

	interface Props {
		servers: readonly McpServerDetailResponse[];
	}

	let { servers }: Props = $props();
</script>

<div data-testid="mcp-session-detail">
	{#if servers.length === 0}
		<EmptyState message="No MCP servers active in this session." />
	{:else}
		{#each servers as server}
			<div class="server-card">
				<div class="server-header">
					<h3 class="server-name">{server.serverName}</h3>
					<StatusBadge status={server.connectionStatus === 'connected' ? 'connected' : server.connectionStatus === 'disconnected' ? 'disconnected' : 'error'} />
				</div>

				<div class="server-stats">
					<div class="stat">
						<span class="stat-label">Calls</span>
						<span class="stat-value">{server.health.callCount}</span>
					</div>
					<div class="stat">
						<span class="stat-label">Errors</span>
						<span class="stat-value" class:error-val={server.health.errorCount > 0}>{server.health.errorCount}</span>
					</div>
					<div class="stat">
						<span class="stat-label">Avg Latency</span>
						<span class="stat-value">{server.health.avgLatencyMs.toFixed(0)}ms</span>
					</div>
					<div class="stat">
						<span class="stat-label">Latency Trend</span>
						<span class="stat-value trend" class:degrading={server.latencyTrend === 'degrading'} class:improving={server.latencyTrend === 'improving'}>
							{server.latencyTrend}
						</span>
					</div>
				</div>

				{#if server.diagnostics.length > 0}
					<div class="diagnostics">
						<h4 class="subsection">Diagnostics</h4>
						{#each server.diagnostics as diag}
							<div class="diag-item">
								<span class="diag-category">{diag.category}</span>
								<span class="diag-text">{diag.recommendation}</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if server.recentCalls.length > 0}
					<div class="recent-calls">
						<h4 class="subsection">Recent Calls</h4>
						<DataTable columns={['Tool', 'Status', 'Latency']}>
							{#each server.recentCalls.slice(0, 10) as call}
								<tr>
									<td class="tool-name">{call.toolName}</td>
									<td><StatusBadge status={call.status === 'success' ? 'healthy' : 'error'} /></td>
									<td>{call.latencyMs !== null ? `${call.latencyMs}ms` : '-'}</td>
								</tr>
							{/each}
						</DataTable>
					</div>
				{/if}
			</div>
		{/each}
	{/if}
</div>

<style>
	.server-card {
		background: var(--bg-card);
		border-radius: var(--radius);
		padding: 20px;
		margin-bottom: 16px;
	}

	.server-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.server-name {
		font-size: 16px;
		font-weight: 600;
		color: var(--accent-purple);
	}

	.server-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 12px;
		margin-bottom: 16px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stat-label {
		font-size: 11px;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.stat-value {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.error-val {
		color: var(--status-red);
	}

	.trend.degrading {
		color: var(--status-red);
	}

	.trend.improving {
		color: var(--status-green);
	}

	.subsection {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 8px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.diagnostics {
		margin-bottom: 16px;
	}

	.diag-item {
		padding: 6px 0;
		font-size: 13px;
	}

	.diag-category {
		color: var(--status-yellow);
		font-weight: 600;
		margin-right: 8px;
	}

	.diag-text {
		color: var(--text-body);
	}

	.tool-name {
		color: var(--accent-purple);
	}

	.recent-calls {
		margin-top: 16px;
	}
</style>

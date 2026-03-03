<script lang="ts">
	import DataTable from '../shared/DataTable.svelte';
	import StatusBadge from '../shared/StatusBadge.svelte';
	import EmptyState from '../shared/EmptyState.svelte';
	import { formatCurrency, formatTokens, formatTimestamp, truncateId } from '$lib/utils/format';
	import type { OverviewSession } from '$lib/api-client';

	interface Props {
		sessions: readonly OverviewSession[];
	}

	let { sessions }: Props = $props();

	const columns = ['Session', 'Model', 'Agents', 'Tokens', 'Cost', 'Status'] as const;
</script>

<div data-testid="recent-sessions-table">
	<h2 class="section-title">Recent Sessions</h2>
	{#if sessions.length === 0}
		<EmptyState message="No sessions captured yet." />
	{:else}
		<DataTable {columns}>
			{#each sessions as session}
				<tr>
					<td>
						<a href="/session/{session.id}" class="mono session-link" title={session.id}>
							{truncateId(session.id)}
						</a>
						<span class="session-time">{formatTimestamp(session.startTime)}</span>
					</td>
					<td>{session.model}</td>
					<td>{session.agentCount}</td>
					<td>{formatTokens(session.totalInputTokens + session.totalOutputTokens)}</td>
					<td class="cost">{formatCurrency(session.estimatedCost)}</td>
					<td>
						<StatusBadge status={session.status === 'active' ? 'active' : 'completed'} />
					</td>
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

	.session-link {
		font-size: 13px;
	}

	.session-time {
		display: block;
		font-size: 11px;
		color: var(--text-dim);
	}

	.cost {
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
</style>

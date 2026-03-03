<script lang="ts">
	import DataTable from '../shared/DataTable.svelte';
	import StatusBadge from '../shared/StatusBadge.svelte';
	import EmptyState from '../shared/EmptyState.svelte';
	import { formatCurrency, formatTokens, formatDate, formatTimestamp, truncateId } from '$lib/utils/format';
	import type { OverviewSession } from '$lib/api-client';

	interface Props {
		sessions: readonly OverviewSession[];
	}

	let { sessions }: Props = $props();

	const columns = ['Session', 'Date', 'Model', 'Agents', 'Tokens', 'Cost', 'Status'] as const;
</script>

<div data-testid="session-list">
	{#if sessions.length === 0}
		<EmptyState message="No sessions match the current filters." />
	{:else}
		<DataTable {columns}>
			{#each sessions as session}
				<tr>
					<td>
						<a href="/session/{session.id}" class="mono session-link" title={session.id}>
							{truncateId(session.id)}
						</a>
					</td>
					<td class="date-cell">
						<span>{formatDate(session.startTime)}</span>
						<span class="time-sub">{formatTimestamp(session.startTime)}</span>
					</td>
					<td>{session.model}</td>
					<td>{session.agentCount}</td>
					<td>{formatTokens(session.totalInputTokens + session.totalOutputTokens)}</td>
					<td class="mono">{formatCurrency(session.estimatedCost)}</td>
					<td><StatusBadge status={session.status === 'active' ? 'active' : 'completed'} /></td>
				</tr>
			{/each}
		</DataTable>
	{/if}
</div>

<style>
	.session-link {
		font-size: 13px;
	}

	.date-cell {
		display: flex;
		flex-direction: column;
	}

	.time-sub {
		font-size: 11px;
		color: var(--text-dim);
	}

	.mono {
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
</style>

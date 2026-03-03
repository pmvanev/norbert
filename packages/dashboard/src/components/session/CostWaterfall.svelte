<script lang="ts">
	import DataTable from '../shared/DataTable.svelte';
	import EmptyState from '../shared/EmptyState.svelte';
	import { formatCurrency, formatTokens } from '$lib/utils/format';
	import type { CostBreakdownResponse, CostAgentEntry } from '$lib/api-client';

	interface Props {
		costs: CostBreakdownResponse;
	}

	let { costs }: Props = $props();

	let maxCost = $derived(
		costs.agents.length > 0
			? Math.max(...costs.agents.map(a => a.estimatedCost))
			: 1
	);

	const barWidth = (cost: number): string =>
		`${Math.max((cost / maxCost) * 100, 2)}%`;
</script>

<div data-testid="cost-waterfall">
	<div class="total-row">
		<span class="total-label">Total Cost</span>
		<span class="total-value">{formatCurrency(costs.totalCost)}</span>
	</div>

	{#if costs.agents.length === 0}
		<EmptyState message="No cost data for this session." />
	{:else}
		<div class="waterfall">
			{#each costs.agents as agent}
				<div class="agent-row" data-testid="cost-agent-row">
					<div class="agent-header">
						<span class="agent-id">{agent.agentId}</span>
						<span class="agent-cost mono">{formatCurrency(agent.estimatedCost)}</span>
					</div>
					<div class="bar-track">
						<div class="bar-fill" style="width: {barWidth(agent.estimatedCost)}"></div>
					</div>
					<div class="agent-tokens">
						{formatTokens(agent.inputTokens)} in / {formatTokens(agent.outputTokens)} out
					</div>
					{#if agent.toolCalls.length > 0}
						<div class="tool-calls">
							{#each agent.toolCalls as tool}
								<div class="tool-row">
									<span class="tool-name">{tool.toolName}</span>
									<span class="tool-cost mono">{formatCurrency(tool.estimatedCost)}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if costs.costByMcpServer.length > 0}
			<h3 class="subsection-title">Cost by MCP Server</h3>
			<DataTable columns={['Server', 'Input Tokens', 'Output Tokens', 'Cost']}>
				{#each costs.costByMcpServer as mcp}
					<tr>
						<td class="server-name">{mcp.serverName}</td>
						<td>{formatTokens(mcp.inputTokens)}</td>
						<td>{formatTokens(mcp.outputTokens)}</td>
						<td class="mono">{formatCurrency(mcp.estimatedCost)}</td>
					</tr>
				{/each}
			</DataTable>
		{/if}

		<p class="methodology-note">{costs.costMethodologyNote}</p>
	{/if}
</div>

<style>
	.total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--bg-card);
		padding: 16px 20px;
		border-radius: var(--radius);
		margin-bottom: 16px;
	}

	.total-label {
		font-size: 14px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.total-value {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-primary);
		font-family: monospace;
	}

	.waterfall {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.agent-row {
		background: var(--bg-card);
		border-radius: var(--radius);
		padding: 16px;
	}

	.agent-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.agent-id {
		color: var(--accent-blue);
		font-weight: 600;
		font-size: 14px;
	}

	.agent-cost {
		color: var(--text-primary);
		font-weight: 600;
	}

	.bar-track {
		height: 8px;
		background: var(--bg-header);
		border-radius: 4px;
		margin-bottom: 6px;
	}

	.bar-fill {
		height: 100%;
		background: var(--accent-blue);
		border-radius: 4px;
		transition: width 0.3s;
	}

	.agent-tokens {
		font-size: 12px;
		color: var(--text-muted);
	}

	.tool-calls {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}

	.tool-row {
		display: flex;
		justify-content: space-between;
		padding: 4px 0;
		font-size: 13px;
	}

	.tool-name {
		color: var(--accent-purple);
	}

	.tool-cost {
		color: var(--text-body);
	}

	.subsection-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		margin: 24px 0 12px;
	}

	.server-name {
		color: var(--accent-purple);
		font-weight: 500;
	}

	.methodology-note {
		font-size: 12px;
		color: var(--text-dim);
		margin-top: 16px;
		font-style: italic;
	}

	.mono {
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
</style>

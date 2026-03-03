<script lang="ts">
	import SummaryCard from '../shared/SummaryCard.svelte';
	import { formatCurrency, formatTokens } from '$lib/utils/format';
	import type { OverviewSummaryResponse } from '$lib/api-client';

	interface Props {
		summary: OverviewSummaryResponse;
	}

	let { summary }: Props = $props();
</script>

<div class="overview-cards" data-testid="overview-cards">
	<SummaryCard label="Sessions" value={String(summary.sessionCount)} />
	<SummaryCard label="Total Tokens" value={formatTokens(summary.totalTokens)} />
	<SummaryCard label="Estimated Cost" value={formatCurrency(summary.estimatedCost)} />
	<SummaryCard label="MCP Servers" value={String(summary.mcpServerCount)} />
</div>

<style>
	.overview-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
		margin-bottom: 32px;
	}
</style>

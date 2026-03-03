<script lang="ts">
	import SummaryCard from '../shared/SummaryCard.svelte';
	import { formatCurrency, formatDuration } from '$lib/utils/format';
	import type { SessionBaselinesResponse } from '$lib/api-client';

	interface Props {
		baselines: SessionBaselinesResponse;
	}

	let { baselines }: Props = $props();
</script>

<div class="baselines-card" data-testid="baselines-card">
	<h3 class="section-title">Baselines</h3>
	<div class="baselines-grid">
		<SummaryCard
			label="Avg Cost"
			value={formatCurrency(baselines.averageCost)}
			subtitle="per session"
		/>
		<SummaryCard
			label="P95 Cost"
			value={formatCurrency(baselines.p95Cost)}
			subtitle="95th percentile"
		/>
		<SummaryCard
			label="Avg Duration"
			value={formatDuration(baselines.averageDuration)}
			subtitle="per session"
		/>
		<SummaryCard
			label="Sample Size"
			value={String(baselines.sampleSize)}
			subtitle={baselines.isConfident ? 'confident' : baselines.confidenceNote ?? 'low sample'}
		/>
	</div>
</div>

<style>
	.section-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 12px;
	}

	.baselines-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px;
	}
</style>

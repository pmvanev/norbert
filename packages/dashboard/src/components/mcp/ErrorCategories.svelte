<script lang="ts">
	import EmptyState from '../shared/EmptyState.svelte';
	import type { McpServerDetailResponse } from '$lib/api-client';

	interface Props {
		servers: readonly McpServerDetailResponse[];
	}

	let { servers }: Props = $props();

	interface CategoryTotal {
		category: string;
		count: number;
	}

	let categories = $derived.by((): CategoryTotal[] => {
		const totals = new Map<string, number>();
		for (const server of servers) {
			for (const err of server.errorsByCategory) {
				totals.set(err.category, (totals.get(err.category) ?? 0) + err.count);
			}
		}
		return [...totals.entries()]
			.map(([category, count]) => ({ category, count }))
			.sort((a, b) => b.count - a.count);
	});

	let maxCount = $derived(categories.length > 0 ? Math.max(...categories.map(c => c.count)) : 1);
</script>

<div data-testid="error-categories">
	<h3 class="section-title">Error Categories</h3>
	{#if categories.length === 0}
		<EmptyState message="No errors detected." />
	{:else}
		<div class="categories">
			{#each categories as cat}
				<div class="category-row">
					<span class="category-name">{cat.category}</span>
					<div class="bar-track">
						<div class="bar-fill" style="width: {(cat.count / maxCount) * 100}%"></div>
					</div>
					<span class="category-count">{cat.count}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.section-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 12px;
	}

	.categories {
		background: var(--bg-card);
		border-radius: var(--radius);
		padding: 16px;
	}

	.category-row {
		display: grid;
		grid-template-columns: 120px 1fr 60px;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
	}

	.category-name {
		font-size: 13px;
		color: var(--text-body);
		text-transform: capitalize;
	}

	.bar-track {
		height: 6px;
		background: var(--bg-header);
		border-radius: 3px;
	}

	.bar-fill {
		height: 100%;
		background: var(--status-red);
		border-radius: 3px;
	}

	.category-count {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		text-align: right;
	}
</style>

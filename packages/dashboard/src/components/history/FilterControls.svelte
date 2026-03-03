<script lang="ts">
	import { untrack } from 'svelte';
	import type { SessionHistoryParams } from '$lib/api-client';

	interface Props {
		filters: SessionHistoryParams;
		onApply: (filters: SessionHistoryParams) => void;
	}

	let { filters, onApply }: Props = $props();

	// Snapshot initial prop values for local form state (intentional one-time capture)
	const init = untrack(() => ({ ...filters }));
	let dateStart = $state(init.dateStart ?? '');
	let dateEnd = $state(init.dateEnd ?? '');
	let costMin = $state(init.costMin !== undefined ? String(init.costMin) : '');
	let costMax = $state(init.costMax !== undefined ? String(init.costMax) : '');
	let sortBy = $state(init.sortBy ?? 'startTime');
	let sortOrder = $state(init.sortOrder ?? 'desc');

	const apply = () => {
		let params: SessionHistoryParams = {
			sortBy,
			sortOrder,
		};
		if (dateStart) params = { ...params, dateStart };
		if (dateEnd) params = { ...params, dateEnd };
		if (costMin) params = { ...params, costMin: Number(costMin) };
		if (costMax) params = { ...params, costMax: Number(costMax) };
		onApply(params);
	};
</script>

<div class="filter-controls" data-testid="filter-controls">
	<div class="filter-row">
		<div class="filter-group">
			<label for="date-start">From</label>
			<input id="date-start" type="date" bind:value={dateStart} />
		</div>
		<div class="filter-group">
			<label for="date-end">To</label>
			<input id="date-end" type="date" bind:value={dateEnd} />
		</div>
		<div class="filter-group">
			<label for="cost-min">Min Cost</label>
			<input id="cost-min" type="number" step="0.01" placeholder="0.00" bind:value={costMin} />
		</div>
		<div class="filter-group">
			<label for="cost-max">Max Cost</label>
			<input id="cost-max" type="number" step="0.01" placeholder="99.99" bind:value={costMax} />
		</div>
		<div class="filter-group">
			<label for="sort-by">Sort By</label>
			<select id="sort-by" bind:value={sortBy}>
				<option value="startTime">Start Time</option>
				<option value="estimatedCost">Cost</option>
				<option value="eventCount">Events</option>
				<option value="agentCount">Agents</option>
			</select>
		</div>
		<div class="filter-group">
			<label for="sort-order">Order</label>
			<select id="sort-order" bind:value={sortOrder}>
				<option value="desc">Desc</option>
				<option value="asc">Asc</option>
			</select>
		</div>
		<button class="apply-btn" onclick={apply}>Apply</button>
	</div>
</div>

<style>
	.filter-controls {
		background: var(--bg-card);
		border-radius: var(--radius);
		padding: 16px;
		margin-bottom: 24px;
	}

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: flex-end;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	label {
		font-size: 11px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	input, select {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-body);
		padding: 6px 10px;
		font-size: 13px;
	}

	input:focus, select:focus {
		outline: none;
		border-color: var(--accent-blue);
	}

	.apply-btn {
		background: var(--accent-blue);
		color: var(--bg-page);
		border: none;
		border-radius: var(--radius-sm);
		padding: 7px 16px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.apply-btn:hover {
		opacity: 0.9;
	}
</style>

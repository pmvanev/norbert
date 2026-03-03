<script lang="ts">
	import { onMount } from 'svelte';
	import FilterControls from '../../components/history/FilterControls.svelte';
	import SessionList from '../../components/history/SessionList.svelte';
	import DailyTrendChart from '../../components/history/DailyTrendChart.svelte';
	import BaselinesCard from '../../components/history/BaselinesCard.svelte';
	import EmptyState from '../../components/shared/EmptyState.svelte';
	import {
		fetchSessionHistory,
		getSessionExportUrl,
		type SessionHistoryResponse,
		type SessionHistoryParams,
	} from '$lib/api-client';

	let data = $state<SessionHistoryResponse | null>(null);
	let error = $state<string | null>(null);
	let filters = $state<SessionHistoryParams>({ sortBy: 'startTime', sortOrder: 'desc' });

	const load = async (params: SessionHistoryParams) => {
		try {
			const baseUrl = window.location.origin;
			data = await fetchSessionHistory(baseUrl, params);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load history';
		}
	};

	const handleApply = (newFilters: SessionHistoryParams) => {
		filters = newFilters;
		load(filters);
	};

	const handleExport = () => {
		const url = getSessionExportUrl(window.location.origin, filters);
		window.open(url, '_blank');
	};

	onMount(() => {
		load(filters);
	});
</script>

<svelte:head>
	<title>Session History - Norbert</title>
</svelte:head>

<div class="header-row">
	<h1 class="page-title">Session History</h1>
	<button class="export-btn" onclick={handleExport} data-testid="export-csv-btn">Export CSV</button>
</div>

<FilterControls {filters} onApply={handleApply} />

{#if error}
	<EmptyState message={error} />
{:else if data}
	<div class="grid-row">
		<DailyTrendChart trends={data.trends} />
		<BaselinesCard baselines={data.baselines} />
	</div>
	<SessionList sessions={data.sessions} />
{:else}
	<EmptyState message="Loading..." />
{/if}

<style>
	.header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.page-title {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.export-btn {
		background: var(--bg-card);
		color: var(--accent-blue);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.export-btn:hover {
		background: var(--bg-hover);
	}

	.grid-row {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 24px;
		margin-bottom: 24px;
	}
</style>

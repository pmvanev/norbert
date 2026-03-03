<script lang="ts">
	import { onMount } from 'svelte';
	import OverviewCards from '../components/overview/OverviewCards.svelte';
	import RecentSessionsTable from '../components/overview/RecentSessionsTable.svelte';
	import McpHealthTable from '../components/overview/McpHealthTable.svelte';
	import EmptyState from '../components/shared/EmptyState.svelte';
	import { fetchOverview, type OverviewResponse } from '$lib/api-client';
	import { appStore } from '$lib/stores/app-store.svelte';

	let data = $state<OverviewResponse | null>(null);
	let error = $state<string | null>(null);

	const load = async () => {
		try {
			const baseUrl = window.location.origin;
			data = await fetchOverview(baseUrl);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load overview';
		}
	};

	onMount(() => {
		load();

		const wsUrl = `ws://${window.location.host}/ws`;
		appStore.connectWs(wsUrl);

		return () => {
			appStore.disconnectWs();
		};
	});

	$effect(() => {
		const msg = appStore.lastMessage;
		if (msg?.type === 'session_updated') {
			load();
		}
	});
</script>

<svelte:head>
	<title>Overview - Norbert Observatory</title>
</svelte:head>

{#if error}
	<EmptyState message={error} />
{:else if data}
	<OverviewCards summary={data.summary} />
	<RecentSessionsTable sessions={data.recentSessions} />
	<McpHealthTable servers={data.mcpHealth} />
{:else}
	<EmptyState message="Loading..." />
{/if}

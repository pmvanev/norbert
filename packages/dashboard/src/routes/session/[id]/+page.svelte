<script lang="ts">
	import { onMount } from 'svelte';
	import TabBar from '../../../components/shared/TabBar.svelte';
	import EmptyState from '../../../components/shared/EmptyState.svelte';
	import TraceGraph from '../../../components/session/TraceGraph.svelte';
	import CostWaterfall from '../../../components/session/CostWaterfall.svelte';
	import McpSessionDetail from '../../../components/session/McpSessionDetail.svelte';
	import {
		fetchSessionTrace,
		fetchSessionCosts,
		fetchMcpHealthDetail,
		type TraceGraphResponse,
		type CostBreakdownResponse,
		type McpHealthDetailResponse,
	} from '$lib/api-client';

	let { data } = $props();

	const tabs = ['Trace', 'Cost', 'MCP'] as const;
	let activeTab = $state('Trace');

	let trace = $state<TraceGraphResponse | null>(null);
	let costs = $state<CostBreakdownResponse | null>(null);
	let mcpHealth = $state<McpHealthDetailResponse | null>(null);
	let error = $state<string | null>(null);

	onMount(async () => {
		const baseUrl = window.location.origin;
		try {
			const [traceData, costData, mcpData] = await Promise.all([
				fetchSessionTrace(baseUrl, data.sessionId),
				fetchSessionCosts(baseUrl, data.sessionId),
				fetchMcpHealthDetail(baseUrl),
			]);
			trace = traceData;
			costs = costData;
			mcpHealth = mcpData;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load session data';
		}
	});
</script>

<svelte:head>
	<title>Session {data.sessionId.substring(0, 12)} - Norbert Observatory</title>
</svelte:head>

<div class="session-header">
	<h1 class="session-title">Session <span class="mono">{data.sessionId.substring(0, 12)}</span></h1>
</div>

<TabBar {tabs} {activeTab} onTabChange={(tab) => activeTab = tab} />

{#if error}
	<EmptyState message={error} />
{:else if activeTab === 'Trace'}
	{#if trace}
		<TraceGraph {trace} />
	{:else}
		<EmptyState message="Loading trace..." />
	{/if}
{:else if activeTab === 'Cost'}
	{#if costs}
		<CostWaterfall {costs} />
	{:else}
		<EmptyState message="Loading costs..." />
	{/if}
{:else if activeTab === 'MCP'}
	{#if mcpHealth}
		<McpSessionDetail servers={mcpHealth.servers} />
	{:else}
		<EmptyState message="Loading MCP data..." />
	{/if}
{/if}

<style>
	.session-header {
		margin-bottom: 24px;
	}

	.session-title {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.mono {
		font-family: 'SF Mono', 'Fira Code', monospace;
		color: var(--accent-blue);
	}
</style>

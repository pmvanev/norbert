<script lang="ts">
	import { onMount } from 'svelte';
	import ServerStatusTable from '../../components/mcp/ServerStatusTable.svelte';
	import ErrorCategories from '../../components/mcp/ErrorCategories.svelte';
	import ToolCallExplorer from '../../components/mcp/ToolCallExplorer.svelte';
	import EmptyState from '../../components/shared/EmptyState.svelte';
	import { fetchMcpHealthDetail, type McpHealthDetailResponse } from '$lib/api-client';

	let data = $state<McpHealthDetailResponse | null>(null);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const baseUrl = window.location.origin;
			data = await fetchMcpHealthDetail(baseUrl);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load MCP data';
		}
	});
</script>

<svelte:head>
	<title>MCP Observatory - Norbert</title>
</svelte:head>

<h1 class="page-title">MCP Observatory</h1>

{#if error}
	<EmptyState message={error} />
{:else if data}
	{#if !data.hasServers}
		<EmptyState message="No MCP servers have been detected. Run Claude Code with MCP servers configured." />
	{:else}
		<ServerStatusTable servers={data.servers} />
		<div class="grid-row">
			<ErrorCategories servers={data.servers} />
			<ToolCallExplorer servers={data.servers} />
		</div>
	{/if}
{:else}
	<EmptyState message="Loading..." />
{/if}

<style>
	.page-title {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 24px;
	}

	.grid-row {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 24px;
		margin-top: 24px;
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import ConfigTreeView from '../../components/config/ConfigTreeView.svelte';
	import ConfigCascade from '../../components/config/ConfigCascade.svelte';
	import ConfigAtlas from '../../components/config/ConfigAtlas.svelte';
	import ConfigPathTester from '../../components/config/ConfigPathTester.svelte';
	import ConfigMindMap from '../../components/config/ConfigMindMap.svelte';
	import ConfigSearch from '../../components/config/ConfigSearch.svelte';
	import ConfigGalaxy from '../../components/config/ConfigGalaxy.svelte';
	import TabBar from '../../components/shared/TabBar.svelte';
	import EmptyState from '../../components/shared/EmptyState.svelte';
	import { fetchConfigTree, type ConfigTreeResponse } from '$lib/utils/config-api';

	const VIEW_TABS = ['Mind Map', 'Galaxy', 'Atlas', 'Tree', 'Cascade', 'Path Tester', 'Search'] as const;

	let activeView = $state<string>('Mind Map');
	let treeData = $state<ConfigTreeResponse | null>(null);
	let treeError = $state<string | null>(null);
	let selectedFilePath = $state<string | null>(null);

	const loadTree = async () => {
		try {
			const baseUrl = window.location.origin;
			treeData = await fetchConfigTree(baseUrl);
			treeError = null;
		} catch (e) {
			treeError = e instanceof Error ? e.message : 'Failed to load configuration tree';
		}
	};

	const handleTabChange = (tab: string) => {
		activeView = tab;
		// Update URL without full navigation
		const url = new URL(window.location.href);
		url.searchParams.set('view', tab.toLowerCase());
		if (tab !== 'Atlas') {
			url.searchParams.delete('file');
		}
		window.history.replaceState({}, '', url.toString());
	};

	const navigateToFileInAtlas = (filePath: string) => {
		selectedFilePath = filePath;
		handleTabChange('Atlas');
	};

	onMount(() => {
		// Check URL for view and file parameters (supports deep linking)
		const params = new URLSearchParams(window.location.search);
		const viewParam = params.get('view');
		const fileParam = params.get('file');

		if (viewParam === 'mind map' || viewParam === 'mind-map') {
			activeView = 'Mind Map';
		} else if (viewParam === 'galaxy') {
			activeView = 'Galaxy';
		} else if (viewParam === 'atlas') {
			activeView = 'Atlas';
		} else if (viewParam === 'tree') {
			activeView = 'Tree';
		} else if (viewParam === 'cascade') {
			activeView = 'Cascade';
		} else if (viewParam === 'path tester' || viewParam === 'path-tester') {
			activeView = 'Path Tester';
		} else if (viewParam === 'search') {
			activeView = 'Search';
		}

		if (fileParam) {
			selectedFilePath = fileParam;
			// If a file is specified, switch to Atlas to show it
			if (!viewParam || viewParam === 'atlas') {
				activeView = 'Atlas';
			}
		}

		loadTree();
	});
</script>

<svelte:head>
	<title>Config Explorer - Norbert Observatory</title>
</svelte:head>

<div class="config-page">
	<header class="page-header">
		<h2>Config Explorer</h2>
		<p class="page-subtitle">Claude Code configuration across all scopes and subsystems</p>
	</header>

	<TabBar tabs={VIEW_TABS} activeTab={activeView} onTabChange={handleTabChange} />

	{#if activeView === 'Mind Map'}
		{#if treeError}
			<EmptyState message={treeError} />
		{:else if treeData?.model}
			<ConfigMindMap model={treeData.model} />
		{:else if treeData}
			<EmptyState message="No configuration data available." />
		{:else}
			<EmptyState message="Loading..." />
		{/if}
	{:else if activeView === 'Galaxy'}
		{#if treeError}
			<EmptyState message={treeError} />
		{:else if treeData?.model}
			<ConfigGalaxy model={treeData.model} />
		{:else if treeData}
			<EmptyState message="No configuration data available." />
		{:else}
			<EmptyState message="Loading..." />
		{/if}
	{:else if activeView === 'Atlas'}
		{#if treeError}
			<EmptyState message={treeError} />
		{:else if treeData?.fileTrees}
			<ConfigAtlas fileTrees={treeData.fileTrees} initialSelectedFile={selectedFilePath} />
		{:else if treeData}
			<EmptyState message="No configuration files discovered. Check that ~/.claude/ or .claude/ directories exist." />
		{:else}
			<EmptyState message="Loading..." />
		{/if}
	{:else if activeView === 'Tree'}
		{#if treeError}
			<EmptyState message={treeError} />
		{:else if treeData}
			<ConfigTreeView nodes={treeData.nodes} />
		{:else}
			<EmptyState message="Loading..." />
		{/if}
	{:else if activeView === 'Cascade'}
		<ConfigCascade />
	{:else if activeView === 'Path Tester'}
		<ConfigPathTester />
	{:else if activeView === 'Search'}
		<ConfigSearch onNavigateToFile={navigateToFileInAtlas} />
	{/if}
</div>

<style>
	.config-page {
		max-width: 1200px;
	}

	.page-header {
		margin-bottom: 24px;
	}

	.page-header h2 {
		font-size: 20px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.page-subtitle {
		font-size: 13px;
		color: var(--text-muted);
		margin-top: 4px;
	}
</style>

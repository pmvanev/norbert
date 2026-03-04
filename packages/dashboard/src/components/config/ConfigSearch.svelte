<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fetchConfigSearch, type SearchResultResponse } from '$lib/utils/config-api';

	// -----------------------------------------------------------------------
	// Props
	// -----------------------------------------------------------------------

	interface Props {
		onNavigateToFile?: (filePath: string) => void;
	}

	let { onNavigateToFile }: Props = $props();

	// -----------------------------------------------------------------------
	// Scope display
	// -----------------------------------------------------------------------

	const SCOPE_COLORS: Record<string, string> = {
		user: 'var(--scope-user, #3B82F6)',
		project: 'var(--scope-project, #22C55E)',
		local: 'var(--scope-local, #EAB308)',
		plugin: 'var(--scope-plugin, #A855F7)',
		managed: 'var(--scope-managed, #EF4444)',
	};

	const SUBSYSTEM_LABELS: Record<string, string> = {
		settings: 'Settings',
		rules: 'Rules',
		skills: 'Skills',
		agents: 'Agents',
		hooks: 'Hooks',
		plugins: 'Plugins',
		mcp: 'MCP',
		memory: 'Memory',
	};

	// -----------------------------------------------------------------------
	// State
	// -----------------------------------------------------------------------

	let query = $state('');
	let results = $state<readonly SearchResultResponse[]>([]);
	let isLoading = $state(false);
	let hasSearched = $state(false);
	let searchError = $state<string | null>(null);
	let searchInputRef = $state<HTMLInputElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// -----------------------------------------------------------------------
	// Debounced search
	// -----------------------------------------------------------------------

	const performSearch = async (searchQuery: string) => {
		const trimmed = searchQuery.trim();
		if (trimmed === '') {
			results = [];
			hasSearched = false;
			searchError = null;
			return;
		}

		isLoading = true;
		searchError = null;

		try {
			const baseUrl = window.location.origin;
			results = await fetchConfigSearch(baseUrl, trimmed);
			hasSearched = true;
		} catch (e) {
			searchError = e instanceof Error ? e.message : 'Search failed';
			results = [];
			hasSearched = true;
		} finally {
			isLoading = false;
		}
	};

	const handleInput = () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(() => {
			performSearch(query);
		}, 300);
	};

	// -----------------------------------------------------------------------
	// Result click handler
	// -----------------------------------------------------------------------

	const handleResultClick = (result: SearchResultResponse) => {
		if (onNavigateToFile) {
			onNavigateToFile(result.node.filePath);
		}
	};

	// -----------------------------------------------------------------------
	// Highlight match in line
	// -----------------------------------------------------------------------

	const highlightMatch = (line: string, searchQuery: string): { before: string; match: string; after: string } => {
		const trimmed = searchQuery.trim();
		if (trimmed === '') return { before: line, match: '', after: '' };

		const lowerLine = line.toLowerCase();
		const lowerQuery = trimmed.toLowerCase();
		const index = lowerLine.indexOf(lowerQuery);

		if (index === -1) return { before: line, match: '', after: '' };

		return {
			before: line.slice(0, index),
			match: line.slice(index, index + trimmed.length),
			after: line.slice(index + trimmed.length),
		};
	};

	// -----------------------------------------------------------------------
	// Global keyboard shortcut: Cmd+K / Ctrl+K
	// -----------------------------------------------------------------------

	const handleGlobalKeydown = (event: KeyboardEvent) => {
		if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
			event.preventDefault();
			searchInputRef?.focus();
		}
	};

	onMount(() => {
		window.addEventListener('keydown', handleGlobalKeydown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleGlobalKeydown);
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
	});
</script>

<div class="config-search" data-testid="config-search">
	<div class="search-bar">
		<span class="search-icon">search</span>
		<input
			bind:this={searchInputRef}
			bind:value={query}
			oninput={handleInput}
			type="text"
			class="search-input"
			placeholder="Search configuration files... (Ctrl+K)"
			data-testid="search-input"
		/>
		{#if isLoading}
			<span class="search-status">Searching...</span>
		{/if}
	</div>

	{#if searchError}
		<div class="search-error">{searchError}</div>
	{:else if hasSearched && results.length === 0}
		<div class="no-results" data-testid="no-results">
			<div class="no-results-title">No configuration files match your query.</div>
			<div class="no-results-hint">
				Try searching for rule names, setting keys, or CLAUDE.md instructions.
			</div>
		</div>
	{:else if results.length > 0}
		<div class="results-list" data-testid="search-results">
			{#each results as result}
				{@const highlighted = highlightMatch(result.matchingLine, query)}
				<button
					class="result-item"
					onclick={() => handleResultClick(result)}
					data-testid="search-result"
				>
					<div class="result-header">
						<span class="result-path">{result.node.filePath}</span>
						<span
							class="scope-badge"
							style="background: {SCOPE_COLORS[result.node.scope] ?? 'var(--text-muted)'}"
						>
							{result.node.scope}
						</span>
						<span class="subsystem-label">
							{SUBSYSTEM_LABELS[result.node.subsystem] ?? result.node.subsystem}
						</span>
					</div>
					<div class="result-line">
						{#if result.lineNumber > 0}
							<span class="line-number">L{result.lineNumber}</span>
						{/if}
						<span class="line-text">
							{highlighted.before}<mark class="highlight">{highlighted.match}</mark>{highlighted.after}
						</span>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.config-search {
		width: 100%;
	}

	/* --- Search bar --- */

	.search-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		margin-bottom: 16px;
	}

	.search-icon {
		font-size: 14px;
		color: var(--text-muted);
		flex-shrink: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.search-input {
		flex: 1;
		border: none;
		background: transparent;
		font-size: 14px;
		color: var(--text-primary);
		outline: none;
		font-family: inherit;
	}

	.search-input::placeholder {
		color: var(--text-dim);
	}

	.search-status {
		font-size: 12px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	/* --- Error --- */

	.search-error {
		padding: 12px 16px;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: var(--radius-sm);
		color: var(--status-red);
		font-size: 13px;
	}

	/* --- No results --- */

	.no-results {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		gap: 8px;
	}

	.no-results-title {
		font-size: 15px;
		font-weight: 500;
		color: var(--text-muted);
	}

	.no-results-hint {
		font-size: 13px;
		color: var(--text-dim);
		text-align: center;
		max-width: 400px;
	}

	/* --- Results list --- */

	.results-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.result-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background 0.1s, border-color 0.1s;
	}

	.result-item:hover {
		background: var(--bg-hover);
		border-color: var(--accent-blue);
	}

	.result-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.result-path {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 12px;
		color: var(--text-primary);
		font-weight: 500;
	}

	.scope-badge {
		display: inline-block;
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		color: white;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}

	.subsystem-label {
		font-size: 11px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-left: auto;
		flex-shrink: 0;
	}

	.result-line {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.line-number {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 11px;
		color: var(--text-dim);
		flex-shrink: 0;
		min-width: 28px;
	}

	.line-text {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 12px;
		color: var(--text-body);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.highlight {
		background: rgba(250, 204, 21, 0.35);
		color: var(--text-primary);
		padding: 0 1px;
		border-radius: 2px;
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchCascade, type CascadeResponse, type CascadeEntry } from '$lib/utils/config-api';

	// -----------------------------------------------------------------------
	// Subsystem definitions
	// -----------------------------------------------------------------------

	const SUBSYSTEMS = [
		{ name: 'memory', label: 'Memory' },
		{ name: 'settings', label: 'Settings' },
		{ name: 'rules', label: 'Rules' },
		{ name: 'skills', label: 'Skills' },
		{ name: 'agents', label: 'Agents' },
		{ name: 'hooks', label: 'Hooks' },
		{ name: 'plugins', label: 'Plugins' },
		{ name: 'mcp', label: 'MCP' },
	] as const;

	const SCOPE_COLORS: Record<string, string> = {
		user: 'var(--scope-user)',
		project: 'var(--scope-project)',
		local: 'var(--scope-local)',
		plugin: 'var(--scope-plugin)',
		managed: 'var(--scope-managed)',
	};

	const SCOPE_LABELS: Record<string, string> = {
		user: 'User',
		project: 'Project',
		local: 'Local',
		plugin: 'Plugin',
		managed: 'Managed',
	};

	// -----------------------------------------------------------------------
	// State
	// -----------------------------------------------------------------------

	let selectedSubsystem = $state('settings');
	let cascade = $state<CascadeResponse | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(false);

	// -----------------------------------------------------------------------
	// Data loading
	// -----------------------------------------------------------------------

	const loadCascade = async (subsystem: string) => {
		loading = true;
		error = null;
		try {
			const baseUrl = window.location.origin;
			cascade = await fetchCascade(baseUrl, subsystem);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load cascade';
			cascade = null;
		} finally {
			loading = false;
		}
	};

	const selectSubsystem = (name: string) => {
		selectedSubsystem = name;
		loadCascade(name);
	};

	onMount(() => {
		loadCascade(selectedSubsystem);
	});

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------

	const scopeColor = (scope: string): string =>
		SCOPE_COLORS[scope] ?? 'var(--text-muted)';

	const scopeLabel = (scope: string): string =>
		SCOPE_LABELS[scope] ?? scope;

	const resolutionLabel = (type: string): string => {
		switch (type) {
			case 'override': return 'Override (winner takes all)';
			case 'additive': return 'Additive (all scopes loaded)';
			case 'merge': return 'Merge (arrays concatenated)';
			default: return type;
		}
	};

	const buildAtlasLink = (filePath: string): string =>
		`/config?view=atlas&file=${encodeURIComponent(filePath)}`;
</script>

<div class="cascade-container" data-testid="config-cascade">
	<!-- Subsystem selector tabs -->
	<div class="subsystem-tabs" role="tablist" data-testid="subsystem-tabs">
		{#each SUBSYSTEMS as sub}
			<button
				role="tab"
				class="subsystem-tab"
				class:active={selectedSubsystem === sub.name}
				aria-selected={selectedSubsystem === sub.name}
				onclick={() => selectSubsystem(sub.name)}
			>
				{sub.label}
			</button>
		{/each}
	</div>

	<!-- Resolution type indicator -->
	{#if cascade}
		<div class="resolution-info" data-testid="resolution-type">
			<span class="resolution-label">Resolution:</span>
			<span class="resolution-value">{resolutionLabel(cascade.resolutionType)}</span>
		</div>
	{/if}

	<!-- Loading / error / cascade content -->
	{#if loading}
		<div class="cascade-status">Loading...</div>
	{:else if error}
		<div class="cascade-status cascade-error">{error}</div>
	{:else if cascade}
		<div class="waterfall" data-testid="cascade-waterfall">
			{#each cascade.entries as entry, index}
				{@const isLast = index === cascade.entries.length - 1}
				<div
					class="scope-row"
					class:active={entry.status === 'active'}
					class:overridden={entry.status === 'overridden'}
					class:empty={entry.status === 'empty'}
					class:access-denied={entry.status === 'access-denied'}
					data-testid="scope-row-{entry.scope}"
				>
					<!-- Scope level indicator with colored bar -->
					<div class="scope-indicator" style="--scope-bar-color: {scopeColor(entry.scope)}">
						<span class="scope-badge" style="background: {scopeColor(entry.scope)}">
							{scopeLabel(entry.scope)}
						</span>

						<!-- Status badge -->
						{#if entry.status === 'active'}
							<span class="status-badge active-badge">ACTIVE</span>
						{:else if entry.status === 'overridden'}
							<span class="status-badge overridden-badge">OVERRIDDEN</span>
						{:else if entry.status === 'empty'}
							<span class="status-badge empty-badge">NOT CONFIGURED</span>
						{:else if entry.status === 'access-denied'}
							<span class="status-badge denied-badge">ACCESS DENIED</span>
						{/if}
					</div>

					<!-- Content area -->
					<div class="scope-content">
						{#if entry.status === 'empty'}
							<div class="empty-placeholder">No configuration at this scope level</div>
						{:else if entry.status === 'access-denied'}
							<div class="empty-placeholder">Cannot read managed configuration</div>
						{:else}
							{#each entry.nodes as node}
								<div class="node-entry" class:struck={entry.status === 'overridden'}>
									<a
										href={buildAtlasLink(node.filePath)}
										class="file-link"
										class:struck-link={entry.status === 'overridden'}
									>
										{node.name}
									</a>
									<span class="file-path">{node.filePath}</span>
								</div>
							{/each}

							{#if entry.overrideReason}
								<div class="override-reason">
									{entry.overrideReason}
								</div>
							{/if}

							{#if entry.mergeContribution && entry.mergeContribution.length > 0}
								<div class="merge-info">
									Contributes: {entry.mergeContribution.join(', ')}
								</div>
							{/if}
						{/if}
					</div>

					<!-- Connector line between rows (except last) -->
					{#if !isLast}
						<div class="connector-line"></div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.cascade-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Subsystem tab selector */
	.subsystem-tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
	}

	.subsystem-tab {
		padding: 8px 16px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
		white-space: nowrap;
	}

	.subsystem-tab:hover {
		color: var(--text-body);
	}

	.subsystem-tab.active {
		color: var(--accent-blue);
		border-bottom-color: var(--accent-blue);
	}

	/* Resolution type info */
	.resolution-info {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 12px;
	}

	.resolution-label {
		color: var(--text-muted);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.resolution-value {
		color: var(--text-body);
	}

	/* Status messages */
	.cascade-status {
		padding: 24px;
		text-align: center;
		color: var(--text-muted);
		font-size: 14px;
	}

	.cascade-error {
		color: var(--status-red);
	}

	/* Waterfall layout */
	.waterfall {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	/* Scope row -- the main waterfall entry */
	.scope-row {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		margin-bottom: 8px;
		transition: opacity 0.15s, border-color 0.15s;
	}

	.scope-row.active {
		border-left: 3px solid var(--status-green);
	}

	.scope-row.overridden {
		opacity: 0.6;
		border-left: 3px solid var(--status-red);
	}

	.scope-row.empty {
		opacity: 0.4;
		border-left: 3px solid var(--border);
	}

	.scope-row.access-denied {
		opacity: 0.4;
		border-left: 3px solid var(--status-yellow);
	}

	/* Scope indicator (badge + status) */
	.scope-indicator {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.scope-badge {
		display: inline-block;
		padding: 2px 10px;
		border-radius: var(--radius-sm);
		color: white;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		min-width: 72px;
		text-align: center;
	}

	/* Status badges */
	.status-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 9999px;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.active-badge {
		background: rgba(34, 197, 94, 0.15);
		color: var(--status-green);
	}

	.overridden-badge {
		background: rgba(239, 68, 68, 0.15);
		color: var(--status-red);
	}

	.empty-badge {
		background: rgba(100, 116, 139, 0.15);
		color: var(--text-dim);
	}

	.denied-badge {
		background: rgba(234, 179, 8, 0.15);
		color: var(--status-yellow);
	}

	/* Content area */
	.scope-content {
		padding-left: 82px;
	}

	.empty-placeholder {
		color: var(--text-dim);
		font-style: italic;
		font-size: 13px;
	}

	/* Node entry (file reference) */
	.node-entry {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 0;
		font-size: 13px;
	}

	.node-entry.struck {
		text-decoration: line-through;
		text-decoration-color: var(--status-red);
	}

	.file-link {
		color: var(--accent-blue);
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 13px;
		font-weight: 500;
		text-decoration: none;
	}

	.file-link:hover {
		text-decoration: underline;
	}

	.file-link.struck-link {
		color: var(--text-dim);
		text-decoration: line-through;
		text-decoration-color: var(--status-red);
	}

	.file-path {
		color: var(--text-dim);
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 11px;
	}

	/* Override reason */
	.override-reason {
		margin-top: 4px;
		padding: 4px 8px;
		background: rgba(239, 68, 68, 0.08);
		border-radius: var(--radius-sm);
		color: var(--status-red);
		font-size: 12px;
		font-style: italic;
	}

	/* Merge contribution info */
	.merge-info {
		margin-top: 4px;
		padding: 4px 8px;
		background: rgba(56, 189, 248, 0.08);
		border-radius: var(--radius-sm);
		color: var(--accent-blue);
		font-size: 12px;
	}

	/* Connector line between waterfall rows */
	.connector-line {
		position: absolute;
		left: 50px;
		bottom: -9px;
		width: 2px;
		height: 9px;
		background: var(--border);
		z-index: 1;
	}
</style>

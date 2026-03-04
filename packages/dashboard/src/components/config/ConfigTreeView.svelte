<script lang="ts">
	import type { ConfigTreeNode } from '$lib/utils/config-api';

	interface Props {
		nodes: readonly ConfigTreeNode[];
	}

	let { nodes }: Props = $props();
</script>

<div class="tree-view">
	{#each nodes as node}
		<div
			class="tree-node"
			class:placeholder={node.placeholder}
			class:has-error={node.error !== null}
			style="--scope-color: {node.scopeColor}"
		>
			<div class="node-header">
				<span class="scope-badge" style="background: {node.scopeColor}">{node.scope}</span>
				<span class="node-name">{node.name}</span>
				<span class="subsystem-label">{node.subsystem}</span>
			</div>

			{#if node.placeholder}
				<div class="node-body placeholder-body">
					<span class="placeholder-text">Not found</span>
				</div>
			{:else if node.error}
				<div class="node-body error-body">
					<span class="error-text">{node.error}</span>
				</div>
			{:else if node.parsedContent?.format === 'json' && node.parsedContent.keys}
				<div class="node-body">
					<ul class="key-list">
						{#each node.parsedContent.keys as key}
							<li class="key-item">{key}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.tree-view {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.tree-node {
		border: 1px solid var(--border);
		border-left: 3px solid var(--scope-color);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		overflow: hidden;
	}

	.tree-node.placeholder {
		opacity: 0.6;
	}

	.tree-node.has-error {
		border-left-color: var(--status-red);
	}

	.node-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		background: var(--bg-header);
	}

	.scope-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		color: white;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.node-name {
		font-weight: 500;
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 13px;
		color: var(--text-primary);
	}

	.subsystem-label {
		font-size: 11px;
		color: var(--text-muted);
		margin-left: auto;
	}

	.node-body {
		padding: 10px 12px;
	}

	.placeholder-body {
		color: var(--text-dim);
		font-style: italic;
		font-size: 13px;
	}

	.error-body {
		color: var(--status-red);
		font-size: 13px;
	}

	.key-list {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.key-item {
		padding: 2px 8px;
		background: var(--bg-page);
		border-radius: var(--radius-sm);
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 12px;
		color: var(--text-body);
	}
</style>

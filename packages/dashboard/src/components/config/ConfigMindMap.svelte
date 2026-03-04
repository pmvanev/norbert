<script lang="ts">
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore -- d3-hierarchy lacks type declarations (same as TraceGraph.svelte)
	import { hierarchy, tree } from 'd3-hierarchy';
	import type { ConfigModelResponse } from '$lib/utils/config-api';

	interface Props {
		model: ConfigModelResponse;
	}

	let { model }: Props = $props();

	// -----------------------------------------------------------------------
	// Mind map data structure (mirrors @norbert/config-explorer MindMapNode)
	// -----------------------------------------------------------------------

	interface MindMapNode {
		name: string;
		subsystem: string | null;
		scope: string | null;
		count: number;
		isEmpty: boolean;
		children: MindMapNode[];
	}

	// -----------------------------------------------------------------------
	// Subsystem definitions
	// -----------------------------------------------------------------------

	const ALL_SUBSYSTEM_ENTRIES: readonly { subsystem: string; label: string }[] = [
		{ subsystem: 'memory', label: 'Memory' },
		{ subsystem: 'settings', label: 'Settings' },
		{ subsystem: 'rules', label: 'Rules' },
		{ subsystem: 'skills', label: 'Skills' },
		{ subsystem: 'agents', label: 'Agents' },
		{ subsystem: 'hooks', label: 'Hooks' },
		{ subsystem: 'plugins', label: 'Plugins' },
		{ subsystem: 'mcp', label: 'MCP' },
	] as const;

	// -----------------------------------------------------------------------
	// Scope color lookup (matches CSS custom properties in app.css)
	// -----------------------------------------------------------------------

	const SCOPE_COLORS: Record<string, string> = {
		user: '#3B82F6',
		project: '#22C55E',
		local: '#EAB308',
		plugin: '#A855F7',
		managed: '#EF4444',
	};

	const scopeColor = (scope: string | null): string =>
		scope ? SCOPE_COLORS[scope] ?? '#94a3b8' : '#94a3b8';

	// -----------------------------------------------------------------------
	// Build mind map tree from model
	// -----------------------------------------------------------------------

	const buildTree = (m: ConfigModelResponse): MindMapNode => {
		const nodesBySubsystem = new Map<string, ConfigModelResponse['nodes'][number][]>();
		for (const node of m.nodes) {
			const existing = nodesBySubsystem.get(node.subsystem);
			if (existing) {
				existing.push(node);
			} else {
				nodesBySubsystem.set(node.subsystem, [node]);
			}
		}

		const branches: MindMapNode[] = ALL_SUBSYSTEM_ENTRIES.map(({ subsystem, label }) => {
			const nodesForSubsystem = nodesBySubsystem.get(subsystem) ?? [];
			return {
				name: label,
				subsystem,
				scope: null,
				count: nodesForSubsystem.length,
				isEmpty: nodesForSubsystem.length === 0,
				children: nodesForSubsystem.map((node) => ({
					name: node.name,
					subsystem: node.subsystem,
					scope: node.scope,
					count: 0,
					isEmpty: false,
					children: [],
				})),
			};
		});

		return {
			name: 'Configuration',
			subsystem: null,
			scope: null,
			count: m.totalFiles,
			isEmpty: m.totalFiles === 0,
			children: branches,
		};
	};

	// -----------------------------------------------------------------------
	// Expand/collapse state
	// -----------------------------------------------------------------------

	let expandedBranches = $state<Set<string>>(new Set());

	const toggleBranch = (subsystem: string) => {
		const next = new Set(expandedBranches);
		if (next.has(subsystem)) {
			next.delete(subsystem);
		} else {
			next.add(subsystem);
		}
		expandedBranches = next;
	};

	const isBranchExpanded = (subsystem: string): boolean => expandedBranches.has(subsystem);

	// -----------------------------------------------------------------------
	// Layout computation
	// -----------------------------------------------------------------------

	const nodeWidth = 160;
	const nodeHeight = 36;
	const margin = { top: 40, right: 80, bottom: 40, left: 80 };

	/**
	 * Build visible tree based on which branches are expanded.
	 * Collapsed branches show as leaf nodes (no children passed to d3).
	 * Expanded branches include their leaf children.
	 */
	const buildVisibleTree = (rootData: MindMapNode): MindMapNode => ({
		...rootData,
		children: rootData.children.map((branch) => {
			if (branch.subsystem && isBranchExpanded(branch.subsystem) && branch.children.length > 0) {
				return branch;
			}
			return { ...branch, children: [] };
		}),
	});

	let layoutData = $derived.by(() => {
		const rootData = buildTree(model);
		const visibleTree = buildVisibleTree(rootData);

		const root = hierarchy<MindMapNode>(visibleTree, (d: MindMapNode) => (d.children.length > 0 ? [...d.children] : undefined));
		const treeLayout = tree<MindMapNode>().nodeSize([nodeHeight + 16, nodeWidth + 60]);
		const laid = treeLayout(root);

		const allNodes = laid.descendants();
		const allLinks = laid.links();

		return { allNodes, allLinks, rootData };
	});

	let viewBox = $derived.by(() => {
		const nodes = layoutData.allNodes;
		if (nodes.length === 0) return '0 0 600 400';

		// D3 tree uses x for vertical and y for horizontal in default orientation
		// We swap so that the tree renders left-to-right (y = horizontal, x = vertical)
		const xs = nodes.map((n: { y: number }) => n.y);
		const ys = nodes.map((n: { x: number }) => n.x);
		const minX = Math.min(...xs) - margin.left;
		const minY = Math.min(...ys) - nodeHeight - margin.top;
		const maxX = Math.max(...xs) + nodeWidth + margin.right;
		const maxY = Math.max(...ys) + nodeHeight + margin.bottom;
		return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
	});

	// -----------------------------------------------------------------------
	// Node classification helpers
	// -----------------------------------------------------------------------

	const isRoot = (d: { data: MindMapNode }): boolean => d.data.subsystem === null;
	const isBranch = (d: { data: MindMapNode; depth: number }): boolean =>
		d.depth === 1 && d.data.subsystem !== null;
	const isLeaf = (d: { depth: number }): boolean => d.depth === 2;

	const branchLabel = (d: MindMapNode): string => {
		if (d.subsystem && isBranchExpanded(d.subsystem) && d.count > 0) {
			return `${d.name} (${d.count})`;
		}
		return d.count > 0 ? `${d.name} (${d.count})` : `${d.name} (0)`;
	};
</script>

<div class="mind-map" data-testid="config-mind-map">
	<div class="mind-map-header">
		<p class="mind-map-hint">Click a subsystem branch to expand or collapse individual files.</p>
	</div>

	<div class="mind-map-canvas">
		<svg viewBox={viewBox} class="mind-map-svg">
			<!-- Links -->
			{#each layoutData.allLinks as link}
				<path
					d="M{link.source.y},{link.source.x}
					   C{(link.source.y + link.target.y) / 2},{link.source.x}
					    {(link.source.y + link.target.y) / 2},{link.target.x}
					    {link.target.y},{link.target.x}"
					class="mind-map-link"
					class:dimmed={link.target.data.isEmpty}
				/>
			{/each}

			<!-- Nodes -->
			{#each layoutData.allNodes as node}
				{#if isRoot(node)}
					<!-- Root node -->
					<g transform="translate({node.y - 60}, {node.x - 16})">
						<rect
							width="120"
							height="32"
							rx="16"
							class="root-node"
						/>
						<text x="60" y="20" text-anchor="middle" class="root-label">
							{node.data.name}
						</text>
					</g>
				{:else if isBranch(node)}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<g
						transform="translate({node.y - nodeWidth / 2}, {node.x - nodeHeight / 2})"
						class="branch-group"
						class:clickable={node.data.count > 0}
						class:dimmed={node.data.isEmpty}
						onclick={() => node.data.subsystem && node.data.count > 0 && toggleBranch(node.data.subsystem)}
						role={node.data.count > 0 ? 'button' : undefined}
						tabindex={node.data.count > 0 ? 0 : undefined}
						onkeydown={(e) => {
							if ((e.key === 'Enter' || e.key === ' ') && node.data.subsystem && node.data.count > 0) {
								e.preventDefault();
								toggleBranch(node.data.subsystem);
							}
						}}
					>
						<rect
							width={nodeWidth}
							height={nodeHeight}
							rx="6"
							class="branch-node"
							class:expanded={node.data.subsystem ? isBranchExpanded(node.data.subsystem) : false}
						/>
						<text x={nodeWidth / 2} y={nodeHeight / 2 + 5} text-anchor="middle" class="branch-label">
							{branchLabel(node.data)}
						</text>
						{#if node.data.count > 0}
							<text x={nodeWidth - 12} y={nodeHeight / 2 + 4} text-anchor="middle" class="expand-indicator">
								{node.data.subsystem && isBranchExpanded(node.data.subsystem) ? '\u25BC' : '\u25B6'}
							</text>
						{/if}
					</g>
				{:else if isLeaf(node)}
					<!-- Leaf node (individual config file) -->
					<g transform="translate({node.y - nodeWidth / 2}, {node.x - 14})">
						<rect
							width={nodeWidth}
							height="28"
							rx="4"
							class="leaf-node"
							style="stroke: {scopeColor(node.data.scope)}"
						/>
						<circle
							cx="14"
							cy="14"
							r="5"
							fill={scopeColor(node.data.scope)}
							class="scope-dot"
						/>
						<text x="26" y="18" class="leaf-label">
							{node.data.name}
						</text>
					</g>
				{/if}
			{/each}
		</svg>
	</div>

	<!-- Legend -->
	<div class="mind-map-legend">
		<span class="legend-title">Scopes:</span>
		<span class="legend-item">
			<span class="legend-dot" style="background: {SCOPE_COLORS.user}"></span> User
		</span>
		<span class="legend-item">
			<span class="legend-dot" style="background: {SCOPE_COLORS.project}"></span> Project
		</span>
		<span class="legend-item">
			<span class="legend-dot" style="background: {SCOPE_COLORS.local}"></span> Local
		</span>
		<span class="legend-item">
			<span class="legend-dot" style="background: {SCOPE_COLORS.plugin}"></span> Plugin
		</span>
		<span class="legend-item">
			<span class="legend-dot" style="background: {SCOPE_COLORS.managed}"></span> Managed
		</span>
	</div>
</div>

<style>
	.mind-map {
		background: var(--bg-card);
		border-radius: var(--radius);
		padding: 16px;
	}

	.mind-map-header {
		margin-bottom: 12px;
	}

	.mind-map-hint {
		font-size: 12px;
		color: var(--text-dim);
	}

	.mind-map-canvas {
		overflow-x: auto;
		overflow-y: auto;
	}

	.mind-map-svg {
		width: 100%;
		min-height: 320px;
	}

	/* Links */
	.mind-map-link {
		fill: none;
		stroke: var(--border);
		stroke-width: 1.5;
	}

	.mind-map-link.dimmed {
		stroke: var(--bg-hover);
		stroke-dasharray: 4, 4;
	}

	/* Root node */
	.root-node {
		fill: var(--accent-blue);
		opacity: 0.9;
	}

	.root-label {
		fill: var(--bg-page);
		font-size: 13px;
		font-weight: 700;
	}

	/* Branch nodes */
	.branch-group.clickable {
		cursor: pointer;
	}

	.branch-group.dimmed {
		opacity: 0.4;
	}

	.branch-node {
		fill: var(--bg-header);
		stroke: var(--border);
		stroke-width: 1;
		transition: fill 0.15s;
	}

	.branch-node.expanded {
		fill: var(--bg-hover);
		stroke: var(--accent-blue);
	}

	.branch-group.clickable:hover .branch-node {
		fill: var(--bg-hover);
	}

	.branch-label {
		fill: var(--text-body);
		font-size: 12px;
		font-weight: 600;
	}

	.expand-indicator {
		fill: var(--text-dim);
		font-size: 9px;
	}

	/* Leaf nodes */
	.leaf-node {
		fill: var(--bg-page);
		stroke-width: 1.5;
	}

	.leaf-label {
		fill: var(--text-muted);
		font-size: 11px;
	}

	.scope-dot {
		opacity: 0.9;
	}

	/* Legend */
	.mind-map-legend {
		display: flex;
		gap: 16px;
		align-items: center;
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.legend-title {
		font-size: 11px;
		color: var(--text-dim);
		font-weight: 600;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--text-muted);
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
	}
</style>

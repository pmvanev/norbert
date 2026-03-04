<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		forceSimulation,
		forceLink,
		forceManyBody,
		forceCenter,
		forceCollide,
		type Simulation,
		type SimulationNodeDatum,
		type SimulationLinkDatum,
	} from 'd3-force';
	import type {
		ConfigModelResponse,
		ConfigEdgeResponse,
		NamingConflictResponse,
	} from '$lib/utils/config-api';

	interface Props {
		model: ConfigModelResponse;
	}

	let { model }: Props = $props();

	// -----------------------------------------------------------------------
	// Graph data types (dashboard-local, mirrors graph-builder output shape)
	// -----------------------------------------------------------------------

	interface GraphNode extends SimulationNodeDatum {
		id: string;
		label: string;
		nodeType: string;
		scope: string;
		scopeColor: string;
		subsystem: string;
		isPlugin: boolean;
		isConflicted: boolean;
	}

	interface GraphLink extends SimulationLinkDatum<GraphNode> {
		edgeType: string;
		isConflict: boolean;
	}

	// -----------------------------------------------------------------------
	// Scope color lookup (consistent with other config views)
	// -----------------------------------------------------------------------

	const SCOPE_COLORS: Record<string, string> = {
		user: '#3B82F6',
		project: '#22C55E',
		local: '#EAB308',
		plugin: '#A855F7',
		managed: '#EF4444',
	};

	const scopeColor = (scope: string): string => SCOPE_COLORS[scope] ?? '#94a3b8';

	// -----------------------------------------------------------------------
	// Node shape paths (centered at 0,0, sized for radius r)
	// -----------------------------------------------------------------------

	const nodeShapePath = (nodeType: string, r: number): string => {
		switch (nodeType) {
			case 'agent': {
				// Hexagon
				const points = [];
				for (let i = 0; i < 6; i++) {
					const angle = (Math.PI / 3) * i - Math.PI / 2;
					points.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
				}
				return `M${points.join('L')}Z`;
			}
			case 'skill':
				// Circle (approximated with many-sided polygon for SVG path)
				return '';
			case 'rule': {
				// Square
				const h = r * 0.85;
				return `M${-h},${-h}L${h},${-h}L${h},${h}L${-h},${h}Z`;
			}
			case 'hook': {
				// Diamond
				return `M0,${-r}L${r},0L0,${r}L${-r},0Z`;
			}
			case 'mcp': {
				// Pentagon
				const pts = [];
				for (let i = 0; i < 5; i++) {
					const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
					pts.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
				}
				return `M${pts.join('L')}Z`;
			}
			case 'plugin': {
				// Star (5-pointed)
				const pts2 = [];
				for (let i = 0; i < 10; i++) {
					const angle = (Math.PI / 5) * i - Math.PI / 2;
					const rad = i % 2 === 0 ? r * 1.2 : r * 0.5;
					pts2.push(`${rad * Math.cos(angle)},${rad * Math.sin(angle)}`);
				}
				return `M${pts2.join('L')}Z`;
			}
			case 'settings': {
				// Rounded rectangle (approximation)
				const w = r * 1.1;
				const h2 = r * 0.75;
				return `M${-w},${-h2}L${w},${-h2}L${w},${h2}L${-w},${h2}Z`;
			}
			case 'memory': {
				// Ellipse (SVG path)
				return `M${-r},0A${r},${r * 0.65},0,1,1,${r},0A${r},${r * 0.65},0,1,1,${-r},0Z`;
			}
			default:
				return '';
		}
	};

	// -----------------------------------------------------------------------
	// Build graph data from model (pure transformation)
	// -----------------------------------------------------------------------

	const VIRTUAL_PREFIXES = ['pattern:', 'tool:', 'event:'];
	const isVirtualTarget = (id: string): boolean =>
		VIRTUAL_PREFIXES.some((prefix) => id.startsWith(prefix));

	const buildGraphNodes = (m: ConfigModelResponse): GraphNode[] => {
		const conflictedIds = new Set<string>();
		if (m.conflicts) {
			for (const c of m.conflicts) {
				conflictedIds.add(c.higherScope.id);
				conflictedIds.add(c.lowerScope.id);
			}
		}

		return m.nodes.map((node) => ({
			id: node.id,
			label: node.name,
			nodeType: node.nodeType,
			scope: node.scope,
			scopeColor: scopeColor(node.scope),
			subsystem: node.subsystem,
			isPlugin: node.nodeType === 'plugin',
			isConflicted: conflictedIds.has(node.id),
		}));
	};

	const buildGraphLinks = (
		m: ConfigModelResponse,
		nodeIds: Set<string>,
	): GraphLink[] => {
		const edgeLinks: GraphLink[] = (m.edges ?? [])
			.filter(
				(e: ConfigEdgeResponse) =>
					!isVirtualTarget(e.sourceId) &&
					!isVirtualTarget(e.targetId) &&
					nodeIds.has(e.sourceId) &&
					nodeIds.has(e.targetId),
			)
			.map((e: ConfigEdgeResponse) => ({
				source: e.sourceId,
				target: e.targetId,
				edgeType: e.edgeType,
				isConflict: false,
			}));

		const conflictLinks: GraphLink[] = (m.conflicts ?? [])
			.filter(
				(c: NamingConflictResponse) =>
					nodeIds.has(c.higherScope.id) && nodeIds.has(c.lowerScope.id),
			)
			.map((c: NamingConflictResponse) => ({
				source: c.higherScope.id,
				target: c.lowerScope.id,
				edgeType: 'naming-conflict',
				isConflict: true,
			}));

		return [...edgeLinks, ...conflictLinks];
	};

	// -----------------------------------------------------------------------
	// SVG and simulation state
	// -----------------------------------------------------------------------

	let svgElement: SVGSVGElement;
	let simulation: Simulation<GraphNode, GraphLink> | null = null;
	let graphNodes = $state<GraphNode[]>([]);
	let graphLinks = $state<GraphLink[]>([]);
	let width = $state(800);
	let height = $state(600);

	// -----------------------------------------------------------------------
	// Subsystem filter
	// -----------------------------------------------------------------------

	const ALL_SUBSYSTEMS = [
		'memory', 'settings', 'rules', 'skills', 'agents', 'hooks', 'plugins', 'mcp',
	] as const;

	let activeSubsystems = $state<Set<string>>(new Set(ALL_SUBSYSTEMS));

	const toggleSubsystem = (sub: string) => {
		const next = new Set(activeSubsystems);
		if (next.has(sub)) {
			next.delete(sub);
		} else {
			next.add(sub);
		}
		activeSubsystems = next;
	};

	const isSubsystemActive = (sub: string): boolean => activeSubsystems.has(sub);

	// -----------------------------------------------------------------------
	// Plugin explosion state
	// -----------------------------------------------------------------------

	let expandedPlugins = $state<Set<string>>(new Set());

	const togglePluginExplosion = (pluginId: string) => {
		const next = new Set(expandedPlugins);
		if (next.has(pluginId)) {
			next.delete(pluginId);
		} else {
			next.add(pluginId);
		}
		expandedPlugins = next;
	};

	// -----------------------------------------------------------------------
	// Tooltip state
	// -----------------------------------------------------------------------

	let tooltip = $state<{ x: number; y: number; text: string } | null>(null);

	const showTooltip = (event: MouseEvent, text: string) => {
		tooltip = { x: event.clientX + 12, y: event.clientY - 8, text };
	};

	const hideTooltip = () => {
		tooltip = null;
	};

	// -----------------------------------------------------------------------
	// Drag handling
	// -----------------------------------------------------------------------

	let draggedNode = $state<GraphNode | null>(null);

	const handleDragStart = (event: MouseEvent, node: GraphNode) => {
		event.preventDefault();
		draggedNode = node;
		if (simulation) {
			simulation.alphaTarget(0.3).restart();
		}
		node.fx = node.x;
		node.fy = node.y;
	};

	const handleDrag = (event: MouseEvent) => {
		if (!draggedNode || !svgElement) return;
		const svgRect = svgElement.getBoundingClientRect();
		draggedNode.fx = event.clientX - svgRect.left;
		draggedNode.fy = event.clientY - svgRect.top;
	};

	const handleDragEnd = () => {
		if (!draggedNode) return;
		if (simulation) {
			simulation.alphaTarget(0);
		}
		draggedNode.fx = null;
		draggedNode.fy = null;
		draggedNode = null;
	};

	// -----------------------------------------------------------------------
	// Zoom/pan state
	// -----------------------------------------------------------------------

	let transform = $state({ x: 0, y: 0, k: 1 });
	let isPanning = $state(false);
	let panStart = { x: 0, y: 0 };

	const handleWheel = (event: WheelEvent) => {
		event.preventDefault();
		const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
		const newK = Math.max(0.1, Math.min(5, transform.k * scaleFactor));
		transform = { ...transform, k: newK };
	};

	const handlePanStart = (event: MouseEvent) => {
		if (draggedNode) return;
		// Only start pan if clicking on the SVG background
		if ((event.target as Element)?.tagName === 'svg' || (event.target as Element)?.classList.contains('galaxy-bg')) {
			isPanning = true;
			panStart = { x: event.clientX - transform.x, y: event.clientY - transform.y };
		}
	};

	const handlePanMove = (event: MouseEvent) => {
		if (isPanning && !draggedNode) {
			transform = {
				...transform,
				x: event.clientX - panStart.x,
				y: event.clientY - panStart.y,
			};
		}
	};

	const handlePanEnd = () => {
		isPanning = false;
	};

	// -----------------------------------------------------------------------
	// Filtered data
	// -----------------------------------------------------------------------

	let filteredNodes = $derived.by(() => {
		return graphNodes.filter((n) => isSubsystemActive(n.subsystem));
	});

	let filteredNodeIds = $derived.by(() => {
		return new Set(filteredNodes.map((n) => n.id));
	});

	let filteredLinks = $derived.by(() => {
		return graphLinks.filter((l) => {
			const sourceId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
			const targetId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
			return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
		});
	});

	// -----------------------------------------------------------------------
	// Link position helpers (source/target can be object or string after sim)
	// -----------------------------------------------------------------------

	const linkSourceX = (l: GraphLink): number =>
		typeof l.source === 'object' ? (l.source as GraphNode).x ?? 0 : 0;
	const linkSourceY = (l: GraphLink): number =>
		typeof l.source === 'object' ? (l.source as GraphNode).y ?? 0 : 0;
	const linkTargetX = (l: GraphLink): number =>
		typeof l.target === 'object' ? (l.target as GraphNode).x ?? 0 : 0;
	const linkTargetY = (l: GraphLink): number =>
		typeof l.target === 'object' ? (l.target as GraphNode).y ?? 0 : 0;

	// -----------------------------------------------------------------------
	// Node radius
	// -----------------------------------------------------------------------

	const nodeRadius = (nodeType: string): number => {
		if (nodeType === 'plugin') return 18;
		return 14;
	};

	// -----------------------------------------------------------------------
	// Subsystem label lookup
	// -----------------------------------------------------------------------

	const SUBSYSTEM_LABELS: Record<string, string> = {
		memory: 'Memory',
		settings: 'Settings',
		rules: 'Rules',
		skills: 'Skills',
		agents: 'Agents',
		hooks: 'Hooks',
		plugins: 'Plugins',
		mcp: 'MCP',
	};

	// -----------------------------------------------------------------------
	// Initialize simulation
	// -----------------------------------------------------------------------

	const initSimulation = () => {
		const allNodes = buildGraphNodes(model);
		const nodeIds = new Set(allNodes.map((n) => n.id));
		const allLinks = buildGraphLinks(model, nodeIds);

		graphNodes = allNodes;
		graphLinks = allLinks;

		if (simulation) {
			simulation.stop();
		}

		simulation = forceSimulation<GraphNode>(graphNodes)
			.force(
				'link',
				forceLink<GraphNode, GraphLink>(graphLinks)
					.id((d) => d.id)
					.distance(80),
			)
			.force('charge', forceManyBody().strength(-200))
			.force('center', forceCenter(width / 2, height / 2))
			.force('collide', forceCollide<GraphNode>().radius((d) => nodeRadius(d.nodeType) + 6))
			.on('tick', () => {
				// Trigger reactivity by reassigning
				graphNodes = [...graphNodes];
				graphLinks = [...graphLinks];
			});

		// Limit simulation ticks for performance
		simulation.alpha(1).alphaDecay(0.02);
	};

	// -----------------------------------------------------------------------
	// Resize observer
	// -----------------------------------------------------------------------

	let containerElement: HTMLDivElement;

	const observeResize = () => {
		if (!containerElement) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				width = entry.contentRect.width || 800;
				height = Math.max(entry.contentRect.height, 400);
			}
		});
		observer.observe(containerElement);
		return observer;
	};

	let resizeObserver: ResizeObserver | undefined;

	onMount(() => {
		resizeObserver = observeResize();
		initSimulation();
	});

	onDestroy(() => {
		if (simulation) {
			simulation.stop();
			simulation = null;
		}
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
	});

	// Reinitialize when model changes
	$effect(() => {
		// Access model to track dependency
		const _m = model;
		if (typeof window !== 'undefined') {
			initSimulation();
		}
	});
</script>

<div class="galaxy" data-testid="config-galaxy" bind:this={containerElement}>
	<div class="galaxy-controls">
		<div class="subsystem-filter">
			<span class="filter-label">Subsystems:</span>
			{#each ALL_SUBSYSTEMS as sub}
				<button
					class="filter-btn"
					class:active={isSubsystemActive(sub)}
					onclick={() => toggleSubsystem(sub)}
				>
					{SUBSYSTEM_LABELS[sub]}
				</button>
			{/each}
		</div>
	</div>

	<div class="galaxy-canvas">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<svg
			bind:this={svgElement}
			{width}
			{height}
			class="galaxy-svg"
			onmousedown={handlePanStart}
			onmousemove={(e) => { handleDrag(e); handlePanMove(e); }}
			onmouseup={() => { handleDragEnd(); handlePanEnd(); }}
			onmouseleave={() => { handleDragEnd(); handlePanEnd(); hideTooltip(); }}
			onwheel={handleWheel}
		>
			<rect class="galaxy-bg" {width} {height} fill="transparent" />

			<g transform="translate({transform.x}, {transform.y}) scale({transform.k})">
				<!-- Links -->
				{#each filteredLinks as link}
					<line
						x1={linkSourceX(link)}
						y1={linkSourceY(link)}
						x2={linkTargetX(link)}
						y2={linkTargetY(link)}
						class="galaxy-link"
						class:conflict-link={link.isConflict}
						onmouseenter={(e) => {
							if (link.isConflict) showTooltip(e, 'Naming conflict: higher scope overrides');
						}}
						onmouseleave={hideTooltip}
					/>
				{/each}

				<!-- Nodes -->
				{#each filteredNodes as node}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<g
						transform="translate({node.x ?? 0}, {node.y ?? 0})"
						class="galaxy-node"
						class:conflicted={node.isConflicted}
						class:plugin-node={node.isPlugin}
						onmousedown={(e) => handleDragStart(e, node)}
						onmouseenter={(e) => {
							const parts = [`${node.label}`, `Type: ${node.nodeType}`, `Scope: ${node.scope}`, `Subsystem: ${node.subsystem}`];
							if (node.isConflicted) parts.push('WARNING: Naming conflict');
							if (node.isPlugin) parts.push('Click to expand');
							showTooltip(e, parts.join('\n'));
						}}
						onmouseleave={hideTooltip}
						onclick={() => {
							if (node.isPlugin) togglePluginExplosion(node.id);
						}}
						role={node.isPlugin ? 'button' : undefined}
						tabindex={node.isPlugin ? 0 : undefined}
					>
						{#if node.nodeType === 'skill'}
							<!-- Circle for skills -->
							<circle
								r={nodeRadius(node.nodeType)}
								fill={node.scopeColor}
								class="node-shape"
								class:conflicted-shape={node.isConflicted}
							/>
						{:else}
							<!-- Path-based shapes for other types -->
							{@const shapePath = nodeShapePath(node.nodeType, nodeRadius(node.nodeType))}
							{#if shapePath}
								<path
									d={shapePath}
									fill={node.scopeColor}
									class="node-shape"
									class:conflicted-shape={node.isConflicted}
								/>
							{:else}
								<circle
									r={nodeRadius(node.nodeType)}
									fill={node.scopeColor}
									class="node-shape"
									class:conflicted-shape={node.isConflicted}
								/>
							{/if}
						{/if}

						<!-- Label -->
						<text
							y={nodeRadius(node.nodeType) + 14}
							text-anchor="middle"
							class="node-label"
						>
							{node.label.length > 16 ? node.label.slice(0, 14) + '...' : node.label}
						</text>

						<!-- Conflict indicator -->
						{#if node.isConflicted}
							<circle
								cx={nodeRadius(node.nodeType) - 2}
								cy={-nodeRadius(node.nodeType) + 2}
								r="5"
								fill="#EF4444"
								class="conflict-indicator"
							/>
							<text
								x={nodeRadius(node.nodeType) - 2}
								y={-nodeRadius(node.nodeType) + 5}
								text-anchor="middle"
								class="conflict-indicator-text"
							>!</text>
						{/if}
					</g>
				{/each}
			</g>
		</svg>
	</div>

	<!-- Tooltip -->
	{#if tooltip}
		<div class="galaxy-tooltip" style="left: {tooltip.x}px; top: {tooltip.y}px;">
			{#each tooltip.text.split('\n') as line}
				<div class="tooltip-line" class:warning={line.startsWith('WARNING')}>{line}</div>
			{/each}
		</div>
	{/if}

	<!-- Legend -->
	<div class="galaxy-legend">
		<div class="legend-section">
			<span class="legend-title">Shapes:</span>
			<span class="legend-item">
				<svg width="16" height="16" viewBox="-8 -8 16 16">
					<path d={nodeShapePath('agent', 7)} fill="var(--text-dim)" />
				</svg>
				Agent
			</span>
			<span class="legend-item">
				<svg width="16" height="16" viewBox="-8 -8 16 16">
					<circle r="7" fill="var(--text-dim)" />
				</svg>
				Skill
			</span>
			<span class="legend-item">
				<svg width="16" height="16" viewBox="-8 -8 16 16">
					<path d={nodeShapePath('rule', 7)} fill="var(--text-dim)" />
				</svg>
				Rule
			</span>
			<span class="legend-item">
				<svg width="16" height="16" viewBox="-8 -8 16 16">
					<path d={nodeShapePath('hook', 7)} fill="var(--text-dim)" />
				</svg>
				Hook
			</span>
			<span class="legend-item">
				<svg width="16" height="16" viewBox="-8 -8 16 16">
					<path d={nodeShapePath('mcp', 7)} fill="var(--text-dim)" />
				</svg>
				MCP
			</span>
			<span class="legend-item">
				<svg width="16" height="16" viewBox="-10 -10 20 20">
					<path d={nodeShapePath('plugin', 8)} fill="var(--text-dim)" />
				</svg>
				Plugin
			</span>
			<span class="legend-item">
				<svg width="16" height="16" viewBox="-8 -8 16 16">
					<path d={nodeShapePath('settings', 7)} fill="var(--text-dim)" />
				</svg>
				Settings
			</span>
			<span class="legend-item">
				<svg width="16" height="16" viewBox="-8 -8 16 16">
					<path d={nodeShapePath('memory', 7)} fill="var(--text-dim)" />
				</svg>
				Memory
			</span>
		</div>
		<div class="legend-section">
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
		<div class="legend-section">
			<span class="legend-title">Edges:</span>
			<span class="legend-item">
				<svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="var(--text-dim)" stroke-width="1.5" /></svg>
				Cross-reference
			</span>
			<span class="legend-item">
				<svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#EF4444" stroke-width="2.5" /></svg>
				Naming conflict
			</span>
		</div>
	</div>
</div>

<style>
	.galaxy {
		background: var(--bg-card);
		border-radius: var(--radius);
		padding: 16px;
		position: relative;
	}

	.galaxy-controls {
		margin-bottom: 12px;
	}

	.subsystem-filter {
		display: flex;
		gap: 6px;
		align-items: center;
		flex-wrap: wrap;
	}

	.filter-label {
		font-size: 12px;
		color: var(--text-dim);
		font-weight: 600;
		margin-right: 4px;
	}

	.filter-btn {
		font-size: 11px;
		padding: 3px 10px;
		border-radius: 12px;
		border: 1px solid var(--border);
		background: var(--bg-page);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s;
	}

	.filter-btn.active {
		background: var(--bg-hover);
		color: var(--text-body);
		border-color: var(--accent-blue);
	}

	.filter-btn:hover {
		background: var(--bg-hover);
	}

	.galaxy-canvas {
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--bg-page);
		min-height: 400px;
	}

	.galaxy-svg {
		display: block;
		cursor: grab;
	}

	.galaxy-svg:active {
		cursor: grabbing;
	}

	/* Links */
	.galaxy-link {
		stroke: var(--border);
		stroke-width: 1;
		stroke-opacity: 0.5;
	}

	.galaxy-link.conflict-link {
		stroke: #EF4444;
		stroke-width: 2.5;
		stroke-opacity: 0.8;
	}

	/* Nodes */
	.galaxy-node {
		cursor: grab;
	}

	.galaxy-node:active {
		cursor: grabbing;
	}

	.galaxy-node.plugin-node {
		cursor: pointer;
	}

	.node-shape {
		stroke: var(--bg-page);
		stroke-width: 2;
		opacity: 0.9;
		transition: opacity 0.15s;
	}

	.galaxy-node:hover .node-shape {
		opacity: 1;
		stroke-width: 3;
	}

	.node-shape.conflicted-shape {
		stroke: #EF4444;
		stroke-width: 2.5;
	}

	.node-label {
		fill: var(--text-muted);
		font-size: 9px;
		pointer-events: none;
		user-select: none;
	}

	/* Conflict indicator */
	.conflict-indicator {
		stroke: var(--bg-page);
		stroke-width: 1.5;
	}

	.conflict-indicator-text {
		fill: white;
		font-size: 8px;
		font-weight: 700;
		pointer-events: none;
	}

	/* Tooltip */
	.galaxy-tooltip {
		position: fixed;
		z-index: 100;
		background: var(--bg-header);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 8px 12px;
		font-size: 11px;
		color: var(--text-body);
		pointer-events: none;
		max-width: 260px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.tooltip-line {
		white-space: nowrap;
	}

	.tooltip-line.warning {
		color: #EF4444;
		font-weight: 600;
	}

	/* Legend */
	.galaxy-legend {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.legend-section {
		display: flex;
		gap: 12px;
		align-items: center;
		flex-wrap: wrap;
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

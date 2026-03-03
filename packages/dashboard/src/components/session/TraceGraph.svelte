<script lang="ts">
	import { hierarchy, tree } from 'd3-hierarchy';
	import StatusBadge from '../shared/StatusBadge.svelte';
	import EmptyState from '../shared/EmptyState.svelte';
	import { formatCurrency, formatTokens } from '$lib/utils/format';
	import type { TraceGraphResponse, TraceAgentNode } from '$lib/api-client';

	interface Props {
		trace: TraceGraphResponse;
	}

	let { trace }: Props = $props();

	interface LayoutNode {
		agentId: string;
		toolCallCount: number;
		inputTokens: number;
		outputTokens: number;
		estimatedCost: number;
		status: string;
		x: number;
		y: number;
		children: LayoutNode[];
	}

	const nodeWidth = 200;
	const nodeHeight = 80;
	const margin = { top: 40, right: 40, bottom: 40, left: 40 };

	let layoutNodes = $derived.by(() => {
		if (!trace.rootAgent) return [];

		const root = hierarchy<TraceAgentNode>(trace.rootAgent, d => [...d.children]);
		const treeLayout = tree<TraceAgentNode>().nodeSize([nodeWidth + 40, nodeHeight + 60]);
		const laid = treeLayout(root);

		return laid.descendants().map(d => ({
			agentId: d.data.agentId,
			toolCallCount: d.data.toolCallCount,
			inputTokens: d.data.inputTokens,
			outputTokens: d.data.outputTokens,
			estimatedCost: d.data.estimatedCost,
			status: d.data.status,
			x: d.x,
			y: d.y,
			children: [],
		}));
	});

	let layoutLinks = $derived.by(() => {
		if (!trace.rootAgent) return [];

		const root = hierarchy<TraceAgentNode>(trace.rootAgent, d => [...d.children]);
		const treeLayout = tree<TraceAgentNode>().nodeSize([nodeWidth + 40, nodeHeight + 60]);
		const laid = treeLayout(root);

		return laid.links().map(l => ({
			source: { x: l.source.x, y: l.source.y },
			target: { x: l.target.x, y: l.target.y },
		}));
	});

	let viewBox = $derived.by(() => {
		if (layoutNodes.length === 0) return '0 0 400 200';
		const xs = layoutNodes.map(n => n.x);
		const ys = layoutNodes.map(n => n.y);
		const minX = Math.min(...xs) - nodeWidth / 2 - margin.left;
		const minY = Math.min(...ys) - margin.top;
		const maxX = Math.max(...xs) + nodeWidth / 2 + margin.right;
		const maxY = Math.max(...ys) + nodeHeight + margin.bottom;
		return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
	});
</script>

<div class="trace-graph" data-testid="trace-graph">
	{#if layoutNodes.length === 0}
		<EmptyState message="No agent trace data available." />
	{:else}
		<svg {viewBox} class="trace-svg">
			{#each layoutLinks as link}
				<line
					x1={link.source.x}
					y1={link.source.y + nodeHeight / 2}
					x2={link.target.x}
					y2={link.target.y - nodeHeight / 2 + 10}
					class="trace-link"
				/>
			{/each}

			{#each layoutNodes as node}
				<g transform="translate({node.x - nodeWidth / 2}, {node.y - nodeHeight / 2})">
					<rect
						width={nodeWidth}
						height={nodeHeight}
						rx="6"
						class="trace-node"
						class:active={node.status === 'active'}
						class:failed={node.status === 'failed'}
					/>
					<text x="10" y="22" class="node-id">{node.agentId}</text>
					<text x="10" y="42" class="node-detail">
						{node.toolCallCount} calls | {formatTokens(node.inputTokens + node.outputTokens)} tokens
					</text>
					<text x="10" y="60" class="node-cost">{formatCurrency(node.estimatedCost)}</text>
				</g>
			{/each}
		</svg>
	{/if}
</div>

<style>
	.trace-graph {
		background: var(--bg-card);
		border-radius: var(--radius);
		padding: 16px;
		overflow-x: auto;
	}

	.trace-svg {
		width: 100%;
		min-height: 300px;
	}

	.trace-link {
		stroke: var(--border);
		stroke-width: 2;
	}

	.trace-node {
		fill: var(--bg-header);
		stroke: var(--border);
		stroke-width: 1;
	}

	.trace-node.active {
		stroke: var(--status-green);
	}

	.trace-node.failed {
		stroke: var(--status-red);
	}

	.node-id {
		fill: var(--accent-blue);
		font-size: 13px;
		font-weight: 600;
	}

	.node-detail {
		fill: var(--text-muted);
		font-size: 11px;
	}

	.node-cost {
		fill: var(--text-body);
		font-size: 12px;
		font-family: monospace;
	}
</style>

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TraceGraph from './TraceGraph.svelte';
import type { TraceGraphResponse } from '$lib/api-client';

describe('TraceGraph', () => {
	it('shows empty state when no root agent', () => {
		const trace: TraceGraphResponse = {
			sessionId: 'sess-1',
			rootAgent: {
				agentId: 'root',
				parentAgentId: undefined,
				toolCallCount: 0,
				inputTokens: 0,
				outputTokens: 0,
				estimatedCost: 0,
				status: 'completed',
				children: [],
			},
			allAgents: [],
			edges: [],
		};
		render(TraceGraph, { props: { trace } });
		expect(screen.getByTestId('trace-graph')).toBeInTheDocument();
	});

	it('renders SVG with agent nodes', () => {
		const trace: TraceGraphResponse = {
			sessionId: 'sess-1',
			rootAgent: {
				agentId: 'main',
				parentAgentId: undefined,
				toolCallCount: 5,
				inputTokens: 10000,
				outputTokens: 2000,
				estimatedCost: 0.45,
				status: 'completed',
				children: [
					{
						agentId: 'sub-1',
						parentAgentId: 'main',
						toolCallCount: 3,
						inputTokens: 5000,
						outputTokens: 1000,
						estimatedCost: 0.20,
						status: 'completed',
						children: [],
					},
				],
			},
			allAgents: [],
			edges: [],
		};

		render(TraceGraph, { props: { trace } });
		const svg = screen.getByTestId('trace-graph').querySelector('svg');
		expect(svg).not.toBeNull();
		expect(screen.getByText('main')).toBeInTheDocument();
		expect(screen.getByText('sub-1')).toBeInTheDocument();
	});
});

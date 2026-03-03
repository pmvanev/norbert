import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CostWaterfall from './CostWaterfall.svelte';
import type { CostBreakdownResponse } from '$lib/api-client';

describe('CostWaterfall', () => {
	const costs: CostBreakdownResponse = {
		sessionId: 'sess-1',
		totalCost: 1.75,
		agents: [
			{
				agentId: 'main',
				inputTokens: 20000,
				outputTokens: 5000,
				estimatedCost: 1.25,
				toolCalls: [
					{ toolName: 'Read', inputTokens: 5000, outputTokens: 1000, estimatedCost: 0.30 },
				],
			},
			{
				agentId: 'sub-1',
				inputTokens: 8000,
				outputTokens: 2000,
				estimatedCost: 0.50,
				toolCalls: [],
			},
		],
		costByMcpServer: [
			{ serverName: 'github', inputTokens: 3000, outputTokens: 500, estimatedCost: 0.15 },
		],
		costMethodologyNote: 'Based on published API rates.',
	};

	it('renders total cost', () => {
		render(CostWaterfall, { props: { costs } });
		expect(screen.getByText('$1.75')).toBeInTheDocument();
	});

	it('renders agent rows with costs', () => {
		render(CostWaterfall, { props: { costs } });
		expect(screen.getByText('main')).toBeInTheDocument();
		expect(screen.getByText('$1.25')).toBeInTheDocument();
		expect(screen.getByText('sub-1')).toBeInTheDocument();
	});

	it('renders tool call details', () => {
		render(CostWaterfall, { props: { costs } });
		expect(screen.getByText('Read')).toBeInTheDocument();
	});

	it('renders MCP server costs', () => {
		render(CostWaterfall, { props: { costs } });
		expect(screen.getByText('github')).toBeInTheDocument();
	});

	it('shows empty state when no agents', () => {
		const empty: CostBreakdownResponse = {
			sessionId: 'sess-2',
			totalCost: 0,
			agents: [],
			costByMcpServer: [],
			costMethodologyNote: '',
		};
		render(CostWaterfall, { props: { costs: empty } });
		expect(screen.getByText('No cost data for this session.')).toBeInTheDocument();
	});
});

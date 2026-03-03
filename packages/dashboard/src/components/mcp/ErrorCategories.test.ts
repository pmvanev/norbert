import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ErrorCategories from './ErrorCategories.svelte';
import type { McpServerDetailResponse } from '$lib/api-client';

describe('ErrorCategories', () => {
	it('shows empty state when no errors', () => {
		const servers: McpServerDetailResponse[] = [{
			serverName: 'test',
			connectionStatus: 'connected',
			health: { serverName: 'test', status: 'healthy', callCount: 5, errorCount: 0, avgLatencyMs: 50, tokenOverhead: 100 },
			errorsByCategory: [],
			diagnostics: [],
			latencyTrend: 'stable',
			recentCalls: [],
		}];
		render(ErrorCategories, { props: { servers } });
		expect(screen.getByText('No errors detected.')).toBeInTheDocument();
	});

	it('aggregates error categories across servers', () => {
		const servers: McpServerDetailResponse[] = [
			{
				serverName: 'a',
				connectionStatus: 'connected',
				health: { serverName: 'a', status: 'degraded', callCount: 10, errorCount: 3, avgLatencyMs: 100, tokenOverhead: 500 },
				errorsByCategory: [{ category: 'timeout', count: 2 }, { category: 'connection', count: 1 }],
				diagnostics: [],
				latencyTrend: 'stable',
				recentCalls: [],
			},
			{
				serverName: 'b',
				connectionStatus: 'connected',
				health: { serverName: 'b', status: 'healthy', callCount: 5, errorCount: 1, avgLatencyMs: 50, tokenOverhead: 200 },
				errorsByCategory: [{ category: 'timeout', count: 1 }],
				diagnostics: [],
				latencyTrend: 'stable',
				recentCalls: [],
			},
		];
		render(ErrorCategories, { props: { servers } });
		expect(screen.getByText('timeout')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText('connection')).toBeInTheDocument();
	});
});

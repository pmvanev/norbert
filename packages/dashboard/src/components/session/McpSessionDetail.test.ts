import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import McpSessionDetail from './McpSessionDetail.svelte';
import type { McpServerDetailResponse } from '$lib/api-client';

describe('McpSessionDetail', () => {
	it('shows empty state when no servers', () => {
		render(McpSessionDetail, { props: { servers: [] } });
		expect(screen.getByText('No MCP servers active in this session.')).toBeInTheDocument();
	});

	it('renders server card with stats', () => {
		const servers: McpServerDetailResponse[] = [{
			serverName: 'github-mcp',
			connectionStatus: 'connected',
			health: {
				serverName: 'github-mcp',
				status: 'healthy',
				callCount: 15,
				errorCount: 2,
				avgLatencyMs: 120,
				tokenOverhead: 1500,
			},
			errorsByCategory: [],
			diagnostics: [
				{ category: 'performance', recommendation: 'Consider caching tool results.' },
			],
			latencyTrend: 'stable',
			recentCalls: [
				{ serverName: 'github-mcp', toolName: 'search_repos', timestamp: '2026-03-01T10:00:00Z', latencyMs: 150, status: 'success' },
			],
		}];

		render(McpSessionDetail, { props: { servers } });
		expect(screen.getByText('github-mcp')).toBeInTheDocument();
		expect(screen.getByText('15')).toBeInTheDocument();
		expect(screen.getByText('performance')).toBeInTheDocument();
		expect(screen.getByText('search_repos')).toBeInTheDocument();
	});
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ToolCallExplorer from './ToolCallExplorer.svelte';
import type { McpServerDetailResponse } from '$lib/api-client';

describe('ToolCallExplorer', () => {
	it('shows empty state when no calls', () => {
		render(ToolCallExplorer, { props: { servers: [] } });
		expect(screen.getByText('No tool calls recorded.')).toBeInTheDocument();
	});

	it('renders recent tool calls across servers', () => {
		const servers: McpServerDetailResponse[] = [{
			serverName: 'github',
			connectionStatus: 'connected',
			health: { serverName: 'github', status: 'healthy', callCount: 5, errorCount: 0, avgLatencyMs: 100, tokenOverhead: 500 },
			errorsByCategory: [],
			diagnostics: [],
			latencyTrend: 'stable',
			recentCalls: [
				{ serverName: 'github', toolName: 'search_repos', timestamp: '2026-03-01T10:00:00Z', latencyMs: 120, status: 'success' },
				{ serverName: 'github', toolName: 'get_file', timestamp: '2026-03-01T09:59:00Z', latencyMs: 80, status: 'error', errorDetail: 'Not found' },
			],
		}];

		render(ToolCallExplorer, { props: { servers } });
		expect(screen.getByText('search_repos')).toBeInTheDocument();
		expect(screen.getByText('get_file')).toBeInTheDocument();
		expect(screen.getByText('120ms')).toBeInTheDocument();
	});
});

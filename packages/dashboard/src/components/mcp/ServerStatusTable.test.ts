import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ServerStatusTable from './ServerStatusTable.svelte';
import type { McpServerDetailResponse } from '$lib/api-client';

const makeServer = (name: string): McpServerDetailResponse => ({
	serverName: name,
	connectionStatus: 'connected',
	health: { serverName: name, status: 'healthy', callCount: 10, errorCount: 0, avgLatencyMs: 100, tokenOverhead: 500 },
	errorsByCategory: [],
	diagnostics: [],
	latencyTrend: 'stable',
	recentCalls: [],
});

describe('ServerStatusTable', () => {
	it('renders server rows', () => {
		render(ServerStatusTable, { props: { servers: [makeServer('github'), makeServer('slack')] } });
		expect(screen.getByText('github')).toBeInTheDocument();
		expect(screen.getByText('slack')).toBeInTheDocument();
	});
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RecentSessionsTable from './RecentSessionsTable.svelte';

describe('RecentSessionsTable', () => {
	it('shows empty state when no sessions', () => {
		render(RecentSessionsTable, { props: { sessions: [] } });
		expect(screen.getByText('No sessions captured yet.')).toBeInTheDocument();
	});

	it('renders session rows', () => {
		const sessions = [{
			id: 'sess-abc123def456',
			startTime: '2026-03-01T10:00:00Z',
			model: 'claude-opus-4',
			agentCount: 3,
			eventCount: 15,
			totalInputTokens: 50000,
			totalOutputTokens: 10000,
			estimatedCost: 1.25,
			mcpErrorCount: 0,
			status: 'completed',
		}] as const;

		render(RecentSessionsTable, { props: { sessions } });
		expect(screen.getByText('sess-abc123d')).toBeInTheDocument();
		expect(screen.getByText('claude-opus-4')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText('$1.25')).toBeInTheDocument();
	});
});

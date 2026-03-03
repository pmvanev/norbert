import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SessionList from './SessionList.svelte';

describe('SessionList', () => {
	it('shows empty state when no sessions', () => {
		render(SessionList, { props: { sessions: [] } });
		expect(screen.getByText('No sessions match the current filters.')).toBeInTheDocument();
	});

	it('renders session rows', () => {
		const sessions = [{
			id: 'sess-xyz123456789',
			startTime: '2026-03-01T10:00:00Z',
			model: 'claude-sonnet-4',
			agentCount: 2,
			eventCount: 10,
			totalInputTokens: 30000,
			totalOutputTokens: 8000,
			estimatedCost: 0.85,
			mcpErrorCount: 0,
			status: 'completed',
		}] as const;

		render(SessionList, { props: { sessions } });
		expect(screen.getByText('sess-xyz1234')).toBeInTheDocument();
		expect(screen.getByText('claude-sonnet-4')).toBeInTheDocument();
		expect(screen.getByText('$0.85')).toBeInTheDocument();
	});
});

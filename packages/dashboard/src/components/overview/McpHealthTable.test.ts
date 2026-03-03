import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import McpHealthTable from './McpHealthTable.svelte';

describe('McpHealthTable', () => {
	it('shows empty state when no servers', () => {
		render(McpHealthTable, { props: { servers: [] } });
		expect(screen.getByText('No MCP servers detected.')).toBeInTheDocument();
	});

	it('renders server rows', () => {
		const servers = [{
			serverName: 'github-mcp',
			status: 'healthy' as const,
			callCount: 24,
			errorCount: 1,
			avgLatencyMs: 150.5,
			tokenOverhead: 3200,
		}];

		render(McpHealthTable, { props: { servers } });
		expect(screen.getByText('github-mcp')).toBeInTheDocument();
		expect(screen.getByText('24')).toBeInTheDocument();
		expect(screen.getByText('151ms')).toBeInTheDocument();
	});
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import OverviewCards from './OverviewCards.svelte';

describe('OverviewCards', () => {
	const summary = {
		sessionCount: 42,
		totalTokens: 1_500_000,
		estimatedCost: 3.75,
		mcpServerCount: 2,
	};

	it('renders session count', () => {
		render(OverviewCards, { props: { summary } });
		expect(screen.getByText('42')).toBeInTheDocument();
	});

	it('renders formatted token count', () => {
		render(OverviewCards, { props: { summary } });
		expect(screen.getByText('1.5M')).toBeInTheDocument();
	});

	it('renders formatted cost', () => {
		render(OverviewCards, { props: { summary } });
		expect(screen.getByText('$3.75')).toBeInTheDocument();
	});

	it('renders MCP server count', () => {
		render(OverviewCards, { props: { summary } });
		expect(screen.getByText('2')).toBeInTheDocument();
	});
});

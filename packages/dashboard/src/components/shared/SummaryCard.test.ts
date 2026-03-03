import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SummaryCard from './SummaryCard.svelte';

describe('SummaryCard', () => {
	it('renders label and value', () => {
		render(SummaryCard, { props: { label: 'Sessions', value: '42' } });
		expect(screen.getByText('Sessions')).toBeInTheDocument();
		expect(screen.getByText('42')).toBeInTheDocument();
	});

	it('renders subtitle when provided', () => {
		render(SummaryCard, { props: { label: 'Cost', value: '$1.50', subtitle: 'last 24h' } });
		expect(screen.getByText('last 24h')).toBeInTheDocument();
	});

	it('omits subtitle when not provided', () => {
		render(SummaryCard, { props: { label: 'Tokens', value: '1.2M' } });
		expect(screen.queryByText('last 24h')).not.toBeInTheDocument();
	});
});

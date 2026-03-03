import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DailyTrendChart from './DailyTrendChart.svelte';

describe('DailyTrendChart', () => {
	it('shows empty message when no trends', () => {
		render(DailyTrendChart, { props: { trends: [] } });
		expect(screen.getByText('Not enough data for trends.')).toBeInTheDocument();
	});

	it('renders canvas when trends are provided', () => {
		const trends = [
			{ date: '2026-03-01', sessionCount: 5, totalTokens: 100000, totalCost: 2.50 },
			{ date: '2026-03-02', sessionCount: 8, totalTokens: 200000, totalCost: 4.00 },
		];

		render(DailyTrendChart, { props: { trends } });
		const chart = screen.getByTestId('daily-trend-chart');
		expect(chart.querySelector('canvas')).not.toBeNull();
	});
});

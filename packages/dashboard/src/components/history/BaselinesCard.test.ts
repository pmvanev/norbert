import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import BaselinesCard from './BaselinesCard.svelte';

describe('BaselinesCard', () => {
	it('renders baseline values', () => {
		const baselines = {
			averageCost: 1.25,
			p95Cost: 3.50,
			averageDuration: 125,
			sampleSize: 42,
			isConfident: true,
			confidenceNote: undefined,
		};

		render(BaselinesCard, { props: { baselines } });
		expect(screen.getByText('$1.25')).toBeInTheDocument();
		expect(screen.getByText('$3.50')).toBeInTheDocument();
		expect(screen.getByText('2m 5s')).toBeInTheDocument();
		expect(screen.getByText('42')).toBeInTheDocument();
	});

	it('shows confidence note when not confident', () => {
		const baselines = {
			averageCost: 0.50,
			p95Cost: 0.75,
			averageDuration: 30,
			sampleSize: 3,
			isConfident: false,
			confidenceNote: 'Need 10+ sessions',
		};

		render(BaselinesCard, { props: { baselines } });
		expect(screen.getByText('Need 10+ sessions')).toBeInTheDocument();
	});
});

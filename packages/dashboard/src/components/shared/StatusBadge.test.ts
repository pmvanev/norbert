import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StatusBadge from './StatusBadge.svelte';

describe('StatusBadge', () => {
	it('renders the status text', () => {
		render(StatusBadge, { props: { status: 'healthy' } });
		expect(screen.getByTestId('status-badge')).toHaveTextContent('healthy');
	});

	it('renders unhealthy status', () => {
		render(StatusBadge, { props: { status: 'unhealthy' } });
		expect(screen.getByTestId('status-badge')).toHaveTextContent('unhealthy');
	});

	it('renders completed status', () => {
		render(StatusBadge, { props: { status: 'completed' } });
		expect(screen.getByTestId('status-badge')).toHaveTextContent('completed');
	});
});

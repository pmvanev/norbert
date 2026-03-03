import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import EmptyState from './EmptyState.svelte';

describe('EmptyState', () => {
	it('renders default message', () => {
		render(EmptyState, {});
		expect(screen.getByText('No data available.')).toBeInTheDocument();
	});

	it('renders custom message', () => {
		render(EmptyState, { props: { message: 'No sessions found.' } });
		expect(screen.getByText('No sessions found.')).toBeInTheDocument();
	});
});

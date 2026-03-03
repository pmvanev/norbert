import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FilterControls from './FilterControls.svelte';

describe('FilterControls', () => {
	it('renders filter inputs', () => {
		render(FilterControls, { props: { filters: {}, onApply: vi.fn() } });
		expect(screen.getByLabelText('From')).toBeInTheDocument();
		expect(screen.getByLabelText('To')).toBeInTheDocument();
		expect(screen.getByLabelText('Min Cost')).toBeInTheDocument();
	});

	it('calls onApply when button is clicked', async () => {
		const onApply = vi.fn();
		render(FilterControls, { props: { filters: { sortBy: 'startTime', sortOrder: 'desc' }, onApply } });
		await fireEvent.click(screen.getByText('Apply'));
		expect(onApply).toHaveBeenCalled();
	});
});

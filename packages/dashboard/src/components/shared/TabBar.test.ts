import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TabBar from './TabBar.svelte';

describe('TabBar', () => {
	const tabs = ['Trace', 'Cost', 'MCP'] as const;

	it('renders all tabs', () => {
		render(TabBar, { props: { tabs, activeTab: 'Trace', onTabChange: vi.fn() } });
		expect(screen.getByText('Trace')).toBeInTheDocument();
		expect(screen.getByText('Cost')).toBeInTheDocument();
		expect(screen.getByText('MCP')).toBeInTheDocument();
	});

	it('marks active tab with aria-selected', () => {
		render(TabBar, { props: { tabs, activeTab: 'Cost', onTabChange: vi.fn() } });
		expect(screen.getByText('Cost')).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByText('Trace')).toHaveAttribute('aria-selected', 'false');
	});

	it('calls onTabChange when tab is clicked', async () => {
		const onTabChange = vi.fn();
		render(TabBar, { props: { tabs, activeTab: 'Trace', onTabChange } });
		await fireEvent.click(screen.getByText('MCP'));
		expect(onTabChange).toHaveBeenCalledWith('MCP');
	});
});

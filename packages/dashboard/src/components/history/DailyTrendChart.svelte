<script lang="ts">
	import { onMount } from 'svelte';
	import type { DailyTrendResponse } from '$lib/api-client';

	interface Props {
		trends: readonly DailyTrendResponse[];
	}

	let { trends }: Props = $props();

	let canvasRef: HTMLCanvasElement | undefined = $state();
	let chartInstance: any = null;

	$effect(() => {
		if (!canvasRef || trends.length === 0) return;

		const loadChart = async () => {
			const { Chart, registerables } = await import('chart.js');
			Chart.register(...registerables);

			if (chartInstance) {
				chartInstance.destroy();
			}

			chartInstance = new Chart(canvasRef!, {
				type: 'bar',
				data: {
					labels: trends.map(t => t.date),
					datasets: [
						{
							label: 'Sessions',
							data: trends.map(t => t.sessionCount),
							backgroundColor: 'rgba(56, 189, 248, 0.6)',
							borderColor: 'rgba(56, 189, 248, 1)',
							borderWidth: 1,
							yAxisID: 'y',
						},
						{
							label: 'Cost ($)',
							data: trends.map(t => t.totalCost),
							type: 'line',
							borderColor: 'rgba(167, 139, 250, 1)',
							backgroundColor: 'rgba(167, 139, 250, 0.1)',
							fill: true,
							tension: 0.3,
							yAxisID: 'y1',
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: { mode: 'index', intersect: false },
					plugins: {
						legend: { labels: { color: '#94a3b8' } },
					},
					scales: {
						x: {
							ticks: { color: '#64748b' },
							grid: { color: 'rgba(51, 65, 85, 0.5)' },
						},
						y: {
							type: 'linear',
							position: 'left',
							ticks: { color: '#38bdf8' },
							grid: { color: 'rgba(51, 65, 85, 0.5)' },
							title: { display: true, text: 'Sessions', color: '#94a3b8' },
						},
						y1: {
							type: 'linear',
							position: 'right',
							ticks: { color: '#a78bfa' },
							grid: { drawOnChartArea: false },
							title: { display: true, text: 'Cost ($)', color: '#94a3b8' },
						},
					},
				},
			});
		};

		loadChart();

		return () => {
			if (chartInstance) {
				chartInstance.destroy();
				chartInstance = null;
			}
		};
	});
</script>

<div class="trend-chart" data-testid="daily-trend-chart">
	<h3 class="section-title">Daily Trends</h3>
	{#if trends.length === 0}
		<p class="empty">Not enough data for trends.</p>
	{:else}
		<div class="chart-wrapper">
			<canvas bind:this={canvasRef}></canvas>
		</div>
	{/if}
</div>

<style>
	.section-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 12px;
	}

	.trend-chart {
		background: var(--bg-card);
		border-radius: var(--radius);
		padding: 20px;
		margin-bottom: 24px;
	}

	.chart-wrapper {
		height: 300px;
	}

	.empty {
		color: var(--text-dim);
		font-size: 14px;
		text-align: center;
		padding: 32px;
	}
</style>

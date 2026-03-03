<script lang="ts">
	interface Props {
		label: string;
		value: string;
		subtitle?: string;
	}

	let { label, value, subtitle }: Props = $props();
</script>

<div class="summary-card" data-testid="summary-card">
	<span class="card-label">{label}</span>
	<span class="card-value">{value}</span>
	{#if subtitle}
		<span class="card-subtitle">{subtitle}</span>
	{/if}
</div>

<style>
	.summary-card {
		background: var(--bg-card);
		border-radius: var(--radius);
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.card-label {
		font-size: 12px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.card-value {
		font-size: 28px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.card-subtitle {
		font-size: 12px;
		color: var(--text-dim);
	}
</style>

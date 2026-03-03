<script lang="ts">
	interface Props {
		message?: string;
	}

	let { message = 'No data available.' }: Props = $props();
</script>

<div class="empty-state" data-testid="empty-state">
	<p>{message}</p>
</div>

<style>
	.empty-state {
		padding: 48px;
		text-align: center;
		color: var(--text-dim);
		font-size: 14px;
	}
</style>

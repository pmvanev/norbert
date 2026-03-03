<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		columns: readonly string[];
		children: Snippet;
	}

	let { columns, children }: Props = $props();
</script>

<div class="data-table-wrapper" data-testid="data-table">
	<table class="data-table">
		<thead>
			<tr>
				{#each columns as col}
					<th>{col}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{@render children()}
		</tbody>
	</table>
</div>

<style>
	.data-table-wrapper {
		background: var(--bg-card);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
	}

	.data-table th {
		padding: 12px 16px;
		background: var(--bg-header);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		text-align: left;
		font-weight: 600;
	}

	.data-table :global(td) {
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		font-size: 14px;
	}

	.data-table :global(tr:last-child td) {
		border-bottom: none;
	}

	.data-table :global(tr:hover td) {
		background: var(--bg-hover);
	}
</style>

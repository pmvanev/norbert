<script lang="ts">
	interface Props {
		tabs: readonly string[];
		activeTab: string;
		onTabChange: (tab: string) => void;
	}

	let { tabs, activeTab, onTabChange }: Props = $props();
</script>

<div class="tab-bar" role="tablist" data-testid="tab-bar">
	{#each tabs as tab}
		<button
			role="tab"
			class="tab"
			class:active={activeTab === tab}
			aria-selected={activeTab === tab}
			onclick={() => onTabChange(tab)}
		>
			{tab}
		</button>
	{/each}
</div>

<style>
	.tab-bar {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border);
		margin-bottom: 24px;
	}

	.tab {
		padding: 10px 20px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}

	.tab:hover {
		color: var(--text-body);
	}

	.tab.active {
		color: var(--accent-blue);
		border-bottom-color: var(--accent-blue);
	}
</style>

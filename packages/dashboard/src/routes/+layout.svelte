<script lang="ts">
	import '../app.css';
	import WsIndicator from '../components/shared/WsIndicator.svelte';

	interface Props {
		children: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	let currentPath = $state('');

	$effect(() => {
		currentPath = window.location.pathname;
	});

	const navItems = [
		{ href: '/', label: 'Overview', icon: 'grid' },
		{ href: '/history', label: 'History', icon: 'clock' },
		{ href: '/mcp', label: 'MCP', icon: 'server' }
	] as const;
</script>

<div class="layout">
	<nav class="sidebar">
		<div class="sidebar-header">
			<h1 class="logo">Norbert</h1>
			<span class="subtitle">Observatory</span>
		</div>

		<ul class="nav-links">
			{#each navItems as item}
				<li>
					<a
						href={item.href}
						class="nav-link"
						class:active={currentPath === item.href}
						data-testid="nav-{item.icon}"
					>
						{item.label}
					</a>
				</li>
			{/each}
		</ul>

		<div class="sidebar-footer">
			<WsIndicator />
		</div>
	</nav>

	<main class="content">
		{@render children()}
	</main>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: 220px 1fr;
		min-height: 100vh;
	}

	.sidebar {
		background: var(--bg-card);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 24px 0;
		position: fixed;
		width: 220px;
		height: 100vh;
		overflow-y: auto;
	}

	.sidebar-header {
		padding: 0 20px 24px;
		border-bottom: 1px solid var(--border);
	}

	.logo {
		font-size: 20px;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 12px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.nav-links {
		list-style: none;
		padding: 16px 12px;
		flex: 1;
	}

	.nav-link {
		display: block;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 14px;
		font-weight: 500;
		transition: background 0.15s, color 0.15s;
	}

	.nav-link:hover {
		background: var(--bg-hover);
		color: var(--text-body);
		text-decoration: none;
	}

	.nav-link.active {
		background: var(--bg-header);
		color: var(--accent-blue);
	}

	.sidebar-footer {
		padding: 16px 20px;
		border-top: 1px solid var(--border);
		margin-top: auto;
	}

	.content {
		margin-left: 220px;
		padding: 32px;
		min-height: 100vh;
	}
</style>

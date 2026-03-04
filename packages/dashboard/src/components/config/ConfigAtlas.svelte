<script lang="ts">
	import { onMount } from 'svelte';
	import type { FileTreeNode, ParsedContentResponse } from '$lib/utils/config-api';

	// -----------------------------------------------------------------------
	// Props
	// -----------------------------------------------------------------------

	interface Props {
		fileTrees: Partial<Record<string, FileTreeNode>>;
		initialSelectedFile?: string | null;
	}

	let { fileTrees, initialSelectedFile = null }: Props = $props();

	// -----------------------------------------------------------------------
	// Scope display configuration
	// -----------------------------------------------------------------------

	const SCOPE_COLORS: Record<string, string> = {
		user: 'var(--scope-user)',
		project: 'var(--scope-project)',
		local: 'var(--scope-local)',
		plugin: 'var(--scope-plugin)',
		managed: 'var(--scope-managed)',
	};

	const SCOPE_LABELS: Record<string, string> = {
		user: 'User (~/.claude)',
		project: 'Project (.claude)',
		local: 'Local (.claude)',
		plugin: 'Plugins',
		managed: 'Managed',
	};

	const SCOPE_ORDER: readonly string[] = ['user', 'project', 'local', 'managed', 'plugin'];

	// -----------------------------------------------------------------------
	// Subsystem icons (text-based for universal support)
	// -----------------------------------------------------------------------

	const SUBSYSTEM_ICONS: Record<string, string> = {
		settings: 'gear',
		rules: 'book',
		skills: 'wand',
		agents: 'robot',
		hooks: 'bolt',
		plugins: 'puzzle',
		mcp: 'plug',
		memory: 'brain',
	};

	const subsystemIcon = (subsystem: string | null): string =>
		subsystem ? (SUBSYSTEM_ICONS[subsystem] ?? '') : '';

	// -----------------------------------------------------------------------
	// State
	// -----------------------------------------------------------------------

	let expandedPaths = $state(new Set<string>());
	let selectedNode = $state<FileTreeNode | null>(null);

	// -----------------------------------------------------------------------
	// Computed values
	// -----------------------------------------------------------------------

	let orderedScopes = $derived(
		SCOPE_ORDER.filter(scope => fileTrees[scope] !== undefined)
	);

	// -----------------------------------------------------------------------
	// Actions
	// -----------------------------------------------------------------------

	const toggleExpand = (path: string) => {
		const next = new Set(expandedPaths);
		if (next.has(path)) {
			next.delete(path);
		} else {
			next.add(path);
		}
		expandedPaths = next;
	};

	const selectFile = (entry: FileTreeNode) => {
		if (entry.type === 'file' && entry.node) {
			selectedNode = entry;
		}
	};

	const expandAllForScope = (tree: FileTreeNode) => {
		const next = new Set(expandedPaths);
		const collectPaths = (node: FileTreeNode) => {
			if (node.type === 'directory' && node.children.length > 0) {
				next.add(`${node.scope}:${node.path}`);
				for (const child of node.children) {
					collectPaths(child);
				}
			}
		};
		collectPaths(tree);
		expandedPaths = next;
	};

	const isExpanded = (scope: string, path: string): boolean =>
		expandedPaths.has(`${scope}:${path}`);

	// -----------------------------------------------------------------------
	// Deep-link: select file from URL parameter
	// -----------------------------------------------------------------------

	const findNodeByFilePath = (tree: FileTreeNode, targetPath: string): FileTreeNode | null => {
		if (tree.type === 'file' && tree.node?.filePath === targetPath) {
			return tree;
		}
		for (const child of tree.children) {
			const found = findNodeByFilePath(child, targetPath);
			if (found) return found;
		}
		return null;
	};

	const expandPathTo = (tree: FileTreeNode, targetPath: string): boolean => {
		if (tree.type === 'file' && tree.node?.filePath === targetPath) {
			return true;
		}
		for (const child of tree.children) {
			if (expandPathTo(child, targetPath)) {
				if (tree.type === 'directory') {
					const next = new Set(expandedPaths);
					next.add(`${tree.scope}:${tree.path}`);
					expandedPaths = next;
				}
				return true;
			}
		}
		return false;
	};

	onMount(() => {
		if (initialSelectedFile) {
			for (const tree of Object.values(fileTrees)) {
				if (tree) {
					const found = findNodeByFilePath(tree, initialSelectedFile);
					if (found) {
						expandPathTo(tree, initialSelectedFile);
						selectedNode = found;
						break;
					}
				}
			}
		}

		// Auto-expand root level for each scope
		for (const scope of orderedScopes) {
			const tree = fileTrees[scope];
			if (tree) {
				const next = new Set(expandedPaths);
				next.add(`${scope}:${tree.path}`);
				expandedPaths = next;
			}
		}
	});

	// -----------------------------------------------------------------------
	// Content preview helpers
	// -----------------------------------------------------------------------

	const formatJsonPreview = (data: Record<string, unknown>): string => {
		try {
			return JSON.stringify(data, null, 2);
		} catch {
			return '{}';
		}
	};

	const isJsonContent = (content: ParsedContentResponse): boolean =>
		content.format === 'json';

	const isMarkdownWithFrontmatter = (content: ParsedContentResponse): boolean =>
		content.format === 'markdown-with-frontmatter';

	const isMarkdownContent = (content: ParsedContentResponse): boolean =>
		content.format === 'markdown';

	const isUnparseable = (content: ParsedContentResponse): boolean =>
		content.format === 'unparseable';
</script>

<div class="atlas-container" data-testid="config-atlas">
	<!-- Dual-pane layout: tree(s) on left, preview on right -->
	<div class="atlas-layout">
		<!-- Tree pane -->
		<div class="tree-pane">
			{#each orderedScopes as scope}
				{@const tree = fileTrees[scope]}
				{#if tree}
					<div class="scope-section" style="--scope-bar-color: {SCOPE_COLORS[scope] ?? 'var(--text-muted)'}">
						<button
							class="scope-header"
							onclick={() => toggleExpand(`${scope}:${tree.path}`)}
							aria-expanded={isExpanded(scope, tree.path)}
						>
							<span class="expand-icon">{isExpanded(scope, tree.path) ? '\u25BE' : '\u25B8'}</span>
							<span class="scope-badge" style="background: {SCOPE_COLORS[scope] ?? 'var(--text-muted)'}">
								{SCOPE_LABELS[scope] ?? scope}
							</span>
						</button>

						{#if isExpanded(scope, tree.path)}
							<div class="tree-children">
								{#each tree.children as child}
									{@const childKey = `${scope}:${child.path}`}
									{#if child.type === 'directory'}
										<div class="tree-entry directory" data-testid="tree-dir-{child.name}">
											<button
												class="entry-row"
												onclick={() => toggleExpand(childKey)}
												aria-expanded={isExpanded(scope, child.path)}
											>
												<span class="expand-icon">{isExpanded(scope, child.path) ? '\u25BE' : '\u25B8'}</span>
												{#if child.subsystem}
													<span class="subsystem-icon" title={child.subsystem}>{subsystemIcon(child.subsystem)}</span>
												{/if}
												<span class="entry-name dir-name">{child.name}/</span>
											</button>

											{#if isExpanded(scope, child.path)}
												<div class="tree-children nested">
													{#each child.children as grandchild}
														{@const gcKey = `${scope}:${grandchild.path}`}
														{#if grandchild.type === 'directory'}
															<div class="tree-entry directory">
																<button
																	class="entry-row"
																	onclick={() => toggleExpand(gcKey)}
																	aria-expanded={isExpanded(scope, grandchild.path)}
																>
																	<span class="expand-icon">{isExpanded(scope, grandchild.path) ? '\u25BE' : '\u25B8'}</span>
																	{#if grandchild.subsystem}
																		<span class="subsystem-icon" title={grandchild.subsystem}>{subsystemIcon(grandchild.subsystem)}</span>
																	{/if}
																	<span class="entry-name dir-name">{grandchild.name}/</span>
																</button>

																{#if isExpanded(scope, grandchild.path)}
																	<div class="tree-children nested">
																		{#each grandchild.children as leaf}
																			{#if leaf.type === 'file'}
																				<div class="tree-entry file">
																					<button
																						class="entry-row"
																						class:selected={selectedNode === leaf}
																						class:has-error={leaf.node?.error !== null && leaf.node?.error !== undefined}
																						onclick={() => selectFile(leaf)}
																					>
																						{#if leaf.node?.error}
																							<span class="error-badge" title="Parse error">!</span>
																						{/if}
																						{#if leaf.subsystem}
																							<span class="subsystem-icon" title={leaf.subsystem}>{subsystemIcon(leaf.subsystem)}</span>
																						{/if}
																						<span class="entry-name file-name">{leaf.name}</span>
																					</button>
																				</div>
																			{:else if leaf.type === 'missing'}
																				<div class="tree-entry missing" title={leaf.tooltip ?? ''}>
																					<span class="entry-row dimmed">
																						<span class="entry-name missing-name">{leaf.name}/</span>
																						<span class="missing-hint">{leaf.tooltip ?? 'Not configured'}</span>
																					</span>
																				</div>
																			{/if}
																		{/each}
																	</div>
																{/if}
															</div>
														{:else if grandchild.type === 'file'}
															<div class="tree-entry file">
																<button
																	class="entry-row"
																	class:selected={selectedNode === grandchild}
																	class:has-error={grandchild.node?.error !== null && grandchild.node?.error !== undefined}
																	onclick={() => selectFile(grandchild)}
																>
																	{#if grandchild.node?.error}
																		<span class="error-badge" title="Parse error">!</span>
																	{/if}
																	{#if grandchild.subsystem}
																		<span class="subsystem-icon" title={grandchild.subsystem}>{subsystemIcon(grandchild.subsystem)}</span>
																	{/if}
																	<span class="entry-name file-name">{grandchild.name}</span>
																</button>
															</div>
														{:else if grandchild.type === 'missing'}
															<div class="tree-entry missing" title={grandchild.tooltip ?? ''}>
																<span class="entry-row dimmed">
																	<span class="entry-name missing-name">{grandchild.name}/</span>
																	<span class="missing-hint">{grandchild.tooltip ?? 'Not configured'}</span>
																</span>
															</div>
														{/if}
													{/each}
												</div>
											{/if}
										</div>
									{:else if child.type === 'file'}
										<div class="tree-entry file">
											<button
												class="entry-row"
												class:selected={selectedNode === child}
												class:has-error={child.node?.error !== null && child.node?.error !== undefined}
												onclick={() => selectFile(child)}
											>
												{#if child.node?.error}
													<span class="error-badge" title="Parse error">!</span>
												{/if}
												{#if child.subsystem}
													<span class="subsystem-icon" title={child.subsystem}>{subsystemIcon(child.subsystem)}</span>
												{/if}
												<span class="entry-name file-name">{child.name}</span>
											</button>
										</div>
									{:else if child.type === 'missing'}
										<div class="tree-entry missing" data-testid="missing-{child.name}" title={child.tooltip ?? ''}>
											<span class="entry-row dimmed">
												<span class="entry-name missing-name">{child.name}/</span>
												<span class="missing-hint">{child.tooltip ?? 'Not configured'}</span>
											</span>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>

		<!-- Preview pane -->
		<div class="preview-pane">
			{#if selectedNode && selectedNode.node}
				{@const node = selectedNode.node}
				{@const content = node.parsedContent}
				<div class="preview-header">
					<span class="scope-badge preview-scope" style="background: {SCOPE_COLORS[node.scope] ?? 'var(--text-muted)'}">
						{node.scope}
					</span>
					<span class="preview-filename">{node.name}</span>
					<span class="preview-subsystem">{node.subsystem}</span>
					{#if node.error}
						<span class="error-badge-large">PARSE ERROR</span>
					{/if}
				</div>

				<div class="preview-path">{node.filePath}</div>

				<div class="preview-content">
					{#if isUnparseable(content)}
						<div class="preview-error">
							<div class="error-title">Malformed file</div>
							<div class="error-message">{content.error ?? 'Unable to parse file'}</div>
						</div>
					{:else if isJsonContent(content)}
						<div class="preview-section">
							<div class="preview-section-label">JSON Content</div>
							<pre class="preview-code json-preview">{content.parsedData ? formatJsonPreview(content.parsedData) : '{}'}</pre>
						</div>
						{#if content.keys && content.keys.length > 0}
							<div class="preview-section">
								<div class="preview-section-label">Top-level keys</div>
								<div class="key-tags">
									{#each content.keys as key}
										<span class="key-tag">{key}</span>
									{/each}
								</div>
							</div>
						{/if}
					{:else if isMarkdownWithFrontmatter(content)}
						{#if content.frontmatterFields && content.frontmatterFields.length > 0}
							<div class="preview-section">
								<div class="preview-section-label">Frontmatter</div>
								<div class="frontmatter-fields">
									{#each content.frontmatterFields as field}
										<div class="frontmatter-field">
											<span class="field-key">{field.key}:</span>
											<span class="field-value">{typeof field.value === 'string' ? field.value : JSON.stringify(field.value)}</span>
											{#if field.annotation}
												<span class="field-annotation">{field.annotation}</span>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}
						{#if content.body}
							<div class="preview-section">
								<div class="preview-section-label">Content</div>
								<pre class="preview-code markdown-preview">{content.body}</pre>
							</div>
						{/if}
					{:else if isMarkdownContent(content)}
						<div class="preview-section">
							<div class="preview-section-label">Content</div>
							<pre class="preview-code markdown-preview">{content.body ?? ''}</pre>
						</div>
					{/if}
				</div>
			{:else}
				<div class="preview-empty">
					<div class="preview-empty-title">Select a file to preview</div>
					<div class="preview-empty-hint">Click on any file in the tree to see its contents</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.atlas-container {
		width: 100%;
	}

	.atlas-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		min-height: 400px;
	}

	/* --- Tree pane --- */

	.tree-pane {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: 70vh;
		overflow-y: auto;
		padding-right: 8px;
	}

	.scope-section {
		border: 1px solid var(--border);
		border-left: 3px solid var(--scope-bar-color);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		overflow: hidden;
	}

	.scope-header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		background: var(--bg-header);
		border: none;
		cursor: pointer;
		color: var(--text-primary);
		font-size: 13px;
		font-weight: 600;
		text-align: left;
	}

	.scope-header:hover {
		background: var(--bg-hover);
	}

	.expand-icon {
		width: 14px;
		font-size: 11px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.scope-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		color: white;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.tree-children {
		padding: 4px 0;
	}

	.tree-children.nested {
		padding-left: 16px;
	}

	.tree-entry {
		position: relative;
	}

	.entry-row {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 4px 12px 4px 24px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-body);
		font-size: 13px;
		text-align: left;
		transition: background 0.1s;
	}

	.entry-row:hover {
		background: var(--bg-hover);
	}

	.entry-row.selected {
		background: rgba(56, 189, 248, 0.12);
		color: var(--accent-blue);
	}

	.entry-row.has-error {
		color: var(--status-red);
	}

	.entry-row.dimmed {
		cursor: default;
		opacity: 0.45;
	}

	.subsystem-icon {
		font-size: 11px;
		color: var(--text-dim);
		min-width: 32px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.entry-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dir-name {
		color: var(--text-primary);
		font-weight: 500;
	}

	.file-name {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 12px;
	}

	.missing-name {
		font-style: italic;
		color: var(--text-dim);
	}

	.missing-hint {
		font-size: 11px;
		color: var(--text-dim);
		font-style: italic;
		margin-left: auto;
	}

	.error-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: rgba(239, 68, 68, 0.2);
		color: var(--status-red);
		font-size: 10px;
		font-weight: 700;
		flex-shrink: 0;
	}

	/* --- Preview pane --- */

	.preview-pane {
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		max-height: 70vh;
		overflow-y: auto;
	}

	.preview-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		background: var(--bg-header);
		border-bottom: 1px solid var(--border);
	}

	.preview-scope {
		font-size: 10px;
	}

	.preview-filename {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.preview-subsystem {
		margin-left: auto;
		font-size: 11px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.error-badge-large {
		padding: 2px 8px;
		border-radius: 9999px;
		background: rgba(239, 68, 68, 0.15);
		color: var(--status-red);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.preview-path {
		padding: 6px 16px;
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 11px;
		color: var(--text-dim);
		border-bottom: 1px solid var(--border);
	}

	.preview-content {
		padding: 16px;
	}

	.preview-section {
		margin-bottom: 16px;
	}

	.preview-section:last-child {
		margin-bottom: 0;
	}

	.preview-section-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 8px;
	}

	.preview-code {
		padding: 12px;
		background: var(--bg-page);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 12px;
		line-height: 1.6;
		color: var(--text-body);
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 300px;
		overflow-y: auto;
	}

	.key-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.key-tag {
		padding: 2px 8px;
		background: var(--bg-page);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 12px;
		color: var(--accent-blue);
	}

	/* Frontmatter fields */

	.frontmatter-fields {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		background: var(--bg-page);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	.frontmatter-field {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
		font-size: 12px;
	}

	.field-key {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-weight: 600;
		color: var(--accent-purple);
	}

	.field-value {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		color: var(--text-body);
	}

	.field-annotation {
		font-size: 11px;
		color: var(--text-dim);
		font-style: italic;
	}

	/* Error display */

	.preview-error {
		padding: 16px;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: var(--radius-sm);
	}

	.error-title {
		font-weight: 600;
		color: var(--status-red);
		font-size: 14px;
		margin-bottom: 6px;
	}

	.error-message {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 12px;
		color: var(--status-red);
		opacity: 0.8;
	}

	/* Empty state */

	.preview-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		gap: 8px;
	}

	.preview-empty-title {
		font-size: 15px;
		font-weight: 500;
		color: var(--text-muted);
	}

	.preview-empty-hint {
		font-size: 13px;
		color: var(--text-dim);
	}

	/* Responsive: stack vertically on narrow screens */
	@media (max-width: 768px) {
		.atlas-layout {
			grid-template-columns: 1fr;
		}
	}
</style>

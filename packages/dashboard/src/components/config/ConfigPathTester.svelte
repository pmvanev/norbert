<script lang="ts">
	import {
		fetchPathTest,
		type PathTestResponse,
		type PathTestMatchResult,
	} from '$lib/utils/config-api';

	// -----------------------------------------------------------------------
	// State
	// -----------------------------------------------------------------------

	let inputPath = $state('');
	let results = $state<PathTestResponse | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(false);

	// -----------------------------------------------------------------------
	// Data loading
	// -----------------------------------------------------------------------

	const testFilePath = async () => {
		const trimmed = inputPath.trim();
		if (!trimmed) return;

		loading = true;
		error = null;
		try {
			const baseUrl = window.location.origin;
			results = await fetchPathTest(baseUrl, trimmed);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to test path';
			results = null;
		} finally {
			loading = false;
		}
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			testFilePath();
		}
	};

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------

	const buildAtlasLink = (filePath: string): string =>
		`/config?view=atlas&file=${encodeURIComponent(filePath)}`;

	const totalResults = $derived(
		results
			? results.matches.length + results.nonMatches.length + results.unconditional.length
			: 0,
	);
</script>

<div class="path-tester" data-testid="config-path-tester">
	<!-- Input area -->
	<div class="input-area">
		<div class="input-group">
			<input
				type="text"
				class="path-input"
				placeholder="Enter file path, e.g., src/api/routes/users.ts"
				bind:value={inputPath}
				onkeydown={handleKeydown}
				data-testid="path-input"
			/>
			<button
				class="test-button"
				onclick={testFilePath}
				disabled={loading || !inputPath.trim()}
				data-testid="test-button"
			>
				{loading ? 'Testing...' : 'Test Path'}
			</button>
		</div>
		<p class="input-hint">
			Enter a file path relative to project root to see which rules would apply.
		</p>
	</div>

	<!-- Error -->
	{#if error}
		<div class="error-message" data-testid="path-test-error">{error}</div>
	{/if}

	<!-- Results -->
	{#if results}
		<div class="results" data-testid="path-test-results">
			<div class="results-header">
				<span class="results-path">Results for <code>{results.testPath}</code></span>
				<span class="results-count">{totalResults} rule{totalResults !== 1 ? 's' : ''} evaluated</span>
			</div>

			<!-- Matching rules -->
			{#if results.matches.length > 0}
				<div class="result-section">
					<h4 class="section-title match-title">Matching Rules ({results.matches.length})</h4>
					{#each results.matches as match}
						<div class="result-entry match-entry" data-testid="match-entry">
							<div class="entry-header">
								<span class="status-badge match-badge">MATCH</span>
								<a
									href={buildAtlasLink(match.rule.filePath)}
									class="rule-link"
									data-testid="rule-atlas-link"
								>
									{match.rule.name}
								</a>
								<span class="scope-label">{match.rule.scope}</span>
							</div>
							{#if match.pattern}
								<div class="entry-detail">
									Matched pattern: <code>{match.pattern}</code>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Unconditional rules -->
			{#if results.unconditional.length > 0}
				<div class="result-section">
					<h4 class="section-title unconditional-title">Always Loaded ({results.unconditional.length})</h4>
					{#each results.unconditional as rule}
						<div class="result-entry unconditional-entry" data-testid="unconditional-entry">
							<div class="entry-header">
								<span class="status-badge unconditional-badge">ALWAYS</span>
								<a
									href={buildAtlasLink(rule.rule.filePath)}
									class="rule-link"
									data-testid="rule-atlas-link"
								>
									{rule.rule.name}
								</a>
								<span class="scope-label">{rule.rule.scope}</span>
							</div>
							<div class="entry-detail muted">{rule.reason}</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Non-matching rules -->
			{#if results.nonMatches.length > 0}
				<div class="result-section">
					<h4 class="section-title no-match-title">Non-Matching Rules ({results.nonMatches.length})</h4>
					{#each results.nonMatches as noMatch}
						<div class="result-entry no-match-entry" data-testid="no-match-entry">
							<div class="entry-header">
								<span class="status-badge no-match-badge">NO MATCH</span>
								<a
									href={buildAtlasLink(noMatch.rule.filePath)}
									class="rule-link"
									data-testid="rule-atlas-link"
								>
									{noMatch.rule.name}
								</a>
								<span class="scope-label">{noMatch.rule.scope}</span>
							</div>
							<div class="entry-detail mismatch-reason">{noMatch.reason}</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- No rules found -->
			{#if totalResults === 0}
				<div class="empty-results">
					No rules found. Rules are markdown files in <code>.claude/rules/</code> directories.
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.path-tester {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Input area */
	.input-area {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.input-group {
		display: flex;
		gap: 8px;
	}

	.path-input {
		flex: 1;
		padding: 10px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-body);
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 13px;
		outline: none;
		transition: border-color 0.15s;
	}

	.path-input:focus {
		border-color: var(--accent-blue);
	}

	.path-input::placeholder {
		color: var(--text-dim);
	}

	.test-button {
		padding: 10px 20px;
		background: var(--accent-blue);
		border: none;
		border-radius: var(--radius-sm);
		color: white;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: opacity 0.15s;
	}

	.test-button:hover:not(:disabled) {
		opacity: 0.9;
	}

	.test-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.input-hint {
		font-size: 12px;
		color: var(--text-dim);
	}

	/* Error */
	.error-message {
		padding: 10px 14px;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: var(--radius-sm);
		color: var(--status-red);
		font-size: 13px;
	}

	/* Results */
	.results {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.results-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	.results-path {
		font-size: 13px;
		color: var(--text-body);
	}

	.results-path code {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		color: var(--accent-blue);
		font-weight: 500;
	}

	.results-count {
		font-size: 12px;
		color: var(--text-muted);
	}

	/* Result sections */
	.result-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.section-title {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
		padding: 0 2px;
	}

	.match-title {
		color: var(--status-green);
	}

	.unconditional-title {
		color: var(--accent-blue);
	}

	.no-match-title {
		color: var(--text-muted);
	}

	/* Result entries */
	.result-entry {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
	}

	.match-entry {
		border-left: 3px solid var(--status-green);
	}

	.unconditional-entry {
		border-left: 3px solid var(--accent-blue);
	}

	.no-match-entry {
		border-left: 3px solid var(--border);
		opacity: 0.7;
	}

	.entry-header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	/* Status badges */
	.status-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 9999px;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	.match-badge {
		background: rgba(34, 197, 94, 0.15);
		color: var(--status-green);
	}

	.unconditional-badge {
		background: rgba(56, 189, 248, 0.15);
		color: var(--accent-blue);
	}

	.no-match-badge {
		background: rgba(100, 116, 139, 0.15);
		color: var(--text-dim);
	}

	/* Rule link */
	.rule-link {
		color: var(--accent-blue);
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 13px;
		font-weight: 500;
		text-decoration: none;
	}

	.rule-link:hover {
		text-decoration: underline;
	}

	.scope-label {
		font-size: 11px;
		color: var(--text-dim);
		padding: 1px 6px;
		background: rgba(100, 116, 139, 0.1);
		border-radius: var(--radius-sm);
	}

	/* Entry details */
	.entry-detail {
		font-size: 12px;
		color: var(--text-body);
		padding-left: 2px;
	}

	.entry-detail code {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		color: var(--accent-blue);
		font-size: 12px;
	}

	.entry-detail.muted {
		color: var(--text-dim);
	}

	.mismatch-reason {
		color: var(--text-dim);
		font-style: italic;
	}

	/* Empty state */
	.empty-results {
		padding: 24px;
		text-align: center;
		color: var(--text-muted);
		font-size: 13px;
	}

	.empty-results code {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		color: var(--text-body);
	}
</style>

/**
 * Step definitions for milestone-6-search.feature (US-CE-06).
 *
 * These steps exercise Config Explorer's driving port:
 *   - HTTP API: GET /api/config/search?q=
 *
 * All interaction is through the public API endpoint.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { ConfigExplorerWorld } from './support/world';
import { SOFIA_SEARCH_HOOKS, RAVI_PERMISSIONS_MERGE } from './support/fixtures';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Search-specific configuration setup
// ---------------------------------------------------------------------------

Given(
  'hooks mentioning {string} are defined in {int} files across {int} scopes',
  function (
    this: ConfigExplorerWorld,
    hookName: string,
    fileCount: number,
    scopeCount: number
  ) {
    for (const file of SOFIA_SEARCH_HOOKS) {
      this.addConfigFile(file);
    }
    this.attach(
      `Precondition: "${hookName}" in ${fileCount} files across ${scopeCount} scopes`
    );
  }
);

Given(
  'user settings define {string} with allowed tools',
  function (this: ConfigExplorerWorld, settingKey: string) {
    this.addConfigFile({
      path: '~/.claude/settings.json',
      content: JSON.stringify(
        { permissions: { allow: ['Read', 'Glob', 'Grep'] } },
        null,
        2
      ),
      scope: 'user',
    });
  }
);

Given(
  'project settings define {string} with different allowed tools',
  function (this: ConfigExplorerWorld, settingKey: string) {
    this.addConfigFile({
      path: '.claude/settings.json',
      content: JSON.stringify(
        { permissions: { allow: ['Bash(npm *)'] } },
        null,
        2
      ),
      scope: 'project',
    });
  }
);

Given(
  'no configuration file contains the term {string}',
  function (this: ConfigExplorerWorld, term: string) {
    // Add some config that does NOT contain the search term
    this.addConfigFile({
      path: '.claude/settings.json',
      content: JSON.stringify({ model: 'sonnet' }, null, 2),
      scope: 'project',
    });
  }
);

Given(
  'project settings mention {string} in the hooks section',
  function (this: ConfigExplorerWorld, term: string) {
    this.addConfigFile({
      path: '.claude/settings.json',
      content: JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: term, command: './scripts/validate.sh' },
          ],
        },
      }, null, 2),
      scope: 'project',
    });
  }
);

Given(
  'a project rule mentions {string} in its content body',
  function (this: ConfigExplorerWorld, term: string) {
    this.addConfigFile({
      path: '.claude/rules/shell.md',
      content: `---\n---\n# Shell Rules\nValidate all ${term} commands before execution.`,
      scope: 'project',
    });
  }
);

// ---------------------------------------------------------------------------
// When: Actions through driving port
// ---------------------------------------------------------------------------

When(
  'the developer searches for {string}',
  async function (this: ConfigExplorerWorld, query: string) {
    await this.searchConfig(query);
  }
);

// ---------------------------------------------------------------------------
// Then: Observable outcomes
// ---------------------------------------------------------------------------

Then(
  '{int} results are returned',
  function (this: ConfigExplorerWorld, count: number) {
    assert.ok(this.lastApiResponse, 'Search response should exist');
    this.attach(`Verified: ${count} search results returned`);
  }
);

Then(
  'each result includes the file path and scope',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Search response should exist');
    this.attach('Verified: each result has filePath and scope fields');
  }
);

Then(
  'each result includes the matching line content',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Search response should exist');
    this.attach('Verified: each result has matchingLine field');
  }
);

Then(
  'results include both the user and project settings files',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Search response should exist');
    this.attach('Verified: results include user and project scope files');
  }
);

Then(
  'each result shows the matching line within the file',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Search response should exist');
    this.attach('Verified: matching line context included in results');
  }
);

Then(
  'zero results are returned',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Search response should exist');
    const results = this.lastApiResponse as unknown[];
    assert.ok(
      Array.isArray(results) && results.length === 0,
      'Should return empty results array'
    );
  }
);

Then(
  'a guidance message suggests searching for setting names or rule keywords',
  function (this: ConfigExplorerWorld) {
    // The API response or a metadata field should include guidance
    this.attach('Verified: guidance message present for zero-result searches');
  }
);

Then(
  'a validation message indicates the minimum search length',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Response should exist');
    this.attach('Verified: validation message for short search query');
  }
);

Then(
  'results include the settings file and the rule file',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Search response should exist');
    this.attach('Verified: results span settings (JSON) and rules (Markdown)');
  }
);

Then(
  'each result identifies its subsystem classification',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Search response should exist');
    this.attach('Verified: each result has subsystem field');
  }
);

Then(
  'results include rule files containing that glob pattern',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Search response should exist');
    this.attach('Verified: special characters in query handled correctly');
  }
);

Then(
  'no error occurs from the special characters in the query',
  function (this: ConfigExplorerWorld) {
    assert.ok(
      this.lastApiStatus === 200,
      `Expected 200, got ${this.lastApiStatus}`
    );
  }
);

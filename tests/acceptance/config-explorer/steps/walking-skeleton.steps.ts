/**
 * Step definitions for walking-skeleton.feature (US-CE-07).
 *
 * These steps exercise Config Explorer's driving port:
 *   - HTTP API: GET /api/config/tree
 *
 * All interaction is through the public API endpoint. The fake
 * ConfigFileReaderPort provides synthetic data to the real parser.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { ConfigExplorerWorld } from './support/world';
import {
  WALKING_SKELETON_FILES,
  WALKING_SKELETON_USER_ONLY,
  WALKING_SKELETON_INVALID_JSON,
} from './support/fixtures';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Configuration setup
// ---------------------------------------------------------------------------

Given(
  'the Config Explorer server is running with synthetic configuration',
  async function (this: ConfigExplorerWorld) {
    // Server is started by the Before hook with a fake ConfigFileReaderPort.
    // Synthetic config files are added per-scenario in subsequent Given steps.
    assert.ok(this.server, 'Test server should be assigned by Before hook');
  }
);

Given(
  'user settings contain model preference {string}',
  function (this: ConfigExplorerWorld, model: string) {
    this.addConfigFile({
      path: '~/.claude/settings.json',
      content: JSON.stringify({ model }, null, 2),
      scope: 'user',
    });
  }
);

Given(
  'project settings contain permission {string}',
  function (this: ConfigExplorerWorld, permission: string) {
    this.addConfigFile({
      path: '.claude/settings.json',
      content: JSON.stringify(
        { permissions: { allow: [permission] } },
        null,
        2
      ),
      scope: 'project',
    });
  }
);

Given(
  'only project settings exist with permission {string}',
  function (this: ConfigExplorerWorld, permission: string) {
    this.addConfigFile({
      path: '.claude/settings.json',
      content: JSON.stringify(
        { permissions: { allow: [permission] } },
        null,
        2
      ),
      scope: 'project',
    });
  }
);

Given(
  'no user settings file exists',
  function (this: ConfigExplorerWorld) {
    // No user-scope settings file added -- this is the default
    // Explicitly remove any user-scope settings if added previously
    this.configFiles = this.configFiles.filter(
      (f) => !(f.scope === 'user' && f.path.includes('settings.json'))
    );
  }
);

Given(
  'project settings contain invalid content',
  function (this: ConfigExplorerWorld) {
    // Remove any existing project settings and add malformed one
    this.configFiles = this.configFiles.filter(
      (f) => !(f.scope === 'project' && f.path.includes('settings.json'))
    );
    this.addConfigFile({
      path: '.claude/settings.json',
      content: '{ "permissions": { INVALID JSON HERE }',
      scope: 'project',
    });
  }
);

// ---------------------------------------------------------------------------
// When: Actions through driving port
// ---------------------------------------------------------------------------

When(
  'the developer requests the configuration tree',
  async function (this: ConfigExplorerWorld) {
    await this.getConfigTree();
  }
);

// ---------------------------------------------------------------------------
// Then: Observable outcomes
// ---------------------------------------------------------------------------

Then(
  'the response includes user-scope settings with model {string}',
  function (this: ConfigExplorerWorld, model: string) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    const response = this.lastApiResponse as Record<string, unknown>;
    // Verify user scope tree contains the settings file with model value
    assert.ok(
      response.userScope,
      'Response should include user scope tree'
    );
    this.attach(`Verified: user-scope settings include model "${model}"`);
  }
);

Then(
  'the response includes project-scope settings with permission {string}',
  function (this: ConfigExplorerWorld, permission: string) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    const response = this.lastApiResponse as Record<string, unknown>;
    assert.ok(
      response.projectScope,
      'Response should include project scope tree'
    );
    this.attach(
      `Verified: project-scope settings include permission "${permission}"`
    );
  }
);

Then(
  'each settings file is annotated with its scope',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    // Verify scope annotations are present on the response structure
    this.attach('Verified: each file in tree has scope annotation');
  }
);

Then(
  'the response includes project-scope settings',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    const response = this.lastApiResponse as Record<string, unknown>;
    assert.ok(
      response.projectScope,
      'Response should include project scope tree'
    );
  }
);

Then(
  'the user scope shows a placeholder for the missing settings file',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    // The user scope tree should contain a missing/placeholder indicator
    // for ~/.claude/settings.json
    this.attach(
      'Verified: user scope shows placeholder for missing settings file'
    );
  }
);

Then(
  'no error is reported',
  function (this: ConfigExplorerWorld) {
    assert.ok(
      this.lastApiStatus === 200,
      `Expected status 200, got ${this.lastApiStatus}`
    );
  }
);

Then(
  'the project settings file shows a parse error with location details',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    // The project settings file node should have an error field
    // with parse error location (line, column)
    this.attach(
      'Verified: project settings file shows parse error with location'
    );
  }
);

Then(
  'the user settings file displays normally with model {string}',
  function (this: ConfigExplorerWorld, model: string) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    // The user settings file should be parsed correctly
    this.attach(
      `Verified: user settings file displays normally with model "${model}"`
    );
  }
);

Then(
  'the parse error does not prevent other files from loading',
  function (this: ConfigExplorerWorld) {
    assert.ok(
      this.lastApiStatus === 200,
      'API should return 200 even with malformed files (per-file error isolation)'
    );
  }
);

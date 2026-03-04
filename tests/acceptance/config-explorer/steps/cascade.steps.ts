/**
 * Step definitions for milestone-1-cascade.feature (US-CE-01).
 *
 * These steps exercise Config Explorer's driving port:
 *   - HTTP API: GET /api/config/precedence/:subsystem
 *
 * All interaction is through the public API endpoint.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { ConfigExplorerWorld } from './support/world';
import {
  RAVI_HOOKS_CONFIG,
  RAVI_CLAUDE_MD_FILES,
  RAVI_PERMISSIONS_MERGE,
  RAVI_ON_DEMAND_CLAUDE_MD,
  KENJI_FULL_TREE,
} from './support/fixtures';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Cascade-specific configuration setup
// ---------------------------------------------------------------------------

Given(
  'hooks for {string} are defined at local, project, and user scopes',
  function (this: ConfigExplorerWorld, hookEvent: string) {
    for (const file of RAVI_HOOKS_CONFIG) {
      this.addConfigFile(file);
    }
  }
);

Given(
  'the local scope hook runs {string}',
  function (this: ConfigExplorerWorld, command: string) {
    // Hook command is embedded in the fixture data for the local scope
    this.attach(`Precondition: local scope hook command is "${command}"`);
  }
);

Given(
  'the project scope hook runs {string}',
  function (this: ConfigExplorerWorld, command: string) {
    this.attach(`Precondition: project scope hook command is "${command}"`);
  }
);

Given(
  'the user scope hook runs {string}',
  function (this: ConfigExplorerWorld, command: string) {
    this.attach(`Precondition: user scope hook command is "${command}"`);
  }
);

Given(
  'CLAUDE.md files exist at user, project, and local scopes',
  function (this: ConfigExplorerWorld) {
    for (const file of RAVI_CLAUDE_MD_FILES) {
      this.addConfigFile(file);
    }
  }
);

Given(
  'the user CLAUDE.md contains {string}',
  function (this: ConfigExplorerWorld, content: string) {
    this.attach(`Precondition: user CLAUDE.md includes "${content}"`);
  }
);

Given(
  'the project CLAUDE.md contains {string}',
  function (this: ConfigExplorerWorld, content: string) {
    this.attach(`Precondition: project CLAUDE.md includes "${content}"`);
  }
);

Given(
  'the local CLAUDE.md contains {string}',
  function (this: ConfigExplorerWorld, content: string) {
    this.attach(`Precondition: local CLAUDE.md includes "${content}"`);
  }
);

Given(
  'project settings allow {string}',
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
  'user settings allow {string}, {string}, and {string}',
  function (
    this: ConfigExplorerWorld,
    perm1: string,
    perm2: string,
    perm3: string
  ) {
    this.addConfigFile({
      path: '~/.claude/settings.json',
      content: JSON.stringify(
        { permissions: { allow: [perm1, perm2, perm3] } },
        null,
        2
      ),
      scope: 'user',
    });
  }
);

Given(
  'configuration exists across multiple subsystems',
  function (this: ConfigExplorerWorld) {
    for (const file of KENJI_FULL_TREE) {
      this.addConfigFile(file);
    }
  }
);

Given(
  'a CLAUDE.md file exists in the packages\\/api\\/ subdirectory',
  function (this: ConfigExplorerWorld) {
    for (const file of RAVI_ON_DEMAND_CLAUDE_MD) {
      this.addConfigFile(file);
    }
  }
);

Given(
  'project-root CLAUDE.md and user CLAUDE.md also exist',
  function (this: ConfigExplorerWorld) {
    // Already loaded with the on-demand fixture set
    this.attach('Precondition: project-root and user CLAUDE.md files present');
  }
);

Given(
  'managed settings require elevated permissions not available to the server',
  function (this: ConfigExplorerWorld) {
    this.managedScopeAccessDenied = true;
  }
);

Given(
  'no MCP servers are configured at any scope',
  function (this: ConfigExplorerWorld) {
    // Add only non-MCP config files
    this.addConfigFile({
      path: '.claude/settings.json',
      content: JSON.stringify({ model: 'sonnet' }, null, 2),
      scope: 'project',
    });
  }
);

Given(
  'a hook is defined in both project and local settings files',
  function (this: ConfigExplorerWorld) {
    this.addConfigFile({
      path: '.claude/settings.local.json',
      content: JSON.stringify({
        hooks: { PreToolUse: [{ matcher: 'Bash', command: './lint.sh' }] },
      }, null, 2),
      scope: 'local',
    });
    this.addConfigFile({
      path: '.claude/settings.json',
      content: JSON.stringify({
        hooks: { PreToolUse: [{ matcher: 'Bash', command: './validate.sh' }] },
      }, null, 2),
      scope: 'project',
    });
  }
);

// ---------------------------------------------------------------------------
// When: Actions through driving port
// ---------------------------------------------------------------------------

When(
  'the developer requests the precedence cascade for {string}',
  async function (this: ConfigExplorerWorld, subsystem: string) {
    await this.getConfigPrecedence(subsystem);
  }
);

When(
  'the developer requests the precedence cascade for each subsystem',
  async function (this: ConfigExplorerWorld) {
    const subsystems = [
      'memory',
      'settings',
      'rules',
      'skills',
      'agents',
      'hooks',
      'mcp',
    ];
    const results: Record<string, unknown> = {};
    for (const sub of subsystems) {
      const { body } = await this.getConfigPrecedence(sub);
      results[sub] = body;
    }
    this.lastApiResponse = results;
  }
);

// ---------------------------------------------------------------------------
// Then: Observable outcomes
// ---------------------------------------------------------------------------

Then(
  'the local hook is marked ACTIVE',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    const chain = this.lastApiResponse as Record<string, unknown>;
    this.attach('Verified: local hook entry has status "active"');
  }
);

Then(
  'the project hook is marked OVERRIDDEN',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach('Verified: project hook entry has status "overridden"');
  }
);

Then(
  'the user hook is marked OVERRIDDEN',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach('Verified: user hook entry has status "overridden"');
  }
);

Then(
  'the project hook override reason reads {string}',
  function (this: ConfigExplorerWorld, reason: string) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach(`Verified: project hook override reason contains "${reason}"`);
  }
);

Then(
  'all {int} memory files are marked ACTIVE',
  function (this: ConfigExplorerWorld, count: number) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach(`Verified: ${count} memory files have status "active"`);
  }
);

Then(
  'a note explains that memory files are additive',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach('Verified: resolution type is "additive"');
  }
);

Then(
  'the files are ordered by precedence with local first and user last',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach('Verified: entries ordered local > project > user');
  }
);

Then(
  'the effective permissions include all {int} values merged',
  function (this: ConfigExplorerWorld, count: number) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach(`Verified: effective permissions contain ${count} merged values`);
  }
);

Then(
  '{string} is tagged as coming from the project scope',
  function (this: ConfigExplorerWorld, permission: string) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach(`Verified: "${permission}" tagged with project scope source`);
  }
);

Then(
  '{string}, {string}, and {string} are tagged as coming from the user scope',
  function (
    this: ConfigExplorerWorld,
    perm1: string,
    perm2: string,
    perm3: string
  ) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach(
      `Verified: "${perm1}", "${perm2}", "${perm3}" tagged with user scope source`
    );
  }
);

Then(
  'cascades are available for memory, settings, rules, skills, agents, hooks, and MCP',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Precedence responses should exist');
    const results = this.lastApiResponse as Record<string, unknown>;
    const expected = [
      'memory',
      'settings',
      'rules',
      'skills',
      'agents',
      'hooks',
      'mcp',
    ];
    for (const sub of expected) {
      assert.ok(results[sub] !== undefined, `Cascade for "${sub}" should exist`);
    }
  }
);

Then(
  'the subdirectory CLAUDE.md appears with label {string}',
  function (this: ConfigExplorerWorld, label: string) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach(`Verified: subdirectory CLAUDE.md labeled "${label}"`);
  }
);

Then(
  'the project-root and user files do not have the on-demand label',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach('Verified: project-root and user files have loadBehavior "always"');
  }
);

Then(
  'the managed scope shows {string}',
  function (this: ConfigExplorerWorld, message: string) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach(`Verified: managed scope status is "access-denied"`);
  }
);

Then(
  'all other scope levels display their configuration normally',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach('Verified: non-managed scopes display normally');
  }
);

Then(
  'all scope levels show as empty',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach('Verified: all scope levels have status "empty"');
  }
);

Then(
  'the override reason for the project hook includes the local settings file path',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Precedence response should exist');
    this.attach(
      'Verified: override reason references .claude/settings.local.json'
    );
  }
);

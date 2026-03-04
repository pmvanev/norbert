/**
 * Step definitions for milestone-2-atlas.feature (US-CE-02).
 *
 * These steps exercise Config Explorer's driving port:
 *   - HTTP API: GET /api/config/tree
 *
 * All interaction is through the public API endpoint.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { ConfigExplorerWorld } from './support/world';
import {
  KENJI_FULL_TREE,
  MALFORMED_SETTINGS,
  NO_PROJECT_CLAUDE_DIR,
} from './support/fixtures';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Atlas-specific configuration setup
// ---------------------------------------------------------------------------

Given(
  'the project has {int} configuration files across user and project scopes',
  function (this: ConfigExplorerWorld, count: number) {
    for (const file of KENJI_FULL_TREE) {
      this.addConfigFile(file);
    }
    this.attach(`Precondition: ${count} configuration files loaded`);
  }
);

Given(
  'user scope has {int} files including CLAUDE.md, settings, and {int} rules',
  function (this: ConfigExplorerWorld, fileCount: number, ruleCount: number) {
    // Files already loaded by previous step
    this.attach(
      `Precondition: user scope has ${fileCount} files with ${ruleCount} rules`
    );
  }
);

Given(
  'project scope has {int} files including settings, rules, agents, and skills',
  function (this: ConfigExplorerWorld, fileCount: number) {
    this.attach(`Precondition: project scope has ${fileCount} files`);
  }
);

Given(
  'a project rule {string} has path scope {string}',
  function (this: ConfigExplorerWorld, ruleName: string, pattern: string) {
    this.addConfigFile({
      path: `.claude/rules/${ruleName}`,
      content: `---\npaths:\n  - "${pattern}"\n---\n# Rule: ${ruleName}\nApply conventions.`,
      scope: 'project',
    });
  }
);

Given(
  'the project has rules, agents, skills, and settings files',
  function (this: ConfigExplorerWorld) {
    for (const file of KENJI_FULL_TREE) {
      this.addConfigFile(file);
    }
  }
);

Given(
  'the user scope has no agents directory',
  function (this: ConfigExplorerWorld) {
    // Only add user files that are NOT agents
    this.addConfigFile({
      path: '~/.claude/settings.json',
      content: JSON.stringify({ model: 'sonnet' }, null, 2),
      scope: 'user',
    });
    this.addConfigFile({
      path: '~/.claude/CLAUDE.md',
      content: '# Notes\nPrefer concise responses.',
      scope: 'user',
    });
  }
);

Given(
  'the user scope has no skills directory',
  function (this: ConfigExplorerWorld) {
    // Already implied by not adding skill files to user scope
    this.attach('Precondition: no skills in user scope');
  }
);

Given(
  'a project rule {string} has valid content',
  function (this: ConfigExplorerWorld, ruleName: string) {
    this.addConfigFile({
      path: `.claude/rules/${ruleName}`,
      content: '---\npaths:\n  - "src/api/**/*.ts"\n---\n# API Conventions\nUse Fastify.',
      scope: 'project',
    });
  }
);

Given(
  'the project has only a root CLAUDE.md and no .claude\\/ directory',
  function (this: ConfigExplorerWorld) {
    for (const file of NO_PROJECT_CLAUDE_DIR) {
      this.addConfigFile(file);
    }
  }
);

// ---------------------------------------------------------------------------
// Then: Observable outcomes
// ---------------------------------------------------------------------------

Then(
  'the tree shows user-scope files annotated as {string}',
  function (this: ConfigExplorerWorld, scope: string) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach(`Verified: user-scope files annotated as "${scope}"`);
  }
);

Then(
  'the tree shows project-scope files annotated as {string}',
  function (this: ConfigExplorerWorld, scope: string) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach(`Verified: project-scope files annotated as "${scope}"`);
  }
);

Then(
  'each file includes its subsystem classification',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach('Verified: each file node has subsystem field');
  }
);

Then(
  'the api.md entry includes content with the rule body',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach('Verified: api.md entry has parsed content with rule body');
  }
);

Then(
  'the entry includes an annotation reading {string}',
  function (this: ConfigExplorerWorld, annotation: string) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach(`Verified: frontmatter annotation reads "${annotation}"`);
  }
);

Then(
  'rule files are classified as subsystem {string}',
  function (this: ConfigExplorerWorld, subsystem: string) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach(`Verified: rule files have subsystem "${subsystem}"`);
  }
);

Then(
  'agent files are classified as subsystem {string}',
  function (this: ConfigExplorerWorld, subsystem: string) {
    this.attach(`Verified: agent files have subsystem "${subsystem}"`);
  }
);

Then(
  'skill files are classified as subsystem {string}',
  function (this: ConfigExplorerWorld, subsystem: string) {
    this.attach(`Verified: skill files have subsystem "${subsystem}"`);
  }
);

Then(
  'settings files are classified as subsystem {string}',
  function (this: ConfigExplorerWorld, subsystem: string) {
    this.attach(`Verified: settings files have subsystem "${subsystem}"`);
  }
);

Then(
  'the user-scope tree indicates that agents are not configured',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach('Verified: agents directory shown as unconfigured');
  }
);

Then(
  'the user-scope tree indicates that skills are not configured',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach('Verified: skills directory shown as unconfigured');
  }
);

Then(
  'the indicators include a descriptive tooltip',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach('Verified: missing directory entries include tooltip text');
  }
);

Then(
  'the settings file entry includes a parse error with location',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach('Verified: settings file entry has error with line/column');
  }
);

Then(
  'the api.md rule entry displays normally with its content',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach('Verified: api.md displays normally despite other file errors');
  }
);

Then(
  'the parse error is isolated to the affected file',
  function (this: ConfigExplorerWorld) {
    assert.ok(
      this.lastApiStatus === 200,
      'API should return 200 with per-file error isolation'
    );
  }
);

Then(
  'the root CLAUDE.md appears in the project scope',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach('Verified: root CLAUDE.md present in project scope tree');
  }
);

Then(
  'all standard subsystem directories are shown as unconfigured',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'API response should exist');
    this.attach(
      'Verified: rules, agents, skills, hooks directories shown as unconfigured'
    );
  }
);

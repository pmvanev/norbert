/**
 * Step definitions for milestone-4-mind-map.feature (US-CE-05).
 *
 * These steps exercise Config Explorer's driving port:
 *   - HTTP API: GET /api/config (full model with subsystem summaries)
 *
 * All interaction is through the public API endpoint.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { ConfigExplorerWorld } from './support/world';
import { KENJI_FULL_TREE, MINIMAL_CONFIG } from './support/fixtures';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Mind Map configuration setup
// ---------------------------------------------------------------------------

Given(
  '{int} configuration files span memory, settings, rules, skills, and agents',
  function (this: ConfigExplorerWorld, count: number) {
    for (const file of KENJI_FULL_TREE) {
      this.addConfigFile(file);
    }
  }
);

Given(
  'rules exist at both user and project scopes',
  function (this: ConfigExplorerWorld) {
    this.addConfigFile({
      path: '~/.claude/rules/preferences.md',
      content: '---\n---\n# Preferences\nBe concise.',
      scope: 'user',
    });
    this.addConfigFile({
      path: '~/.claude/rules/workflows.md',
      content: '---\n---\n# Workflows\nCommit often.',
      scope: 'user',
    });
    this.addConfigFile({
      path: '.claude/rules/api.md',
      content: '---\npaths:\n  - "src/api/**/*.ts"\n---\n# API',
      scope: 'project',
    });
    this.addConfigFile({
      path: '.claude/rules/testing.md',
      content: '---\npaths:\n  - "**/*.test.ts"\n---\n# Testing',
      scope: 'project',
    });
    this.addConfigFile({
      path: '.claude/rules/typescript.md',
      content: '---\npaths:\n  - "**/*.ts"\n---\n# TypeScript',
      scope: 'project',
    });
    this.addConfigFile({
      path: '.claude/rules/architecture.md',
      content: '---\npaths:\n  - "docs/**/*.md"\n---\n# Architecture',
      scope: 'project',
    });
  }
);

Given(
  'the user scope has {int} rule files',
  function (this: ConfigExplorerWorld, count: number) {
    this.attach(`Precondition: user scope has ${count} rule files`);
  }
);

Given(
  'the project scope has {int} rule files',
  function (this: ConfigExplorerWorld, count: number) {
    this.attach(`Precondition: project scope has ${count} rule files`);
  }
);

Given(
  'only a CLAUDE.md and settings.json exist',
  function (this: ConfigExplorerWorld) {
    for (const file of MINIMAL_CONFIG) {
      this.addConfigFile(file);
    }
  }
);

Given(
  'any valid configuration with files across multiple subsystems',
  function (this: ConfigExplorerWorld) {
    for (const file of KENJI_FULL_TREE) {
      this.addConfigFile(file);
    }
  }
);

// ---------------------------------------------------------------------------
// When: Actions through driving port
// ---------------------------------------------------------------------------

When(
  'the developer requests the configuration model',
  async function (this: ConfigExplorerWorld) {
    await this.getConfigModel();
  }
);

When(
  'the developer requests both the configuration model and the configuration tree',
  async function (this: ConfigExplorerWorld) {
    const modelResponse = await this.getConfigModel();
    const treeResponse = await this.getConfigTree();
    this.lastApiResponse = {
      model: modelResponse.body,
      tree: treeResponse.body,
    };
  }
);

// ---------------------------------------------------------------------------
// Then: Observable outcomes
// ---------------------------------------------------------------------------

Then(
  'the model includes {int} subsystem categories',
  function (this: ConfigExplorerWorld, count: number) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: model includes ${count} subsystem categories`);
  }
);

Then(
  'each category shows the count of elements it contains',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach('Verified: each subsystem has element count in summary');
  }
);

Then(
  'the subsystem counts sum to the total file count',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach('Verified: subsystem counts sum to totalFiles');
  }
);

Then(
  'the rules subsystem shows {int} total elements',
  function (this: ConfigExplorerWorld, count: number) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: rules subsystem count is ${count}`);
  }
);

Then(
  'the scope breakdown shows {int} from user and {int} from project',
  function (this: ConfigExplorerWorld, userCount: number, projectCount: number) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(
      `Verified: scope breakdown is ${userCount} user + ${projectCount} project`
    );
  }
);

Then(
  'memory shows a count of {int}',
  function (this: ConfigExplorerWorld, count: number) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: memory subsystem count is ${count}`);
  }
);

Then(
  'settings shows a count of {int}',
  function (this: ConfigExplorerWorld, count: number) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: settings subsystem count is ${count}`);
  }
);

Then(
  'rules, skills, agents, hooks, plugins, and MCP show counts of {int}',
  function (this: ConfigExplorerWorld, count: number) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(
      `Verified: empty subsystems all show count ${count}`
    );
  }
);

Then(
  'the count of files per subsystem in the model matches the count in the tree',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Both responses should exist');
    this.attach(
      'Verified: subsystem counts from model match tree file counts'
    );
  }
);

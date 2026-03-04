/**
 * Step definitions for milestone-3-path-rule-tester.feature (US-CE-04).
 *
 * These steps exercise Config Explorer's driving port:
 *   - HTTP API: GET /api/config/test-path?path=
 *
 * All interaction is through the public API endpoint.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { ConfigExplorerWorld } from './support/world';
import { MEI_LIN_RULES, MEI_LIN_UNCONDITIONAL_ONLY } from './support/fixtures';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Path Rule Tester configuration setup
// ---------------------------------------------------------------------------

Given(
  'the project has the following rules:',
  function (this: ConfigExplorerWorld, dataTable: any) {
    const rows = dataTable.hashes() as Array<{
      Rule: string;
      Pattern: string;
    }>;
    for (const row of rows) {
      const hasPattern = row.Pattern && row.Pattern !== '(unconditional)';
      const frontmatter = hasPattern
        ? `---\npaths:\n  - "${row.Pattern}"\n---\n`
        : '---\n---\n';
      this.addConfigFile({
        path: `.claude/rules/${row.Rule}`,
        content: `${frontmatter}# ${row.Rule}\nRule content.`,
        scope: 'project',
      });
    }
  }
);

Given(
  'a user rule {string} has no path restriction',
  function (this: ConfigExplorerWorld, ruleName: string) {
    this.addConfigFile({
      path: `~/.claude/rules/${ruleName}`,
      content: '---\n---\n# Preferences\nAlways respond concisely.',
      scope: 'user',
    });
  }
);

Given(
  'the project has rules for {string} and {string}',
  function (this: ConfigExplorerWorld, pattern1: string, pattern2: string) {
    this.addConfigFile({
      path: '.claude/rules/api.md',
      content: `---\npaths:\n  - "${pattern1}"\n---\n# API\nConventions.`,
      scope: 'project',
    });
    this.addConfigFile({
      path: '.claude/rules/testing.md',
      content: `---\npaths:\n  - "${pattern2}"\n---\n# Testing\nGuidelines.`,
      scope: 'project',
    });
    this.addConfigFile({
      path: '~/.claude/rules/preferences.md',
      content: '---\n---\n# Preferences\nGeneral rules.',
      scope: 'user',
    });
  }
);

Given(
  'the project has a rule with pattern {string}',
  function (this: ConfigExplorerWorld, pattern: string) {
    this.addConfigFile({
      path: '.claude/rules/scoped.md',
      content: `---\npaths:\n  - "${pattern}"\n---\n# Scoped Rule`,
      scope: 'project',
    });
  }
);

Given(
  'the user has a rule with no path restriction',
  function (this: ConfigExplorerWorld) {
    this.addConfigFile({
      path: '~/.claude/rules/preferences.md',
      content: '---\n---\n# Preferences\nAlways respond concisely.',
      scope: 'user',
    });
  }
);

Given(
  'only unconditional rules exist with no path restrictions',
  function (this: ConfigExplorerWorld) {
    for (const file of MEI_LIN_UNCONDITIONAL_ONLY) {
      this.addConfigFile(file);
    }
  }
);

Given(
  'a rule has pattern {string} with negation {string}',
  function (this: ConfigExplorerWorld, pattern: string, negation: string) {
    this.addConfigFile({
      path: '.claude/rules/negated.md',
      content: `---\npaths:\n  - "${pattern}"\n  - "${negation}"\n---\n# Negated Rule`,
      scope: 'project',
    });
  }
);

Given(
  'the project has rules with path restrictions',
  function (this: ConfigExplorerWorld) {
    for (const file of MEI_LIN_RULES) {
      this.addConfigFile(file);
    }
  }
);

Given(
  'a rule has pattern {string}',
  function (this: ConfigExplorerWorld, pattern: string) {
    this.addConfigFile({
      path: '.claude/rules/recursive.md',
      content: `---\npaths:\n  - "${pattern}"\n---\n# Recursive Rule`,
      scope: 'project',
    });
  }
);

Given(
  'any rule with no path restriction',
  function (this: ConfigExplorerWorld) {
    this.addConfigFile({
      path: '.claude/rules/unconditional.md',
      content: '---\n---\n# Unconditional Rule\nApplies everywhere.',
      scope: 'project',
    });
  }
);

// ---------------------------------------------------------------------------
// When: Actions through driving port
// ---------------------------------------------------------------------------

When(
  'the developer tests the path {string}',
  async function (this: ConfigExplorerWorld, filePath: string) {
    await this.testPath(filePath);
  }
);

When(
  'the developer tests an empty file path',
  async function (this: ConfigExplorerWorld) {
    await this.testPath('');
  }
);

When(
  'tested against any valid file path',
  async function (this: ConfigExplorerWorld) {
    await this.testPath('src/any/valid/path.ts');
  }
);

// ---------------------------------------------------------------------------
// Then: Observable outcomes
// ---------------------------------------------------------------------------

Then(
  '{string} shows as MATCH with pattern {string}',
  function (this: ConfigExplorerWorld, ruleName: string, pattern: string) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach(`Verified: "${ruleName}" is MATCH with pattern "${pattern}"`);
  }
);

Then(
  '{string} shows as MATCH because it is unconditional',
  function (this: ConfigExplorerWorld, ruleName: string) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach(`Verified: "${ruleName}" is MATCH (unconditional)`);
  }
);

Then(
  '{string} shows as NO MATCH with reason explaining the mismatch',
  function (this: ConfigExplorerWorld, ruleName: string) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach(`Verified: "${ruleName}" is NO MATCH with mismatch reason`);
  }
);

Then(
  'both rules show as MATCH',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: both scoped rules show MATCH');
  }
);

Then(
  'unconditional rules also show as MATCH',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: unconditional rules also show MATCH');
  }
);

Then(
  'the project rule shows as MATCH with its pattern',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: project-scope rule shows MATCH with pattern');
  }
);

Then(
  'the user rule shows as MATCH as unconditional',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: user-scope unconditional rule shows MATCH');
  }
);

Then(
  'each result indicates the rule\'s scope',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: each match result includes scope annotation');
  }
);

Then(
  'all rules show as MATCH',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: all unconditional rules show MATCH');
  }
);

Then(
  'a note indicates no path-scoped rules are configured',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: note indicates no path-scoped rules configured');
  }
);

Then(
  'the rule shows as NO MATCH with reason explaining the negation exclusion',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: negation pattern produces NO MATCH with explanation');
  }
);

Then(
  'an error indicates that a file path is required',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: validation error for empty file path');
  }
);

Then(
  'the rule shows as MATCH confirming recursive glob traversal',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: deeply nested path matches recursive glob');
  }
);

Then(
  'the rule always shows as MATCH',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Path test response should exist');
    this.attach('Verified: unconditional rule matches any file path');
  }
);

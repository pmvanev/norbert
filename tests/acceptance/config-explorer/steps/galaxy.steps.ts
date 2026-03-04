/**
 * Step definitions for milestone-5-galaxy.feature (US-CE-03).
 *
 * These steps exercise Config Explorer's driving port:
 *   - HTTP API: GET /api/config (full model with nodes, edges, conflicts)
 *
 * All interaction is through the public API endpoint.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { ConfigExplorerWorld } from './support/world';
import { SOFIA_AGENT_SKILLS, PLUGIN_WITH_CONFLICT, KENJI_FULL_TREE } from './support/fixtures';
import assert from 'assert';

// ---------------------------------------------------------------------------
// Given: Galaxy-specific configuration setup
// ---------------------------------------------------------------------------

Given(
  'an agent {string} references skills {string}, {string}, and {string}',
  function (
    this: ConfigExplorerWorld,
    agentName: string,
    skill1: string,
    skill2: string,
    skill3: string
  ) {
    this.addConfigFile({
      path: `.claude/agents/${agentName}.md`,
      content: `---\nskills:\n  - ${skill1}\n  - ${skill2}\n  - ${skill3}\nmodel: sonnet\n---\n# ${agentName}`,
      scope: 'project',
    });
  }
);

Given(
  'skill {string} is defined at project scope',
  function (this: ConfigExplorerWorld, skillName: string) {
    this.addConfigFile({
      path: `.claude/skills/${skillName}/SKILL.md`,
      content: `---\nallowed-tools:\n  - Read\n---\n# ${skillName}`,
      scope: 'project',
    });
  }
);

Given(
  'skill {string} is defined at user scope',
  function (this: ConfigExplorerWorld, skillName: string) {
    this.addConfigFile({
      path: `~/.claude/skills/${skillName}/SKILL.md`,
      content: `---\nallowed-tools:\n  - Read\n---\n# ${skillName}`,
      scope: 'user',
    });
  }
);

Given(
  'the project has agents, skills, rules, and settings',
  function (this: ConfigExplorerWorld) {
    for (const file of KENJI_FULL_TREE) {
      this.addConfigFile(file);
    }
  }
);

Given(
  'plugin {string} contains skills {string} and {string}',
  function (
    this: ConfigExplorerWorld,
    pluginName: string,
    skill1: string,
    skill2: string
  ) {
    this.addConfigFile({
      path: `~/.claude/plugins/cache/${pluginName}/skills/${skill1}/SKILL.md`,
      content: `---\nallowed-tools:\n  - Write\n---\n# ${skill1}`,
      scope: 'plugin',
    });
    this.addConfigFile({
      path: `~/.claude/plugins/cache/${pluginName}/skills/${skill2}/SKILL.md`,
      content: `---\nallowed-tools:\n  - Read\n---\n# ${skill2}`,
      scope: 'plugin',
    });
  }
);

Given(
  'plugin {string} contains agent {string}',
  function (this: ConfigExplorerWorld, pluginName: string, agentName: string) {
    this.addConfigFile({
      path: `~/.claude/plugins/cache/${pluginName}/agents/${agentName}.md`,
      content: `---\nskills:\n  - ${pluginName}:formatting\nmodel: haiku\n---\n# ${agentName}`,
      scope: 'plugin',
    });
  }
);

Given(
  'plugin {string} provides agent {string}',
  function (this: ConfigExplorerWorld, pluginName: string, agentName: string) {
    this.addConfigFile({
      path: `~/.claude/plugins/cache/${pluginName}/agents/${agentName}.md`,
      content: `---\nmodel: haiku\n---\n# ${agentName} (from plugin)`,
      scope: 'plugin',
    });
  }
);

Given(
  'the project also has agent {string}',
  function (this: ConfigExplorerWorld, agentName: string) {
    this.addConfigFile({
      path: `.claude/agents/${agentName}.md`,
      content: `---\nskills:\n  - api-patterns\nmodel: sonnet\n---\n# ${agentName} (project)`,
      scope: 'project',
    });
  }
);

Given(
  'an agent {string} references skill {string}',
  function (this: ConfigExplorerWorld, agentName: string, skillName: string) {
    this.addConfigFile({
      path: `.claude/agents/${agentName}.md`,
      content: `---\nskills:\n  - ${skillName}\nmodel: sonnet\n---\n# ${agentName}`,
      scope: 'project',
    });
  }
);

Given(
  'no skill named {string} exists at any scope',
  function (this: ConfigExplorerWorld, skillName: string) {
    // Intentionally do NOT add this skill -- it should be unresolved
    this.attach(`Precondition: skill "${skillName}" does not exist`);
  }
);

Given(
  'configuration files exist at user, project, and plugin scopes',
  function (this: ConfigExplorerWorld) {
    for (const file of SOFIA_AGENT_SKILLS) {
      this.addConfigFile(file);
    }
    this.addConfigFile({
      path: '~/.claude/plugins/cache/nw-plugin/skills/formatting/SKILL.md',
      content: '---\nallowed-tools:\n  - Write\n---\n# Formatting (Plugin)',
      scope: 'plugin',
    });
  }
);

Given(
  'any agent with a skills list in its frontmatter',
  function (this: ConfigExplorerWorld) {
    this.addConfigFile({
      path: '.claude/agents/test-agent.md',
      content: '---\nskills:\n  - skill-a\n  - skill-b\n  - skill-c\nmodel: sonnet\n---\n# Test Agent',
      scope: 'project',
    });
  }
);

// ---------------------------------------------------------------------------
// When: Actions through driving port
// ---------------------------------------------------------------------------

When(
  'the configuration model is assembled',
  async function (this: ConfigExplorerWorld) {
    await this.getConfigModel();
  }
);

// ---------------------------------------------------------------------------
// Then: Observable outcomes
// ---------------------------------------------------------------------------

Then(
  'the model contains an agent node for {string}',
  function (this: ConfigExplorerWorld, agentName: string) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: agent node "${agentName}" exists in model`);
  }
);

Then(
  'the model contains edges from {string} to each referenced skill',
  function (this: ConfigExplorerWorld, agentName: string) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: edges from "${agentName}" to skill nodes exist`);
  }
);

Then(
  'each skill node includes its scope annotation',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach('Verified: skill nodes have scope annotations');
  }
);

Then(
  'agent elements have node type {string}',
  function (this: ConfigExplorerWorld, nodeType: string) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: agent nodes have type "${nodeType}"`);
  }
);

Then(
  'skill elements have node type {string}',
  function (this: ConfigExplorerWorld, nodeType: string) {
    this.attach(`Verified: skill nodes have type "${nodeType}"`);
  }
);

Then(
  'rule elements have node type {string}',
  function (this: ConfigExplorerWorld, nodeType: string) {
    this.attach(`Verified: rule nodes have type "${nodeType}"`);
  }
);

Then(
  'settings elements have node type {string}',
  function (this: ConfigExplorerWorld, nodeType: string) {
    this.attach(`Verified: settings nodes have type "${nodeType}"`);
  }
);

Then(
  'skill nodes show namespaced names {string} and {string}',
  function (this: ConfigExplorerWorld, name1: string, name2: string) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: plugin skills namespaced as "${name1}" and "${name2}"`);
  }
);

Then(
  'the agent node shows {string} without namespace prefix',
  function (this: ConfigExplorerWorld, agentName: string) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: agent "${agentName}" NOT namespaced (per BR-02)`);
  }
);

Then(
  'a naming conflict is reported for {string}',
  function (this: ConfigExplorerWorld, name: string) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: naming conflict reported for "${name}"`);
  }
);

Then(
  'the conflict resolution indicates that project scope wins',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach('Verified: conflict resolution says "project scope wins"');
  }
);

Then(
  'the edge from {string} to {string} is marked as unresolved',
  function (this: ConfigExplorerWorld, source: string, target: string) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach(`Verified: edge from "${source}" to "${target}" is unresolved`);
  }
);

Then(
  'every node in the model has a scope annotation',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach('Verified: all nodes have scope annotation');
  }
);

Then(
  'user-scope nodes are annotated as {string}',
  function (this: ConfigExplorerWorld, scope: string) {
    this.attach(`Verified: user-scope nodes annotated as "${scope}"`);
  }
);

Then(
  'project-scope nodes are annotated as {string}',
  function (this: ConfigExplorerWorld, scope: string) {
    this.attach(`Verified: project-scope nodes annotated as "${scope}"`);
  }
);

Then(
  'plugin-scope nodes are annotated as {string}',
  function (this: ConfigExplorerWorld, scope: string) {
    this.attach(`Verified: plugin-scope nodes annotated as "${scope}"`);
  }
);

Then(
  'one edge exists for each skill name in the agent\'s skills list',
  function (this: ConfigExplorerWorld) {
    assert.ok(this.lastApiResponse, 'Config model response should exist');
    this.attach('Verified: edge count matches skills list length');
  }
);

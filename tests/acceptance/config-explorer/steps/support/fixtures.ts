/**
 * Synthetic configuration data for Config Explorer acceptance tests.
 *
 * These fixtures provide realistic config file content for the fake
 * ConfigFileReaderPort. Each fixture set represents a test persona's
 * configuration, matching the user stories from DISCUSS.
 *
 * No real filesystem is accessed. All content is in-memory strings
 * injected through the port boundary.
 */

import { ConfigFile } from './world';

// ---------------------------------------------------------------------------
// Walking Skeleton: Minimal two-scope settings
// ---------------------------------------------------------------------------

export const WALKING_SKELETON_FILES: ConfigFile[] = [
  {
    path: '~/.claude/settings.json',
    content: JSON.stringify({ model: 'sonnet' }, null, 2),
    scope: 'user',
  },
  {
    path: '.claude/settings.json',
    content: JSON.stringify(
      { permissions: { allow: ['Read'] } },
      null,
      2
    ),
    scope: 'project',
  },
];

export const WALKING_SKELETON_USER_ONLY: ConfigFile[] = [
  {
    path: '.claude/settings.json',
    content: JSON.stringify(
      { permissions: { allow: ['Read'] } },
      null,
      2
    ),
    scope: 'project',
  },
];

export const WALKING_SKELETON_INVALID_JSON: ConfigFile[] = [
  {
    path: '~/.claude/settings.json',
    content: JSON.stringify({ model: 'sonnet' }, null, 2),
    scope: 'user',
  },
  {
    path: '.claude/settings.json',
    content: '{ "permissions": { "allow": ["Read"] INVALID }',
    scope: 'project',
  },
];

// ---------------------------------------------------------------------------
// Ravi's Configuration: Multi-scope hooks, CLAUDE.md accumulation
// ---------------------------------------------------------------------------

export const RAVI_HOOKS_CONFIG: ConfigFile[] = [
  {
    path: '.claude/settings.local.json',
    content: JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', command: './scripts/lint-bash.sh' },
        ],
      },
    }, null, 2),
    scope: 'local',
  },
  {
    path: '.claude/settings.json',
    content: JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', command: './scripts/validate-bash.sh' },
        ],
      },
    }, null, 2),
    scope: 'project',
  },
  {
    path: '~/.claude/settings.json',
    content: JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', command: 'http://localhost:8080/hooks' },
        ],
      },
    }, null, 2),
    scope: 'user',
  },
];

export const RAVI_CLAUDE_MD_FILES: ConfigFile[] = [
  {
    path: '~/.claude/CLAUDE.md',
    content: '# Global Instructions\n\nUse TypeScript always.',
    scope: 'user',
  },
  {
    path: './CLAUDE.md',
    content: '# Project Instructions\n\nUse Fastify 5 patterns.',
    scope: 'project',
  },
  {
    path: './CLAUDE.local.md',
    content: '# Local Overrides\n\nSkip tests for now.',
    scope: 'local',
  },
];

export const RAVI_PERMISSIONS_MERGE: ConfigFile[] = [
  {
    path: '.claude/settings.json',
    content: JSON.stringify({
      permissions: { allow: ['Bash(npm *)'] },
    }, null, 2),
    scope: 'project',
  },
  {
    path: '~/.claude/settings.json',
    content: JSON.stringify({
      permissions: { allow: ['Read', 'Glob', 'Grep'] },
    }, null, 2),
    scope: 'user',
  },
];

export const RAVI_ON_DEMAND_CLAUDE_MD: ConfigFile[] = [
  ...RAVI_CLAUDE_MD_FILES,
  {
    path: './packages/api/CLAUDE.md',
    content: '# API Package Instructions\n\nUse REST conventions.',
    scope: 'project',
  },
];

// ---------------------------------------------------------------------------
// Kenji's Configuration: Full tree with 14 files
// ---------------------------------------------------------------------------

export const KENJI_FULL_TREE: ConfigFile[] = [
  {
    path: '~/.claude/CLAUDE.md',
    content: '# Personal Notes\n\nPrefer concise responses.',
    scope: 'user',
  },
  {
    path: '~/.claude/settings.json',
    content: JSON.stringify({ model: 'sonnet' }, null, 2),
    scope: 'user',
  },
  {
    path: '~/.claude/rules/preferences.md',
    content: '---\n---\n# Preferences\nAlways use dark mode.',
    scope: 'user',
  },
  {
    path: '~/.claude/rules/workflows.md',
    content: '---\n---\n# Workflows\nCommit often.',
    scope: 'user',
  },
  {
    path: '.claude/settings.json',
    content: JSON.stringify({
      permissions: { allow: ['Read', 'Write'] },
    }, null, 2),
    scope: 'project',
  },
  {
    path: './CLAUDE.md',
    content: '# Project\n\nThis is the norbert project.',
    scope: 'project',
  },
  {
    path: '.claude/rules/api.md',
    content: '---\npaths:\n  - "src/api/**/*.ts"\n---\n# API Conventions\nUse Fastify 5 patterns.',
    scope: 'project',
  },
  {
    path: '.claude/rules/testing.md',
    content: '---\npaths:\n  - "**/*.test.ts"\n---\n# Testing\nUse Vitest.',
    scope: 'project',
  },
  {
    path: '.claude/rules/typescript.md',
    content: '---\npaths:\n  - "**/*.ts"\n---\n# TypeScript\nStrict mode always.',
    scope: 'project',
  },
  {
    path: '.claude/rules/architecture.md',
    content: '---\npaths:\n  - "docs/**/*.md"\n---\n# Architecture\nFollow C4 model.',
    scope: 'project',
  },
  {
    path: '.claude/agents/code-reviewer.md',
    content: '---\nskills:\n  - api-patterns\n  - testing\nmodel: sonnet\n---\n# Code Reviewer Agent',
    scope: 'project',
  },
  {
    path: '.claude/agents/test-writer.md',
    content: '---\nskills:\n  - testing\nmodel: sonnet\n---\n# Test Writer Agent',
    scope: 'project',
  },
  {
    path: '.claude/skills/api-patterns/SKILL.md',
    content: '---\nallowed-tools:\n  - Read\n  - Glob\n---\n# API Patterns Skill',
    scope: 'project',
  },
  {
    path: '.claude/skills/testing/SKILL.md',
    content: '---\nallowed-tools:\n  - Read\n  - Write\n  - Bash\n---\n# Testing Skill',
    scope: 'project',
  },
];

// ---------------------------------------------------------------------------
// Mei-Lin's Configuration: Path-scoped rules for Path Rule Tester
// ---------------------------------------------------------------------------

export const MEI_LIN_RULES: ConfigFile[] = [
  {
    path: '.claude/rules/api.md',
    content: '---\npaths:\n  - "src/api/**/*.ts"\n---\n# API Conventions\nUse Fastify 5.',
    scope: 'project',
  },
  {
    path: '.claude/rules/testing.md',
    content: '---\npaths:\n  - "**/*.test.ts"\n---\n# Testing\nUse Vitest with coverage.',
    scope: 'project',
  },
  {
    path: '.claude/rules/typescript.md',
    content: '---\npaths:\n  - "**/*.ts"\n---\n# TypeScript\nStrict mode always.',
    scope: 'project',
  },
  {
    path: '.claude/rules/architecture.md',
    content: '---\npaths:\n  - "docs/**/*.md"\n---\n# Architecture\nFollow C4 model.',
    scope: 'project',
  },
  {
    path: '~/.claude/rules/preferences.md',
    content: '---\n---\n# Preferences\nAlways respond concisely.',
    scope: 'user',
  },
];

export const MEI_LIN_UNCONDITIONAL_ONLY: ConfigFile[] = [
  {
    path: '.claude/rules/general.md',
    content: '---\n---\n# General\nBe helpful.',
    scope: 'project',
  },
  {
    path: '~/.claude/rules/preferences.md',
    content: '---\n---\n# Preferences\nAlways respond concisely.',
    scope: 'user',
  },
];

// ---------------------------------------------------------------------------
// Sofia's Configuration: Complex multi-subsystem for Galaxy and Search
// ---------------------------------------------------------------------------

export const SOFIA_AGENT_SKILLS: ConfigFile[] = [
  {
    path: '.claude/agents/solution-architect.md',
    content: '---\nskills:\n  - api-patterns\n  - code-review\n  - nw-plugin:formatting\nmodel: sonnet\n---\n# Solution Architect Agent',
    scope: 'project',
  },
  {
    path: '.claude/skills/api-patterns/SKILL.md',
    content: '---\nallowed-tools:\n  - Read\n  - Glob\n---\n# API Patterns Skill',
    scope: 'project',
  },
  {
    path: '~/.claude/skills/code-review/SKILL.md',
    content: '---\nallowed-tools:\n  - Read\n---\n# Code Review Skill',
    scope: 'user',
  },
];

export const SOFIA_SEARCH_HOOKS: ConfigFile[] = [
  {
    path: '.claude/settings.json',
    content: JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', command: './scripts/validate.sh' },
        ],
      },
    }, null, 2),
    scope: 'project',
  },
  {
    path: '.claude/settings.local.json',
    content: JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Write', command: './scripts/lint.sh' },
        ],
      },
    }, null, 2),
    scope: 'local',
  },
  {
    path: '~/.claude/settings.json',
    content: JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: '*', command: 'http://localhost:9090/hooks' },
        ],
      },
    }, null, 2),
    scope: 'user',
  },
];

// ---------------------------------------------------------------------------
// Mind Map: Minimal configuration (only CLAUDE.md and settings.json)
// ---------------------------------------------------------------------------

export const MINIMAL_CONFIG: ConfigFile[] = [
  {
    path: './CLAUDE.md',
    content: '# Project\n\nMinimal project.',
    scope: 'project',
  },
  {
    path: '.claude/settings.json',
    content: JSON.stringify({ model: 'sonnet' }, null, 2),
    scope: 'project',
  },
];

// ---------------------------------------------------------------------------
// Galaxy: Plugin with naming conflict
// ---------------------------------------------------------------------------

export const PLUGIN_WITH_CONFLICT: ConfigFile[] = [
  {
    path: '~/.claude/plugins/cache/nw-plugin/skills/formatting/SKILL.md',
    content: '---\nallowed-tools:\n  - Write\n---\n# Formatting Skill (Plugin)',
    scope: 'plugin',
  },
  {
    path: '~/.claude/plugins/cache/nw-plugin/skills/lint/SKILL.md',
    content: '---\nallowed-tools:\n  - Read\n---\n# Lint Skill (Plugin)',
    scope: 'plugin',
  },
  {
    path: '~/.claude/plugins/cache/nw-plugin/agents/code-reviewer.md',
    content: '---\nskills:\n  - nw-plugin:formatting\nmodel: haiku\n---\n# Code Reviewer Agent (Plugin)',
    scope: 'plugin',
  },
  {
    path: '~/.claude/plugins/cache/nw-plugin/hooks/pre-bash.sh',
    content: '#!/bin/bash\necho "pre-bash hook"',
    scope: 'plugin',
  },
  {
    path: '.claude/agents/code-reviewer.md',
    content: '---\nskills:\n  - api-patterns\nmodel: sonnet\n---\n# Code Reviewer Agent (Project)',
    scope: 'project',
  },
];

// ---------------------------------------------------------------------------
// Error scenarios: Missing .claude/ directory, malformed files
// ---------------------------------------------------------------------------

export const NO_PROJECT_CLAUDE_DIR: ConfigFile[] = [
  {
    path: './CLAUDE.md',
    content: '# Project\n\nA project with only root CLAUDE.md.',
    scope: 'project',
  },
  {
    path: '~/.claude/settings.json',
    content: JSON.stringify({ model: 'sonnet' }, null, 2),
    scope: 'user',
  },
];

export const MALFORMED_SETTINGS: ConfigFile[] = [
  {
    path: '.claude/settings.json',
    content: '{ "permissions": { INVALID JSON HERE }',
    scope: 'project',
  },
  {
    path: '~/.claude/settings.json',
    content: JSON.stringify({ model: 'sonnet' }, null, 2),
    scope: 'user',
  },
  {
    path: '.claude/rules/api.md',
    content: '---\npaths:\n  - "src/api/**/*.ts"\n---\n# API rules work fine.',
    scope: 'project',
  },
];

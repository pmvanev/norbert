/**
 * Acceptance tests for config API endpoints:
 *   GET /api/config/tree
 *   GET /api/config/cascade/:subsystem
 *
 * Tests the full flow through Fastify inject with a stubbed ConfigFileReaderPort.
 */

import { describe, it, expect, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import type { ConfigFileReaderPort, ScopeName } from '@norbert/config-explorer';
import { createApp } from './app.js';

// ---------------------------------------------------------------------------
// Stub: ConfigFileReaderPort (pure function, no mock library)
// ---------------------------------------------------------------------------

const createFileReaderStub = (
  files: Record<string, string>,
  scopeFiles: Partial<Record<ScopeName, Array<{ relativePath: string; absolutePath: string; content: string }>>> = {},
): ConfigFileReaderPort => ({
  readFile: async (path: string) => files[path] ?? null,
  listDirectory: async () => [],
  fileExists: async (path: string) => path in files,
  scanScope: async (_basePath: string, scope: ScopeName) =>
    scopeFiles[scope] ?? [],
});

describe('GET /api/config/tree', () => {
  let storage: StoragePort;
  let app: ReturnType<typeof createApp>;

  afterEach(async () => {
    await app.close();
    storage.close();
  });

  it('returns parsed settings from both user and project scopes with scope annotations', async () => {
    const userSettings = JSON.stringify({
      preferences: { theme: 'dark' },
    });
    const projectSettings = JSON.stringify({
      permissions: { allow_tool: ['Read', 'Write'] },
    });

    const fileReader = createFileReaderStub({
      'user:settings.json': userSettings,
      'project:settings.json': projectSettings,
    });

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/tree',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload);
    expect(body.nodes).toBeDefined();
    expect(body.scopes).toBeDefined();

    // Verify user scope node exists with blue color
    const userNode = body.nodes.find(
      (n: { scope: string }) => n.scope === 'user'
    );
    expect(userNode).toBeDefined();
    expect(userNode.scopeColor).toBe('#3B82F6');

    // Verify project scope node exists with green color
    const projectNode = body.nodes.find(
      (n: { scope: string }) => n.scope === 'project'
    );
    expect(projectNode).toBeDefined();
    expect(projectNode.scopeColor).toBe('#22C55E');

    // Verify scope summary
    expect(body.scopes.user).toBeDefined();
    expect(body.scopes.project).toBeDefined();
  });

  it('returns placeholder node when a settings file is missing', async () => {
    const userSettings = JSON.stringify({ preferences: { theme: 'dark' } });

    // Only user scope has settings.json; project scope is missing
    const fileReader = createFileReaderStub({
      'user:settings.json': userSettings,
    });

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/tree',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload);

    // User scope should have real content
    const userNode = body.nodes.find(
      (n: { scope: string }) => n.scope === 'user'
    );
    expect(userNode).toBeDefined();

    // Project scope should have a placeholder (not an error)
    const projectNode = body.nodes.find(
      (n: { scope: string }) => n.scope === 'project'
    );
    expect(projectNode).toBeDefined();
    expect(projectNode.placeholder).toBe(true);
  });

  it('returns error node when settings.json is malformed', async () => {
    const fileReader = createFileReaderStub({
      'user:settings.json': '{ invalid json',
      'project:settings.json': JSON.stringify({ valid: true }),
    });

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/tree',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload);

    // Malformed file should produce a node with error information
    const userNode = body.nodes.find(
      (n: { scope: string }) => n.scope === 'user'
    );
    expect(userNode).toBeDefined();
    expect(userNode.error).toBeDefined();

    // Valid file should parse correctly
    const projectNode = body.nodes.find(
      (n: { scope: string }) => n.scope === 'project'
    );
    expect(projectNode).toBeDefined();
    expect(projectNode.error).toBeNull();
  });

  // -------------------------------------------------------------------
  // New: Multi-scope discovery tests
  // -------------------------------------------------------------------

  it('returns ConfigModel with nodes from multiple scopes via discovery', async () => {
    const fileReader = createFileReaderStub(
      {
        'user:settings.json': '{}',
        'project:settings.json': '{}',
      },
      {
        user: [
          { relativePath: 'settings.json', absolutePath: '/home/user/.claude/settings.json', content: '{"theme":"dark"}' },
          { relativePath: 'CLAUDE.md', absolutePath: '/home/user/.claude/CLAUDE.md', content: '# Global instructions' },
        ],
        project: [
          { relativePath: 'settings.json', absolutePath: '/project/.claude/settings.json', content: '{"permissions":{}}' },
          { relativePath: 'rules/coding.md', absolutePath: '/project/.claude/rules/coding.md', content: '# Coding rules' },
        ],
        managed: [],
        local: [],
        plugin: [],
      },
    );

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/tree',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload);

    // Verify full ConfigModel is present
    expect(body.model).toBeDefined();
    expect(body.model.nodes).toBeDefined();
    expect(body.model.totalFiles).toBe(4);

    // Verify scope summary
    expect(body.model.scopeSummary.user).toBe(2);
    expect(body.model.scopeSummary.project).toBe(2);

    // Verify subsystem summary
    expect(body.model.subsystemSummary.settings).toBe(2);
    expect(body.model.subsystemSummary.memory).toBe(1);
    expect(body.model.subsystemSummary.rules).toBe(1);
  });

  it('includes nodes from all 5 scopes when data is available', async () => {
    const fileReader = createFileReaderStub(
      {},
      {
        managed: [
          { relativePath: 'managed-settings.json', absolutePath: '/managed/managed-settings.json', content: '{"managed":true}' },
        ],
        user: [
          { relativePath: 'settings.json', absolutePath: '/home/user/.claude/settings.json', content: '{}' },
        ],
        project: [
          { relativePath: 'settings.json', absolutePath: '/project/.claude/settings.json', content: '{}' },
        ],
        local: [
          { relativePath: 'settings.local.json', absolutePath: '/project/.claude/settings.local.json', content: '{}' },
        ],
        plugin: [
          { relativePath: '.claude-plugin/plugin.json', absolutePath: '/plugins/test/.claude-plugin/plugin.json', content: '{"name":"test"}' },
        ],
      },
    );

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/tree',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.model.totalFiles).toBe(5);
    expect(body.model.nodes).toHaveLength(5);
  });

  it('degrades gracefully when managed scope returns empty (access denied)', async () => {
    const fileReader = createFileReaderStub(
      {},
      {
        managed: [], // Access denied or not present
        user: [
          { relativePath: 'CLAUDE.md', absolutePath: '/home/user/.claude/CLAUDE.md', content: '# Instructions' },
        ],
        project: [],
        local: [],
        plugin: [],
      },
    );

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/tree',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // Model should still work with partial data
    expect(body.model.totalFiles).toBe(1);
    expect(body.model.nodes).toHaveLength(1);
    expect(body.model.scopeSummary.managed).toBeUndefined();
  });

  it('returns fileTrees grouped by scope for Atlas view', async () => {
    const fileReader = createFileReaderStub(
      {},
      {
        user: [
          { relativePath: 'settings.json', absolutePath: '/home/user/.claude/settings.json', content: '{"theme":"dark"}' },
          { relativePath: 'rules/coding.md', absolutePath: '/home/user/.claude/rules/coding.md', content: '# Coding rules' },
        ],
        project: [
          { relativePath: 'settings.json', absolutePath: '/project/.claude/settings.json', content: '{"permissions":{}}' },
          { relativePath: 'CLAUDE.md', absolutePath: '/project/CLAUDE.md', content: '# Project instructions' },
        ],
        managed: [],
        local: [],
        plugin: [],
      },
    );

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/tree',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // fileTrees should be present
    expect(body.fileTrees).toBeDefined();

    // User scope tree should have nested structure
    expect(body.fileTrees.user).toBeDefined();
    expect(body.fileTrees.user.scope).toBe('user');
    expect(body.fileTrees.user.type).toBe('directory');

    // Project scope tree should exist
    expect(body.fileTrees.project).toBeDefined();
    expect(body.fileTrees.project.scope).toBe('project');

    // User tree should contain settings.json as a file child
    const userSettingsFile = body.fileTrees.user.children.find(
      (c: { name: string; type: string }) => c.name === 'settings.json' && c.type === 'file',
    );
    expect(userSettingsFile).toBeDefined();
    expect(userSettingsFile.node).toBeDefined();

    // User tree should contain rules directory
    const rulesDir = body.fileTrees.user.children.find(
      (c: { name: string; type: string }) => c.name === 'rules' && c.type === 'directory',
    );
    expect(rulesDir).toBeDefined();
    expect(rulesDir.children).toHaveLength(1);

    // Missing directories should be present with tooltips
    const missingAgents = body.fileTrees.user.children.find(
      (c: { name: string; type: string }) => c.name === 'agents' && c.type === 'missing',
    );
    expect(missingAgents).toBeDefined();
    expect(missingAgents.tooltip).toBeDefined();
  });

  it('handles malformed files in discovery without breaking the model', async () => {
    const fileReader = createFileReaderStub(
      {},
      {
        managed: [],
        user: [
          { relativePath: 'settings.json', absolutePath: '/home/user/.claude/settings.json', content: '{ broken json' },
        ],
        project: [
          { relativePath: 'CLAUDE.md', absolutePath: '/project/CLAUDE.md', content: '# Valid markdown' },
        ],
        local: [],
        plugin: [],
      },
    );

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/tree',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.model.totalFiles).toBe(2);

    // Malformed file should have error
    const errorNode = body.model.nodes.find(
      (n: { error: unknown }) => n.error !== null,
    );
    expect(errorNode).toBeDefined();

    // Valid file should be fine
    const validNode = body.model.nodes.find(
      (n: { error: unknown }) => n.error === null,
    );
    expect(validNode).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/config/cascade/:subsystem
// ---------------------------------------------------------------------------

describe('GET /api/config/cascade/:subsystem', () => {
  let storage: StoragePort;
  let app: ReturnType<typeof createApp>;

  afterEach(async () => {
    await app.close();
    storage.close();
  });

  it('returns PrecedenceChain for a valid settings subsystem', async () => {
    const fileReader = createFileReaderStub(
      {},
      {
        managed: [],
        user: [
          { relativePath: 'settings.json', absolutePath: '/home/user/.claude/settings.json', content: '{"theme":"dark"}' },
        ],
        project: [
          { relativePath: 'settings.json', absolutePath: '/project/.claude/settings.json', content: '{"permissions":{}}' },
        ],
        local: [],
        plugin: [],
      },
    );

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/cascade/settings',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.subsystem).toBe('settings');
    expect(body.resolutionType).toBe('override');
    expect(body.entries).toBeDefined();
    expect(body.entries).toHaveLength(5); // All 5 scope levels

    // Highest-priority scope with nodes should be active
    const activeEntries = body.entries.filter(
      (e: { status: string }) => e.status === 'active',
    );
    expect(activeEntries.length).toBeGreaterThan(0);
  });

  it('returns 400 for an invalid subsystem name', async () => {
    const fileReader = createFileReaderStub({}, {
      managed: [],
      user: [],
      project: [],
      local: [],
      plugin: [],
    });

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/cascade/nonexistent',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
  });

  it('shows correct override/active statuses for settings subsystem', async () => {
    // All scopes use non-permissions keys so override (not merge) logic applies
    const fileReader = createFileReaderStub(
      {},
      {
        managed: [
          { relativePath: 'settings.json', absolutePath: '/managed/settings.json', content: '{"managed":true}' },
        ],
        user: [
          { relativePath: 'settings.json', absolutePath: '/home/user/.claude/settings.json', content: '{"theme":"dark"}' },
        ],
        project: [
          { relativePath: 'settings.json', absolutePath: '/project/.claude/settings.json', content: '{"verbose":true}' },
        ],
        local: [],
        plugin: [],
      },
    );

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/cascade/settings',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // Managed scope has highest priority -- should be active
    const managedEntry = body.entries.find(
      (e: { scope: string }) => e.scope === 'managed',
    );
    expect(managedEntry.status).toBe('active');

    // User and project scopes should be overridden by managed
    const userEntry = body.entries.find(
      (e: { scope: string }) => e.scope === 'user',
    );
    expect(userEntry.status).toBe('overridden');
    expect(userEntry.overrideReason).toContain('managed');

    const projectEntry = body.entries.find(
      (e: { scope: string }) => e.scope === 'project',
    );
    expect(projectEntry.status).toBe('overridden');
    expect(projectEntry.overrideReason).toContain('managed');
  });

  it('shows all entries as active for memory subsystem (additive)', async () => {
    const fileReader = createFileReaderStub(
      {},
      {
        managed: [],
        user: [
          { relativePath: 'CLAUDE.md', absolutePath: '/home/user/.claude/CLAUDE.md', content: '# Global instructions' },
        ],
        project: [
          { relativePath: 'CLAUDE.md', absolutePath: '/project/CLAUDE.md', content: '# Project instructions' },
        ],
        local: [],
        plugin: [],
      },
    );

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/cascade/memory',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.subsystem).toBe('memory');
    expect(body.resolutionType).toBe('additive');

    // Memory is additive -- all scopes with content should be active
    const userEntry = body.entries.find(
      (e: { scope: string }) => e.scope === 'user',
    );
    expect(userEntry.status).toBe('active');

    const projectEntry = body.entries.find(
      (e: { scope: string }) => e.scope === 'project',
    );
    expect(projectEntry.status).toBe('active');

    // Scopes without content should be empty
    const managedEntry = body.entries.find(
      (e: { scope: string }) => e.scope === 'managed',
    );
    expect(managedEntry.status).toBe('empty');
  });

  it('covers all 8 subsystems', async () => {
    const fileReader = createFileReaderStub({}, {
      managed: [],
      user: [],
      project: [],
      local: [],
      plugin: [],
    });

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const subsystems = [
      'memory', 'settings', 'rules', 'skills',
      'agents', 'hooks', 'plugins', 'mcp',
    ];

    for (const subsystem of subsystems) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/config/cascade/${subsystem}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.subsystem).toBe(subsystem);
      expect(body.entries).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/config/test-path
// ---------------------------------------------------------------------------

describe('GET /api/config/test-path', () => {
  let storage: StoragePort;
  let app: ReturnType<typeof createApp>;

  afterEach(async () => {
    await app.close();
    storage.close();
  });

  it('returns path test results for rules with glob patterns', async () => {
    const ruleContent = '---\npaths:\n  - "src/api/**/*.ts"\n---\n# API rules';
    const fileReader = createFileReaderStub(
      {},
      {
        managed: [],
        user: [],
        project: [
          { relativePath: 'rules/api-rules.md', absolutePath: '/project/.claude/rules/api-rules.md', content: ruleContent },
        ],
        local: [],
        plugin: [],
      },
    );

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/test-path?path=src/api/foo.ts',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload);
    expect(body.testPath).toBe('src/api/foo.ts');
    expect(body.matches).toBeDefined();
    expect(body.nonMatches).toBeDefined();
    expect(body.unconditional).toBeDefined();
  });

  it('returns 400 when path parameter is missing', async () => {
    const fileReader = createFileReaderStub({}, {
      managed: [],
      user: [],
      project: [],
      local: [],
      plugin: [],
    });

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/test-path',
    });

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
  });

  it('returns 400 when path parameter is empty', async () => {
    const fileReader = createFileReaderStub({}, {
      managed: [],
      user: [],
      project: [],
      local: [],
      plugin: [],
    });

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/test-path?path=',
    });

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/config/search
// ---------------------------------------------------------------------------

describe('GET /api/config/search', () => {
  let storage: StoragePort;
  let app: ReturnType<typeof createApp>;

  afterEach(async () => {
    await app.close();
    storage.close();
  });

  it('returns search results matching the query across all scopes', async () => {
    const fileReader = createFileReaderStub(
      {},
      {
        managed: [],
        user: [
          { relativePath: 'settings.json', absolutePath: '/home/user/.claude/settings.json', content: '{"theme":"dark"}' },
        ],
        project: [
          { relativePath: 'CLAUDE.md', absolutePath: '/project/CLAUDE.md', content: '# Test instructions\nWrite tests first.' },
        ],
        local: [],
        plugin: [],
      },
    );

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/search?q=test',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    // Each result should have the expected shape
    const result = body[0];
    expect(result.node).toBeDefined();
    expect(result.matchingLine).toBeDefined();
    expect(result.lineNumber).toBeDefined();
    expect(result.context).toBeDefined();
  });

  it('returns 400 when query parameter is missing', async () => {
    const fileReader = createFileReaderStub({}, {
      managed: [],
      user: [],
      project: [],
      local: [],
      plugin: [],
    });

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/search',
    });

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
  });

  it('returns 400 when query parameter is empty', async () => {
    const fileReader = createFileReaderStub({}, {
      managed: [],
      user: [],
      project: [],
      local: [],
      plugin: [],
    });

    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage, { configFileReader: fileReader });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/search?q=',
    });

    expect(response.statusCode).toBe(400);

    const body = JSON.parse(response.payload);
    expect(body.error).toBeDefined();
  });
});

/**
 * Config query endpoints:
 *   GET /api/config/tree -- full config model with legacy tree nodes
 *   GET /api/config/cascade/:subsystem -- precedence waterfall for a subsystem
 *   GET /api/config/test-path?path= -- test which rules match a given file path
 *   GET /api/config/search?q= -- full-text search across all config files
 *
 * Reads configuration files from all 5 scopes via ConfigFileReaderPort,
 * assembles a full ConfigModel using the pure discovery function, and
 * returns results with scope/subsystem annotations.
 *
 * Missing files produce placeholder nodes. Malformed files produce error nodes.
 * No exceptions escape -- all errors are values.
 */

import * as os from 'os';
import * as path from 'path';
import type { FastifyInstance } from 'fastify';
import type {
  ConfigFileReaderPort,
  ScopeName,
  ConfigNode,
  ParsedContent,
  ConfigModel,
} from '@norbert/config-explorer';
import {
  classifyFile,
  parseJson,
  scopeFromName,
  assembleConfigModel,
  resolvePrecedence,
  buildFileTrees,
  testPath,
  searchConfig,
  ALL_SUBSYSTEMS,
} from '@norbert/config-explorer';
import type { DiscoveredFileEntry, SubsystemName, FileTree } from '@norbert/config-explorer';

// ---------------------------------------------------------------------------
// Legacy response shape (backward compatibility)
// ---------------------------------------------------------------------------

interface ConfigTreeNode {
  readonly id: string;
  readonly name: string;
  readonly scope: ScopeName;
  readonly scopeColor: string;
  readonly subsystem: string;
  readonly nodeType: string;
  readonly parsedContent: ParsedContent | null;
  readonly placeholder: boolean;
  readonly error: string | null;
}

interface ConfigTreeResponse {
  readonly nodes: readonly ConfigTreeNode[];
  readonly scopes: {
    readonly user: { readonly found: boolean };
    readonly project: { readonly found: boolean };
  };
  readonly model: ConfigModel;
  readonly fileTrees: Partial<Record<ScopeName, FileTree>>;
}

// ---------------------------------------------------------------------------
// Scope-keyed file paths (legacy: settings.json only per scope)
// ---------------------------------------------------------------------------

const SETTINGS_FILES: readonly { scope: ScopeName; key: string }[] = [
  { scope: 'user', key: 'user:settings.json' },
  { scope: 'project', key: 'project:settings.json' },
];

// ---------------------------------------------------------------------------
// Build a legacy tree node from file content or absence
// ---------------------------------------------------------------------------

const buildSettingsNode = (
  scope: ScopeName,
  content: string | null,
): ConfigTreeNode => {
  const scopeInfo = scopeFromName(scope);
  const classification = classifyFile('settings.json', scope);

  if (content === null) {
    return {
      id: `${scope}:settings.json`,
      name: 'settings.json',
      scope,
      scopeColor: scopeInfo.color,
      subsystem: classification.subsystem,
      nodeType: classification.nodeType,
      parsedContent: null,
      placeholder: true,
      error: null,
    };
  }

  const parsed = parseJson(content);
  const hasError = parsed.format === 'unparseable';

  return {
    id: `${scope}:settings.json`,
    name: 'settings.json',
    scope,
    scopeColor: scopeInfo.color,
    subsystem: classification.subsystem,
    nodeType: classification.nodeType,
    parsedContent: parsed,
    placeholder: false,
    error: hasError ? (parsed as { error: string }).error : null,
  };
};

// ---------------------------------------------------------------------------
// Scope base path resolution
// ---------------------------------------------------------------------------

const getScopeBasePaths = (projectRoot: string): Record<ScopeName, string> => ({
  managed: '', // managed uses platform-specific absolute paths
  user: path.join(os.homedir(), '.claude'),
  project: path.join(projectRoot, '.claude'),
  local: path.join(projectRoot, '.claude'),
  plugin: path.join(os.homedir(), '.claude', 'plugins', 'cache'),
});

// ---------------------------------------------------------------------------
// Full discovery across all scopes
// ---------------------------------------------------------------------------

const discoverAllScopes = async (
  fileReader: ConfigFileReaderPort,
  projectRoot: string,
): Promise<ConfigModel> => {
  const basePaths = getScopeBasePaths(projectRoot);
  const scopesToScan: ScopeName[] = ['managed', 'user', 'project', 'local', 'plugin'];

  const allEntries: DiscoveredFileEntry[] = [];

  for (const scope of scopesToScan) {
    const scannedFiles = await fileReader.scanScope(basePaths[scope], scope);

    for (const scanned of scannedFiles) {
      allEntries.push({
        path: scanned.relativePath,
        content: scanned.content,
        scope,
      });
    }
  }

  return assembleConfigModel(allEntries);
};

// ---------------------------------------------------------------------------
// Subsystem validation
// ---------------------------------------------------------------------------

const VALID_SUBSYSTEM_NAMES: ReadonlySet<string> = new Set(
  ALL_SUBSYSTEMS.map((s) => s.subsystem),
);

const isValidSubsystemName = (name: string): name is SubsystemName =>
  VALID_SUBSYSTEM_NAMES.has(name);

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export const registerConfigRoutes = (
  app: FastifyInstance,
  fileReader: ConfigFileReaderPort,
  projectRoot: string = process.cwd(),
): void => {
  app.get('/api/config/tree', async (_request, reply) => {
    // Legacy: read settings.json from user and project scopes
    const nodeResults = await Promise.all(
      SETTINGS_FILES.map(async ({ scope, key }) => {
        const content = await fileReader.readFile(key);
        return buildSettingsNode(scope, content);
      }),
    );

    // Full discovery: scan all 5 scopes
    const model = await discoverAllScopes(fileReader, projectRoot);

    // Build nested file trees for Atlas view
    const fileTrees = buildFileTrees(model.nodes);

    const response: ConfigTreeResponse = {
      nodes: nodeResults,
      scopes: {
        user: { found: nodeResults.some((n) => n.scope === 'user' && !n.placeholder) },
        project: { found: nodeResults.some((n) => n.scope === 'project' && !n.placeholder) },
      },
      model,
      fileTrees,
    };

    return reply.status(200).send(response);
  });

  // -----------------------------------------------------------------------
  // GET /api/config/cascade/:subsystem
  // -----------------------------------------------------------------------

  app.get<{ Params: { subsystem: string } }>(
    '/api/config/cascade/:subsystem',
    async (request, reply) => {
      const { subsystem } = request.params;

      if (!isValidSubsystemName(subsystem)) {
        return reply.status(400).send({
          error: `Invalid subsystem: '${subsystem}'. Valid values: ${[...VALID_SUBSYSTEM_NAMES].join(', ')}`,
        });
      }

      const model = await discoverAllScopes(fileReader, projectRoot);
      const chain = resolvePrecedence(model.nodes, subsystem);

      return reply.status(200).send(chain);
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/config/test-path?path=<filePath>
  // -----------------------------------------------------------------------

  app.get<{ Querystring: { path?: string } }>(
    '/api/config/test-path',
    async (request, reply) => {
      const filePath = request.query.path;

      if (!filePath || filePath.trim() === '') {
        return reply.status(400).send({
          error: 'Missing required query parameter: path',
        });
      }

      const model = await discoverAllScopes(fileReader, projectRoot);
      const result = testPath(model.nodes, filePath);

      return reply.status(200).send(result);
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/config/search?q=<query>
  // -----------------------------------------------------------------------

  app.get<{ Querystring: { q?: string } }>(
    '/api/config/search',
    async (request, reply) => {
      const query = request.query.q;

      if (!query || query.trim() === '') {
        return reply.status(400).send({
          error: 'Missing required query parameter: q',
        });
      }

      const model = await discoverAllScopes(fileReader, projectRoot);
      const results = searchConfig(model.nodes, query);

      return reply.status(200).send(results);
    },
  );
};

/**
 * @norbert/cli -- Commander.js command-line interface.
 *
 * Depends on: @norbert/core, @norbert/config, @norbert/storage, @norbert/hooks
 * Exports: CLI program factory and init command handler.
 */

import { Command } from 'commander';
import { runInit, type InitOptions } from './commands/init.js';
import { formatStatusOutput, gatherStatusData, type StatusDeps } from './commands/status.js';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { DEFAULT_CONFIG } from '@norbert/config';
import http from 'http';

// ---------------------------------------------------------------------------
// Health check utility (side-effect at boundary)
// ---------------------------------------------------------------------------

const checkServerHealth = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });

// ---------------------------------------------------------------------------
// CLI program factory
// ---------------------------------------------------------------------------

export const createProgram = (): Command => {
  const program = new Command();

  program
    .name('norbert')
    .description('The Agentic Workflow Observatory for Claude Code')
    .version('0.1.0');

  program
    .command('init')
    .description('Install Norbert hook scripts into .claude/settings.json')
    .option('-p, --port <number>', 'Server port', '7777')
    .option('--settings <path>', 'Path to settings.json')
    .action((options) => {
      const initOptions: InitOptions = {
        port: parseInt(options.port, 10),
        settingsPath: options.settings,
      };

      const result = runInit(initOptions);

      if (result.ok) {
        console.log('Norbert hooks installed successfully.');
      } else {
        console.error(`Failed to install hooks: ${result.error}`);
        process.exit(1);
      }
    });

  program
    .command('status')
    .description('Show server state, event count, MCP servers seen')
    .option('-p, --port <number>', 'Server port', '7777')
    .option('--db <path>', 'Path to database file')
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const dbPath = options.db ?? DEFAULT_CONFIG.dbPath;

      let storage: StoragePort | null = null;
      try {
        storage = createSqliteAdapter(dbPath);

        const deps: StatusDeps = {
          getEventCount: storage.getEventCount,
          getSessionCount: storage.getSessionCount,
          getMcpServerNames: storage.getMcpServerNames,
          checkServerHealth,
        };

        const statusData = await gatherStatusData(deps, port);
        console.log(formatStatusOutput(statusData));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to get status: ${message}`);
        process.exit(1);
      } finally {
        storage?.close();
      }
    });

  program
    .command('serve')
    .description('Start the Norbert server')
    .option('-p, --port <number>', 'Server port', '7777')
    .option('--db <path>', 'Path to database file')
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const dbPath = options.db ?? DEFAULT_CONFIG.dbPath;

      try {
        const { createApp, createConfigFileReader } = await import('@norbert/server');
        const storage = createSqliteAdapter(dbPath);
        const configFileReader = createConfigFileReader();
        const app = createApp({ port }, storage, { configFileReader });

        await app.listen({ port, host: '0.0.0.0' });
        console.log(`Norbert server listening on http://localhost:${port}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to start server: ${message}`);
        process.exit(1);
      }
    });

  return program;
};

// Re-export init for programmatic use
export { runInit } from './commands/init.js';
export type { InitOptions } from './commands/init.js';

// Re-export status for programmatic use
export { formatStatusOutput, gatherStatusData } from './commands/status.js';
export type { StatusData, StatusDeps } from './commands/status.js';

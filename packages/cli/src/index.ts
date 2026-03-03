/**
 * @norbert/cli -- Commander.js command-line interface.
 *
 * Depends on: @norbert/core, @norbert/config, @norbert/storage, @norbert/hooks
 * Exports: CLI program factory and init command handler.
 */

import { Command } from 'commander';
import { runInit, type InitOptions } from './commands/init.js';

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

  return program;
};

// Re-export init for programmatic use
export { runInit } from './commands/init.js';
export type { InitOptions } from './commands/init.js';

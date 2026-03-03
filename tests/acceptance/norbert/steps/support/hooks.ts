/**
 * Cucumber Before/After hooks for Norbert acceptance tests.
 *
 * Manages the lifecycle of the Norbert server and test database
 * for each scenario. Each scenario gets an isolated environment:
 *   - Fresh SQLite database in a temp directory
 *   - Norbert server on an available test port
 *   - Cleanup after scenario completes
 *
 * All setup and teardown uses the CLI driving port (norbert serve,
 * norbert stop) -- not internal module imports.
 */

import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { NorbertWorld } from './world';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Global: Verify Norbert is installed
// ---------------------------------------------------------------------------

BeforeAll(async function () {
  const { execSync } = await import('child_process');
  try {
    execSync('norbert --version', { encoding: 'utf-8', timeout: 10_000 });
  } catch {
    throw new Error(
      'Norbert CLI not found. Install with: npm install -g norbert\n' +
        'Or link the local build: pnpm -r run build && npm link packages/cli'
    );
  }
});

// ---------------------------------------------------------------------------
// Per-Scenario: Isolated test environment
// ---------------------------------------------------------------------------

let testPortCounter = 18900;

Before(async function (this: NorbertWorld) {
  // Create isolated temp directory for this scenario
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'norbert-test-'));
  this.testDbPath = path.join(tmpDir, 'norbert-test.db');
  this.testConfigPath = path.join(tmpDir, 'config.json');

  // Assign unique port to avoid conflicts between parallel scenarios
  const port = testPortCounter++;
  this.server = {
    port,
    baseUrl: `http://localhost:${port}`,
  };

  // Write test configuration
  const config = {
    port,
    dbPath: this.testDbPath,
    retentionDays: 30,
  };
  fs.writeFileSync(this.testConfigPath, JSON.stringify(config, null, 2));
});

Before({ tags: '@walking_skeleton or @US-001' }, async function (this: NorbertWorld) {
  // Walking skeleton and US-001 scenarios start the server themselves
  // via the CLI driving port as part of the test flow.
  // No auto-start needed.
});

Before({ tags: 'not @walking_skeleton and not @US-001 and not @infrastructure' }, async function (this: NorbertWorld) {
  // All other feature scenarios need a running server with the test database.
  // Start via CLI driving port.
  try {
    await this.runCli(`serve --background --port ${this.server!.port} --db ${this.testDbPath}`);

    // Wait for server to become healthy
    let healthy = false;
    for (let i = 0; i < 20; i++) {
      healthy = await this.healthCheck();
      if (healthy) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!healthy) {
      console.warn(`Server on port ${this.server!.port} did not become healthy in time.`);
    }
  } catch (err) {
    console.warn(`Failed to auto-start server for scenario: ${err}`);
  }
});

// ---------------------------------------------------------------------------
// Per-Scenario: Cleanup
// ---------------------------------------------------------------------------

After(async function (this: NorbertWorld) {
  // Stop the server if running
  if (this.server) {
    try {
      await this.runCli(`stop --port ${this.server.port}`);
    } catch {
      // Server may already be stopped; ignore
    }
  }

  // Clean up temp directory
  if (this.testDbPath) {
    const tmpDir = path.dirname(this.testDbPath);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }

  // Reset state
  this.server = null;
  this.testDbPath = null;
  this.testConfigPath = null;
  this.lastCliOutput = null;
  this.lastApiResponse = null;
  this.lastApiStatus = null;
  this.lastDashboardPage = null;
  this.seededEvents = [];
  this.seededSessions = [];
  this.timerStart = null;
  this.timerEnd = null;
});

// ---------------------------------------------------------------------------
// Global: Final cleanup
// ---------------------------------------------------------------------------

AfterAll(async function () {
  // Any global teardown can go here
});

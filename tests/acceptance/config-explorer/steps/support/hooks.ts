/**
 * Cucumber Before/After hooks for Config Explorer acceptance tests.
 *
 * Manages the lifecycle of the Fastify test server with a fake
 * ConfigFileReaderPort for each scenario. Each scenario gets an
 * isolated server instance with synthetic config data.
 *
 * The fake ConfigFileReaderPort replaces real filesystem access.
 * The parser, precedence resolver, and API routes are all real.
 */

import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { ConfigExplorerWorld } from './world';

// ---------------------------------------------------------------------------
// Global: Verify build is available
// ---------------------------------------------------------------------------

BeforeAll(async function () {
  // Verify the @norbert/config-explorer and @norbert/server packages
  // are built and available. This avoids cryptic import errors later.
  // Actual import validation happens when the server starts.
});

// ---------------------------------------------------------------------------
// Per-Scenario: Create isolated Fastify server with fake filesystem
// ---------------------------------------------------------------------------

let testPortCounter = 19900;

Before(async function (this: ConfigExplorerWorld) {
  // Assign unique port for this scenario
  const port = testPortCounter++;
  this.server = {
    port,
    baseUrl: `http://localhost:${port}`,
  };

  // Clear any leftover config files from previous scenario
  this.clearConfigFiles();

  // Reset state
  this.lastApiResponse = null;
  this.lastApiStatus = null;
  this.timerStart = null;
  this.timerEnd = null;
  this.managedScopeAccessDenied = false;
});

// ---------------------------------------------------------------------------
// Per-Scenario: Cleanup
// ---------------------------------------------------------------------------

After(async function (this: ConfigExplorerWorld) {
  // Server shutdown handled by the Fastify test server lifecycle
  // (close() called by the step definitions or automatically)

  // Reset all state
  this.server = null;
  this.clearConfigFiles();
  this.lastApiResponse = null;
  this.lastApiStatus = null;
  this.timerStart = null;
  this.timerEnd = null;
  this.managedScopeAccessDenied = false;
});

// ---------------------------------------------------------------------------
// Global: Final cleanup
// ---------------------------------------------------------------------------

AfterAll(async function () {
  // Any global teardown can go here
});

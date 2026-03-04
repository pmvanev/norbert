/**
 * Cucumber World -- Test fixture context for Config Explorer acceptance tests.
 *
 * The World object is the shared state container for each scenario.
 * It provides access to Config Explorer's driving port:
 *   - HTTP API (Fastify server serving /api/config/* endpoints)
 *
 * Design: Step definitions delegate to this World which invokes the
 * driving port (Fastify API). A fake ConfigFileReaderPort replaces
 * real filesystem access. The parser, precedence resolver, and API
 * routes are all real -- only the filesystem boundary is faked.
 *
 * No internal @norbert/config-explorer modules are imported here.
 * All interaction is through the public HTTP API endpoints.
 */

import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfigFile {
  path: string;
  content: string;
  scope: 'user' | 'project' | 'local' | 'plugin' | 'managed';
}

export interface ConfigApiResponse {
  status: number;
  body: unknown;
}

export interface ServerInfo {
  port: number;
  baseUrl: string;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export class ConfigExplorerWorld extends World {
  // Server state
  public server: ServerInfo | null = null;

  // Fake filesystem -- synthetic config files injected via ConfigFileReaderPort
  public configFiles: ConfigFile[] = [];

  // Scenario state -- populated by Given/When steps, asserted in Then steps
  public lastApiResponse: unknown = null;
  public lastApiStatus: number | null = null;

  // Timestamps for performance assertions
  public timerStart: number | null = null;
  public timerEnd: number | null = null;

  // Error simulation flags
  public managedScopeAccessDenied = false;

  constructor(options: IWorldOptions) {
    super(options);
  }

  // -------------------------------------------------------------------------
  // Fake Config File Reader -- Injected via port
  // -------------------------------------------------------------------------

  /**
   * Add a synthetic config file to the fake filesystem.
   * These files are served to the real parser via the ConfigFileReaderPort.
   */
  addConfigFile(file: ConfigFile): void {
    this.configFiles.push(file);
  }

  /**
   * Clear all synthetic config files.
   */
  clearConfigFiles(): void {
    this.configFiles = [];
  }

  // -------------------------------------------------------------------------
  // Driving Port: HTTP API
  // -------------------------------------------------------------------------

  /**
   * Fetch the full config model via GET /api/config.
   */
  async getConfigModel(): Promise<ConfigApiResponse> {
    return this.getApi('/api/config');
  }

  /**
   * Fetch the file tree via GET /api/config/tree.
   */
  async getConfigTree(): Promise<ConfigApiResponse> {
    return this.getApi('/api/config/tree');
  }

  /**
   * Fetch precedence chain for a subsystem via GET /api/config/precedence/:subsystem.
   */
  async getConfigPrecedence(subsystem: string): Promise<ConfigApiResponse> {
    return this.getApi(`/api/config/precedence/${subsystem}`);
  }

  /**
   * Test a file path against rules via GET /api/config/test-path?path=.
   */
  async testPath(filePath: string): Promise<ConfigApiResponse> {
    return this.getApi(`/api/config/test-path?path=${encodeURIComponent(filePath)}`);
  }

  /**
   * Search config files via GET /api/config/search?q=.
   */
  async searchConfig(query: string): Promise<ConfigApiResponse> {
    return this.getApi(`/api/config/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Fetch data from any Config Explorer API endpoint.
   */
  async getApi(path: string): Promise<ConfigApiResponse> {
    const url = `${this.getBaseUrl()}${path}`;
    const response = await fetch(url);
    const body = await response.json().catch(() => null);
    this.lastApiStatus = response.status;
    this.lastApiResponse = body;
    return { status: response.status, body };
  }

  /**
   * Check server health.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { status } = await this.getApi('/health');
      return status === 200;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  getBaseUrl(): string {
    if (!this.server) {
      throw new Error('Server not started. Call a Given step that starts the server first.');
    }
    return this.server.baseUrl;
  }

  startTimer(): void {
    this.timerStart = Date.now();
  }

  stopTimer(): number {
    this.timerEnd = Date.now();
    return this.timerEnd - (this.timerStart ?? this.timerEnd);
  }
}

setWorldConstructor(ConfigExplorerWorld);

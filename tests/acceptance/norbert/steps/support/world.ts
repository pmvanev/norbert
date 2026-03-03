/**
 * Cucumber World -- Test fixture context for Norbert acceptance tests.
 *
 * The World object is the shared state container for each scenario.
 * It provides access to Norbert's driving ports:
 *   - HTTP API (server ingress + dashboard API)
 *   - CLI commands (norbert init, status, cost, trace, mcp, session)
 *
 * Design: Step definitions delegate to this World which in turn invokes
 * driving ports. No internal Norbert modules are imported here -- all
 * interaction is through the public HTTP API and CLI entry points.
 */

import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NorbertServerInfo {
  port: number;
  baseUrl: string;
  pid?: number;
}

export interface CapturedEvent {
  event_type: string;
  session_id: string;
  timestamp: string;
  tool_name?: string;
  mcp_server?: string | null;
  mcp_tool_name?: string | null;
  agent_id?: string | null;
  parent_agent_id?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  model?: string | null;
}

export interface SessionSummary {
  id: string;
  start_time: string;
  end_time?: string;
  agent_count: number;
  event_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost: number;
  mcp_error_count: number;
  status: string;
}

export interface CliOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DashboardPage {
  title: string;
  content: Record<string, unknown>;
  loadTimeMs: number;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export class NorbertWorld extends World {
  // Server state
  public server: NorbertServerInfo | null = null;
  public testDbPath: string | null = null;
  public testConfigPath: string | null = null;

  // Scenario state -- populated by Given/When steps, asserted in Then steps
  public lastCliOutput: CliOutput | null = null;
  public lastApiResponse: unknown = null;
  public lastApiStatus: number | null = null;
  public lastDashboardPage: DashboardPage | null = null;

  // Test data
  public seededEvents: CapturedEvent[] = [];
  public seededSessions: SessionSummary[] = [];

  // Timestamps for performance assertions
  public timerStart: number | null = null;
  public timerEnd: number | null = null;

  constructor(options: IWorldOptions) {
    super(options);
  }

  // -------------------------------------------------------------------------
  // Driving Port: HTTP API
  // -------------------------------------------------------------------------

  /**
   * Post a hook event to the server event ingress endpoint.
   * This is the primary driving port for event capture testing.
   */
  async postEvent(event: CapturedEvent): Promise<{ status: number; body: unknown }> {
    const url = `${this.getBaseUrl()}/api/events`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    const body = await response.json().catch(() => null);
    this.lastApiStatus = response.status;
    this.lastApiResponse = body;
    return { status: response.status, body };
  }

  /**
   * Fetch data from any dashboard API endpoint.
   */
  async getApi(path: string): Promise<{ status: number; body: unknown }> {
    const url = `${this.getBaseUrl()}${path}`;
    const start = Date.now();
    const response = await fetch(url);
    const loadTime = Date.now() - start;
    const body = await response.json().catch(() => null);
    this.lastApiStatus = response.status;
    this.lastApiResponse = body;
    this.lastDashboardPage = {
      title: path,
      content: body as Record<string, unknown>,
      loadTimeMs: loadTime,
    };
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
  // Driving Port: CLI
  // -------------------------------------------------------------------------

  /**
   * Execute a Norbert CLI command and capture output.
   * The CLI is a driving port -- we invoke it as an external process.
   */
  async runCli(args: string): Promise<CliOutput> {
    const { execSync } = await import('child_process');
    const portArg = this.server ? `--port ${this.server.port}` : '';
    const dbArg = this.testDbPath ? `--db ${this.testDbPath}` : '';
    const cmd = `norbert ${args} ${portArg} ${dbArg}`.trim();

    try {
      const stdout = execSync(cmd, {
        encoding: 'utf-8',
        timeout: 30_000,
        env: { ...process.env, NO_COLOR: '1' },
      });
      this.lastCliOutput = { stdout, stderr: '', exitCode: 0 };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; status?: number };
      this.lastCliOutput = {
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? '',
        exitCode: error.status ?? 1,
      };
    }
    return this.lastCliOutput;
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

  /**
   * Seed test events by posting them through the event ingress port.
   * This uses the real driving port, not direct database access.
   */
  async seedEvents(events: CapturedEvent[]): Promise<void> {
    for (const event of events) {
      await this.postEvent(event);
      this.seededEvents.push(event);
    }
  }
}

setWorldConstructor(NorbertWorld);

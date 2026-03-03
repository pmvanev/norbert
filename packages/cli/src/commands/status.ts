/**
 * norbert status command -- displays server state, event count, MCP servers.
 *
 * Pure formatting function (formatStatusOutput) is separated from
 * the side-effectful data gathering (gatherStatusData).
 */

// ---------------------------------------------------------------------------
// Status data type
// ---------------------------------------------------------------------------

export interface StatusData {
  readonly serverReachable: boolean;
  readonly eventCount: number;
  readonly sessionCount: number;
  readonly mcpServers: readonly string[];
}

// ---------------------------------------------------------------------------
// Pure formatting function
// ---------------------------------------------------------------------------

export const formatStatusOutput = (data: StatusData): string => {
  const serverLine = `Server: ${data.serverReachable ? 'running' : 'not running'}`;
  const eventsLine = `Events: ${data.eventCount}`;
  const sessionsLine = `Sessions: ${data.sessionCount}`;
  const mcpLine = `MCP servers: ${data.mcpServers.length > 0 ? data.mcpServers.join(', ') : 'none'}`;

  return [serverLine, eventsLine, sessionsLine, mcpLine].join('\n');
};

// ---------------------------------------------------------------------------
// Status data gathering (side-effectful)
// ---------------------------------------------------------------------------

export interface StatusDeps {
  readonly getEventCount: () => number;
  readonly getSessionCount: () => number;
  readonly getMcpServerNames: () => readonly string[];
  readonly checkServerHealth: (port: number) => Promise<boolean>;
}

export const gatherStatusData = async (
  deps: StatusDeps,
  port: number
): Promise<StatusData> => {
  const serverReachable = await deps.checkServerHealth(port);
  const eventCount = deps.getEventCount();
  const sessionCount = deps.getSessionCount();
  const mcpServers = deps.getMcpServerNames();

  return { serverReachable, eventCount, sessionCount, mcpServers };
};

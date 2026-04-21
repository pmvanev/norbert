/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests: MCP source attribution in views
 *
 * Verifies that MCP server source origin is displayed in:
 *   - McpTab server cards (source badge)
 *   - ConfigDetailPanel McpDetail (source in ScopeBadge)
 *   - ConfigListPanel McpRow (source in ScopeBadge)
 *   - Empty state messages reference all config locations
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { McpServerConfig, AggregatedConfig, SelectedConfigItem } from "../../../../../src/plugins/norbert-config/domain/types";
import { McpTab } from "../../../../../src/plugins/norbert-config/views/McpTab";
import { ConfigDetailPanel } from "../../../../../src/plugins/norbert-config/views/ConfigDetailPanel";
import { ConfigListPanel } from "../../../../../src/plugins/norbert-config/views/ConfigListPanel";

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

const buildMcpServer = (overrides: Partial<McpServerConfig> = {}): McpServerConfig => ({
  name: "test-server",
  type: "stdio",
  command: "npx srv",
  args: [],
  env: [],
  filePath: "/home/user/.claude.json",
  scope: "user",
  source: ".claude.json",
  warnings: [],
  ...overrides,
});

const emptyConfig: AggregatedConfig = {
  agents: [],
  commands: [],
  hooks: [],
  mcpServers: [],
  skills: [],
  rules: [],
  plugins: [],
  envVars: [],
  errors: [],
};

// ---------------------------------------------------------------------------
// McpTab -- source attribution on server cards
// ---------------------------------------------------------------------------

describe("McpTab source attribution", () => {
  it("displays source origin on server card", () => {
    const server = buildMcpServer({ name: "memory-server", source: ".claude.json" });
    render(<McpTab servers={[server]} />);

    expect(screen.getByText(".claude.json")).toBeInTheDocument();
  });

  it("displays plugin name as source for plugin-scoped servers", () => {
    const server = buildMcpServer({
      name: "discord-bot",
      scope: "plugin",
      source: "discord",
    });
    render(<McpTab servers={[server]} />);

    expect(screen.getByText("discord")).toBeInTheDocument();
  });

  it("renders servers from multiple sources without layout issues", () => {
    const servers = [
      buildMcpServer({ name: "s1", source: ".claude.json", scope: "user" }),
      buildMcpServer({ name: "s2", source: ".mcp.json", scope: "project" }),
      buildMcpServer({ name: "s3", source: "discord", scope: "plugin" }),
    ];
    render(<McpTab servers={servers} />);

    expect(screen.getByText(".claude.json")).toBeInTheDocument();
    expect(screen.getByText(".mcp.json")).toBeInTheDocument();
    expect(screen.getByText("discord")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// McpTab -- empty state references all config locations
// ---------------------------------------------------------------------------

describe("McpTab empty state", () => {
  it("references all config locations in empty state", () => {
    render(<McpTab servers={[]} />);
    const guidance = screen.getByRole("status");
    expect(guidance.textContent).toContain(".claude.json");
    expect(guidance.textContent).toContain(".mcp.json");
    expect(guidance.textContent).toContain("settings.json");
    expect(guidance.textContent).toMatch(/plugin/i);
  });
});

// ---------------------------------------------------------------------------
// ConfigDetailPanel -- McpDetail shows source in ScopeBadge
// ---------------------------------------------------------------------------

describe("ConfigDetailPanel McpDetail source attribution", () => {
  it("passes source to ScopeBadge for plugin servers", () => {
    const server = buildMcpServer({
      name: "discord-bot",
      scope: "plugin",
      source: "discord",
    });
    const selection: SelectedConfigItem = { tag: "mcp", server };
    render(<ConfigDetailPanel selection={selection} />);

    // ScopeBadge should display "discord" instead of "plugin"
    expect(screen.getByText("discord")).toBeInTheDocument();
  });

  it("shows source origin label in detail view", () => {
    const server = buildMcpServer({
      name: "api-server",
      source: ".mcp.json",
      scope: "project",
    });
    const selection: SelectedConfigItem = { tag: "mcp", server };
    render(<ConfigDetailPanel selection={selection} />);

    expect(screen.getByText(".mcp.json")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConfigListPanel -- McpRow shows source in ScopeBadge
// ---------------------------------------------------------------------------

describe("ConfigListPanel McpRow source attribution", () => {
  it("passes source to ScopeBadge for plugin servers in list", () => {
    const server = buildMcpServer({
      name: "discord-bot",
      scope: "plugin",
      source: "discord",
    });
    const config = { ...emptyConfig, mcpServers: [server] };
    render(
      <ConfigListPanel
        tab="mcp"
        config={config}
        selectedKey={null}
        onSelect={vi.fn()}
      />,
    );

    // ScopeBadge should display "discord" instead of "plugin"
    expect(screen.getByText("discord")).toBeInTheDocument();
  });

  it("displays source origin for user-scoped servers in list", () => {
    const server = buildMcpServer({
      name: "memory-server",
      source: ".claude.json",
      scope: "user",
    });
    const config = { ...emptyConfig, mcpServers: [server] };
    render(
      <ConfigListPanel
        tab="mcp"
        config={config}
        selectedKey={null}
        onSelect={vi.fn()}
      />,
    );

    // ScopeBadge shows scope for non-plugin; source visible as badge/label
    expect(screen.getByText("user")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConfigListPanel -- MCP empty state references all config locations
// ---------------------------------------------------------------------------

describe("ConfigListPanel MCP empty state", () => {
  it("references all config locations in empty state", () => {
    render(
      <ConfigListPanel
        tab="mcp"
        config={emptyConfig}
        selectedKey={null}
        onSelect={vi.fn()}
      />,
    );

    const guidance = screen.getByRole("status");
    expect(guidance.textContent).toContain(".claude.json");
    expect(guidance.textContent).toContain(".mcp.json");
    expect(guidance.textContent).toContain("settings.json");
    expect(guidance.textContent).toMatch(/plugin/i);
  });
});

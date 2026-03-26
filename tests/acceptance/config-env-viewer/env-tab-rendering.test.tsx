/**
 * Acceptance tests: Env Tab Rendering (config-env-viewer, step 02-01)
 *
 * Validates that the Environment tab is registered in sub-tab navigation,
 * env vars render as a sorted list with count and scope, empty state
 * shows guidance, and clicking an env var opens the detail panel.
 *
 * Behaviors: 5 (tab registration, sorted list, header badge, empty state, detail)
 * Test budget: max 10 tests
 */

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, within, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { ConfigListPanel } from "../../../src/plugins/norbert-config/views/ConfigListPanel";
import { ConfigDetailPanel } from "../../../src/plugins/norbert-config/views/ConfigDetailPanel";
import type { AggregatedConfig, EnvVarEntry, SelectedConfigItem } from "../../../src/plugins/norbert-config/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyConfig: AggregatedConfig = {
  agents: [],
  commands: [],
  hooks: [],
  mcpServers: [],
  skills: [],
  rules: [],
  plugins: [],
  envVars: [],
  docs: [],
  errors: [],
};

const makeEnvVar = (key: string, value: string, scope: "user" | "project" = "user"): EnvVarEntry => ({
  key,
  value,
  scope,
  source: scope === "user" ? "~/.claude/settings.json" : ".claude/settings.json",
  filePath: scope === "user" ? "~/.claude/settings.json" : ".claude/settings.json",
});

const configWithEnvVars = (envVars: readonly EnvVarEntry[]): AggregatedConfig => ({
  ...emptyConfig,
  envVars,
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// AC1: Tab registration -- labels and icons
// ---------------------------------------------------------------------------

describe("Environment tab registration", () => {
  it("SUB_TAB_LABELS includes 'Environment' for env tab", async () => {
    const { SUB_TAB_LABELS } = await import(
      "../../../src/plugins/norbert-config/views/ConfigViewerView"
    ) as { SUB_TAB_LABELS: Record<string, string> };

    expect(SUB_TAB_LABELS).toHaveProperty("env");
    expect(SUB_TAB_LABELS.env).toBe("Environment");
  });

  it("SUB_TAB_ICONS includes an icon for env tab", async () => {
    const { SUB_TAB_ICONS } = await import(
      "../../../src/plugins/norbert-config/views/ConfigViewerView"
    ) as { SUB_TAB_ICONS: Record<string, string> };

    expect(SUB_TAB_ICONS).toHaveProperty("env");
    expect(typeof SUB_TAB_ICONS.env).toBe("string");
    expect(SUB_TAB_ICONS.env.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC2: Sorted list rendering
// ---------------------------------------------------------------------------

describe("Environment list panel renders sorted env vars", () => {
  it("displays env vars sorted alphabetically by key", () => {
    const envVars = [
      makeEnvVar("OTEL_SERVICE_NAME", "norbert"),
      makeEnvVar("CUSTOM_LOG_LEVEL", "info"),
      makeEnvVar("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318"),
    ];

    const onSelect = vi.fn();
    render(
      <ConfigListPanel
        tab="env"
        config={configWithEnvVars(envVars)}
        selectedKey={null}
        onSelect={onSelect}
      />,
    );

    const listbox = screen.getByRole("listbox", { name: /environment/i });
    const buttons = within(listbox).getAllByRole("button");

    expect(buttons).toHaveLength(3);

    // Sorted alphabetically: CUSTOM, OTEL_EXPORTER, OTEL_SERVICE
    expect(buttons[0]).toHaveTextContent("CUSTOM_LOG_LEVEL");
    expect(buttons[1]).toHaveTextContent("OTEL_EXPORTER_OTLP_ENDPOINT");
    expect(buttons[2]).toHaveTextContent("OTEL_SERVICE_NAME");
  });
});

// ---------------------------------------------------------------------------
// AC3: Header with count badge and scope tag
// ---------------------------------------------------------------------------

describe("Environment list header shows count and scope", () => {
  it("renders scope badge on each env var row", () => {
    const envVars = [
      makeEnvVar("MY_VAR", "val", "user"),
      makeEnvVar("PROJ_VAR", "val", "project"),
    ];

    render(
      <ConfigListPanel
        tab="env"
        config={configWithEnvVars(envVars)}
        selectedKey={null}
        onSelect={vi.fn()}
      />,
    );

    const badges = screen.getAllByText(/^(user|project)$/);
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// AC4: Empty state with guidance
// ---------------------------------------------------------------------------

describe("Environment empty state", () => {
  it("shows guidance when no env vars configured", () => {
    render(
      <ConfigListPanel
        tab="env"
        config={emptyConfig}
        selectedKey={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Run \/norbert:setup/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC5: Clicking env var opens detail panel
// ---------------------------------------------------------------------------

describe("Environment detail panel", () => {
  it("calls onSelect with env tag when env var row is clicked", () => {
    const envVars = [makeEnvVar("MY_KEY", "my_value")];
    const onSelect = vi.fn();

    render(
      <ConfigListPanel
        tab="env"
        config={configWithEnvVars(envVars)}
        selectedKey={null}
        onSelect={onSelect}
      />,
    );

    const button = screen.getByRole("button", { name: /MY_KEY/ });
    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const [item] = onSelect.mock.calls[0];
    expect(item.tag).toBe("env");
    expect(item.envVar.key).toBe("MY_KEY");
  });

  it("switching selection updates detail to the newly selected variable", () => {
    const envVarA = makeEnvVar("OTEL_EXPORTER_OTLP_ENDPOINT", "http://127.0.0.1:3748", "user");
    const envVarB = makeEnvVar("CLAUDE_CODE_ENABLE_TELEMETRY", "1", "user");

    // First selection: OTEL_EXPORTER_OTLP_ENDPOINT
    const { rerender } = render(<ConfigDetailPanel selection={{ tag: "env", envVar: envVarA }} />);
    expect(screen.getByText("OTEL_EXPORTER_OTLP_ENDPOINT")).toBeInTheDocument();

    // Switch to: CLAUDE_CODE_ENABLE_TELEMETRY — title updates
    rerender(<ConfigDetailPanel selection={{ tag: "env", envVar: envVarB }} />);
    expect(screen.getByText("CLAUDE_CODE_ENABLE_TELEMETRY")).toBeInTheDocument();
  });

  it("short boolean-like value displayed with full detail context", () => {
    const envVar = makeEnvVar("CLAUDE_CODE_ENABLE_TELEMETRY", "1", "user");
    render(<ConfigDetailPanel selection={{ tag: "env", envVar }} />);

    // Value is masked by default — reveal it
    fireEvent.click(screen.getByLabelText(/Reveal value for CLAUDE_CODE_ENABLE_TELEMETRY/));
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
    expect(screen.getByText("CLAUDE_CODE_ENABLE_TELEMETRY")).toBeInTheDocument();
  });

  it("renders env var detail with key, value, scope, and source", () => {
    const envVar = makeEnvVar("OTEL_SERVICE_NAME", "norbert", "user");
    const selection: SelectedConfigItem = { tag: "env", envVar };

    render(<ConfigDetailPanel selection={selection} />);

    expect(screen.getByText("OTEL_SERVICE_NAME")).toBeInTheDocument();
    // Value is masked — reveal it
    fireEvent.click(screen.getByLabelText(/Reveal value for OTEL_SERVICE_NAME/));
    expect(screen.getByText("norbert")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
    expect(screen.getByText("~/.claude/settings.json")).toBeInTheDocument();
  });
});

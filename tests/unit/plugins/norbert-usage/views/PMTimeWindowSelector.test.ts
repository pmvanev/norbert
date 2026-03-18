/**
 * Unit tests: PMTimeWindowSelector (Step 04-02)
 *
 * Tests the time window selector button group component.
 * PMTimeWindowSelector is a controlled component receiving selectedWindow
 * and onChange callback. It renders buttons for 1m, 5m, 15m, and Session.
 *
 * Behaviors: 3 (renders all options, highlights selected, calls onChange)
 * Test budget: max 6 tests
 */

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { PMTimeWindowSelector } from "../../../../../src/plugins/norbert-usage/views/PMTimeWindowSelector";
import type { TimeWindowId } from "../../../../../src/plugins/norbert-usage/domain/types";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Renders all time window options
// ---------------------------------------------------------------------------

describe("PMTimeWindowSelector renders all time window options", () => {
  it("displays buttons for 1m, 5m, 15m, and Session", () => {
    render(
      React.createElement(PMTimeWindowSelector, {
        selectedWindow: "1m",
        onChange: vi.fn(),
      }),
    );

    const group = screen.getByRole("group", { name: /time window/i });
    expect(group).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "1m" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5m" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "15m" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Session" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Highlights the selected window
// ---------------------------------------------------------------------------

describe("PMTimeWindowSelector highlights the selected window", () => {
  it("marks the selected button with aria-pressed=true and others false", () => {
    render(
      React.createElement(PMTimeWindowSelector, {
        selectedWindow: "5m",
        onChange: vi.fn(),
      }),
    );

    expect(screen.getByRole("button", { name: "1m" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "5m" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "15m" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Session" })).toHaveAttribute("aria-pressed", "false");
  });
});

// ---------------------------------------------------------------------------
// Calls onChange with selected window id
// ---------------------------------------------------------------------------

describe("PMTimeWindowSelector calls onChange on button click", () => {
  it("invokes onChange with the clicked window id", () => {
    const onChange = vi.fn();

    render(
      React.createElement(PMTimeWindowSelector, {
        selectedWindow: "1m",
        onChange,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "15m" }));
    expect(onChange).toHaveBeenCalledWith("15m");
  });

  it("invokes onChange with 'session' when Session button clicked", () => {
    const onChange = vi.fn();

    render(
      React.createElement(PMTimeWindowSelector, {
        selectedWindow: "1m",
        onChange,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Session" }));
    expect(onChange).toHaveBeenCalledWith("session");
  });
});

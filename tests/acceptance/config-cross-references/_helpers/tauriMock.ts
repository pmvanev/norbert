/**
 * Tauri IPC mock for config-cross-references acceptance tests.
 *
 * The cross-reference feature consumes the existing `read_claude_config` IPC
 * (no new IPC). We mock @tauri-apps/api/core's `invoke` so component-level
 * tests can drive ConfigurationView/ConfigNavProvider without a live backend.
 *
 * Per architecture.md section 6.1: ConfigurationView owns the IPC and passes
 * `aggregatedConfig: AggregatedConfig | null` down to ConfigNavProvider. Most
 * acceptance tests will render the Provider directly with a fake aggregated
 * config, but tests that exercise the full integration seam can use this mock.
 */

import { vi } from "vitest";

type InvokeMock = ReturnType<typeof vi.fn>;

let invokeMock: InvokeMock | null = null;

/**
 * Install a mock for @tauri-apps/api/core's invoke.
 * Returns the mock for further configuration via mockResolvedValue, etc.
 */
export function installTauriInvokeMock(): InvokeMock {
  invokeMock = vi.fn();
  vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => {
      if (!invokeMock) {
        throw new Error("Tauri invoke mock not installed");
      }
      return invokeMock(...args);
    },
  }));
  return invokeMock;
}

export function getInvokeMock(): InvokeMock {
  if (!invokeMock) {
    throw new Error("Tauri invoke mock not installed -- call installTauriInvokeMock() first");
  }
  return invokeMock;
}

export function resetTauriInvokeMock(): void {
  invokeMock?.mockReset();
}

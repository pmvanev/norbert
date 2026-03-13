/// NorbertAPI Factory — creates scoped API instances per plugin.
///
/// Each plugin receives an API object where ui.registerView and ui.registerTab
/// automatically inject the plugin's id. The db sub-API enforces sandbox
/// namespace scoping via the sandboxEnforcer.

import type {
  NorbertAPI,
  DbAPI,
  HooksAPI,
  UiAPI,
  McpAPI,
  EventsAPI,
  ConfigAPI,
  PluginsAPI,
  ViewRegistration,
  TabRegistration,
  RegisterViewInput,
  RegisterTabInput,
} from "./types";
import { validateSqlForPlugin } from "./sandboxEnforcer";

/// Mutable collector for registrations during plugin onLoad.
/// This is the effects boundary — the collected data is folded
/// into the immutable PluginRegistry by the lifecycle manager.
export interface RegistrationCollector {
  views: ViewRegistration[];
  tabs: TabRegistration[];
}

/// Creates a scoped NorbertAPI instance for a specific plugin.
/// The pluginId is injected into all registrations automatically.
/// The collector accumulates registrations during onLoad execution.
export const createNorbertAPI = (
  pluginId: string,
  collector: RegistrationCollector
): NorbertAPI => {
  const ui: UiAPI = {
    _brand: "UiAPI" as const,
    registerView: (input: RegisterViewInput): void => {
      collector.views.push({
        ...input,
        pluginId,
      });
    },
    registerTab: (input: RegisterTabInput): void => {
      collector.tabs.push({
        ...input,
        pluginId,
      });
    },
  };

  /// Database API with sandbox enforcement — writes scoped to plugin namespace.
  const db: DbAPI = {
    _brand: "DbAPI" as const,
    execute: (sql: string) => validateSqlForPlugin(sql, pluginId),
  };
  const hooks: HooksAPI = { _brand: "HooksAPI" as const };
  const mcp: McpAPI = { _brand: "McpAPI" as const };
  const events: EventsAPI = { _brand: "EventsAPI" as const };
  const config: ConfigAPI = { _brand: "ConfigAPI" as const };
  const plugins: PluginsAPI = { _brand: "PluginsAPI" as const };

  return { db, hooks, ui, mcp, events, config, plugins };
};

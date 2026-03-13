/// NorbertAPI Factory — creates scoped API instances per plugin.
///
/// Each plugin receives an API object where ui.registerView and ui.registerTab
/// automatically inject the plugin's id. Other sub-APIs are placeholder stubs
/// for the walking skeleton; they will be implemented in later steps.

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
  HookRegistration,
  StatusItemRegistration,
  StatusItemHandle,
  RegisterViewInput,
  RegisterTabInput,
  RegisterStatusItemInput,
  HookProcessor,
} from "./types";
import {
  registerHookProcessor,
  registerStatusItem as registerStatusItemInBridge,
  updateStatusItem,
} from "./hookBridge";

/// Mutable collector for registrations during plugin onLoad.
/// This is the effects boundary — the collected data is folded
/// into the immutable PluginRegistry by the lifecycle manager.
export interface RegistrationCollector {
  views: ViewRegistration[];
  tabs: TabRegistration[];
  hookRegistrations: HookRegistration[];
  statusItems: StatusItemRegistration[];
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
    registerStatusItem: (input: RegisterStatusItemInput): StatusItemHandle => {
      const registration = registerStatusItemInBridge(pluginId, input);
      collector.statusItems.push(registration);
      return {
        update: (changes) => updateStatusItem(pluginId, input.id, changes),
      };
    },
  };

  /// Placeholder sub-APIs for the walking skeleton.
  /// These will be replaced with real implementations in later steps.
  const db: DbAPI = { _brand: "DbAPI" as const };
  const hooks: HooksAPI = {
    _brand: "HooksAPI" as const,
    register: (hookName: string, processor: HookProcessor): void => {
      const registration = registerHookProcessor(pluginId, hookName, processor);
      collector.hookRegistrations.push(registration);
    },
  };
  const mcp: McpAPI = { _brand: "McpAPI" as const };
  const events: EventsAPI = { _brand: "EventsAPI" as const };
  const config: ConfigAPI = { _brand: "ConfigAPI" as const };
  const plugins: PluginsAPI = { _brand: "PluginsAPI" as const };

  return { db, hooks, ui, mcp, events, config, plugins };
};

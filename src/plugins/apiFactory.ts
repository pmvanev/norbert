/// NorbertAPI Factory — creates scoped API instances per plugin.
///
/// Each plugin receives an API object where ui.registerView and ui.registerTab
/// automatically inject the plugin's id. The db sub-API enforces sandbox
/// namespace scoping via the sandboxEnforcer. The plugins sub-API provides
/// access to declared dependencies' public APIs.

import type {
  NorbertAPI,
  DbAPI,
  HooksAPI,
  UiAPI,
  McpAPI,
  EventsAPI,
  ConfigAPI,
  PluginsAPI,
  PluginPublicAPI,
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
import { ok, err } from "./types";
import { validateSqlForPlugin } from "./sandboxEnforcer";
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

/// Creates the plugins sub-API that enforces declared dependency access.
/// Only dependencies listed in the plugin's manifest can be accessed.
const createPluginsAPI = (
  pluginId: string,
  declaredDependencies: Readonly<Record<string, string>>,
  publicApiLookup: ReadonlyMap<string, PluginPublicAPI>
): PluginsAPI => ({
  _brand: "PluginsAPI" as const,
  get: (dependencyId: string) => {
    if (!(dependencyId in declaredDependencies)) {
      return err(
        `Plugin '${pluginId}' cannot access '${dependencyId}': dependency not declared in manifest.`
      );
    }
    const api = publicApiLookup.get(dependencyId);
    if (api === undefined) {
      return err(
        `Plugin '${pluginId}' cannot access '${dependencyId}': dependency not loaded or has no public API.`
      );
    }
    return ok(api);
  },
});

/// Creates a scoped NorbertAPI instance for a specific plugin.
/// The pluginId is injected into all registrations automatically.
/// The collector accumulates registrations during onLoad execution.
/// declaredDependencies and publicApiLookup enable inter-plugin API access.
export const createNorbertAPI = (
  pluginId: string,
  collector: RegistrationCollector,
  declaredDependencies: Readonly<Record<string, string>> = {},
  publicApiLookup: ReadonlyMap<string, PluginPublicAPI> = new Map()
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

  /// Database API with sandbox enforcement — writes scoped to plugin namespace.
  const db: DbAPI = {
    _brand: "DbAPI" as const,
    execute: (sql: string) => validateSqlForPlugin(sql, pluginId),
  };
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
  const plugins = createPluginsAPI(
    pluginId,
    declaredDependencies,
    publicApiLookup
  );

  return { db, hooks, ui, mcp, events, config, plugins };
};

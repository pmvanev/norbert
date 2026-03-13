/// Lifecycle Manager — orchestrates plugin loading and registration.
///
/// Calls onLoad for each plugin with a scoped NorbertAPI, then folds
/// the collected registrations into an immutable PluginRegistry.
/// This is the composition boundary where effects (onLoad calls) meet
/// the pure registry data structure.

import type {
  NorbertPlugin,
  NorbertAPI,
  PluginPublicAPI,
  PluginRegistry,
} from "./types";
import type { RegistrationCollector } from "./apiFactory";
import {
  addView,
  addTab,
  addHookRegistration,
  addStatusItem,
  markPluginLoaded,
  registerPublicAPI,
} from "./pluginRegistry";
import { validateManifest } from "./pluginLoader";

/// Type for the API factory function — a driven port injected as a parameter.
type CreateNorbertAPI = (
  pluginId: string,
  collector: RegistrationCollector,
  declaredDependencies?: Readonly<Record<string, string>>,
  publicApiLookup?: ReadonlyMap<string, PluginPublicAPI>
) => NorbertAPI;

/// Loads all plugins by calling onLoad on each, collecting registrations,
/// and folding them into the provided registry.
///
/// Plugins are loaded in order. Each plugin receives access to the public APIs
/// of previously loaded plugins (if declared as dependencies).
///
/// Returns a new PluginRegistry containing all views, tabs, loaded plugin ids,
/// and public APIs.
export const loadPlugins = (
  plugins: readonly NorbertPlugin[],
  initialRegistry: PluginRegistry,
  createApi: CreateNorbertAPI
): PluginRegistry =>
  plugins.reduce((registry, plugin) => {
    // Validate manifest before loading — reject invalid plugins.
    const validation = validateManifest(plugin.manifest);
    if (!validation.valid) {
      return registry;
    }

    const collector: RegistrationCollector = {
      views: [],
      tabs: [],
      hookRegistrations: [],
      statusItems: [],
    };
    const api = createApi(
      plugin.manifest.id,
      collector,
      plugin.manifest.dependencies,
      registry.publicApis
    );

    // Call plugin's onLoad — this is the effects boundary.
    // Walking skeleton only supports synchronous onLoad.
    plugin.onLoad(api);

    // Fold collected registrations into the registry.
    const withViews = collector.views.reduce(
      (reg, view) => addView(reg, view),
      registry
    );
    const withTabs = collector.tabs.reduce(
      (reg, tab) => addTab(reg, tab),
      withViews
    );
    const withHooks = collector.hookRegistrations.reduce(
      (reg, hookReg) => addHookRegistration(reg, hookReg),
      withTabs
    );
    const withStatusItems = collector.statusItems.reduce(
      (reg, statusItem) => addStatusItem(reg, statusItem),
      withHooks
    );

    const withPluginLoaded = markPluginLoaded(withStatusItems, plugin.manifest.id);

    // Register the plugin's public API if it exposes one.
    if (plugin.publicAPI !== undefined) {
      return registerPublicAPI(
        withPluginLoaded,
        plugin.manifest.id,
        plugin.publicAPI
      );
    }

    return withPluginLoaded;
  }, initialRegistry);

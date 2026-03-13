/// Plugin Registry — immutable data structure for loaded plugin state.
///
/// All operations return new PluginRegistry instances (no mutation).
/// Views and tabs are accumulated as plugins load via the lifecycle manager.

import type {
  PluginRegistry,
  PluginPublicAPI,
  ViewRegistration,
  TabRegistration,
} from "./types";

/// Creates an empty plugin registry with no views, tabs, or loaded plugins.
export const createPluginRegistry = (): PluginRegistry => ({
  views: [],
  tabs: [],
  loadedPluginIds: [],
  publicApis: new Map(),
});

/// Returns a new registry with the given view appended.
export const addView = (
  registry: PluginRegistry,
  view: ViewRegistration
): PluginRegistry => ({
  ...registry,
  views: [...registry.views, view],
});

/// Returns a new registry with the given tab appended.
export const addTab = (
  registry: PluginRegistry,
  tab: TabRegistration
): PluginRegistry => ({
  ...registry,
  tabs: [...registry.tabs, tab],
});

/// Returns a new registry with the plugin id added to loadedPluginIds.
export const markPluginLoaded = (
  registry: PluginRegistry,
  pluginId: string
): PluginRegistry => ({
  ...registry,
  loadedPluginIds: [...registry.loadedPluginIds, pluginId],
});

/// Returns all views registered by the specified plugin.
export const getViewsByPlugin = (
  registry: PluginRegistry,
  pluginId: string
): readonly ViewRegistration[] =>
  registry.views.filter((view) => view.pluginId === pluginId);

/// Returns all tabs registered by the specified plugin.
export const getTabsByPlugin = (
  registry: PluginRegistry,
  pluginId: string
): readonly TabRegistration[] =>
  registry.tabs.filter((tab) => tab.pluginId === pluginId);

/// Returns all views from all plugins.
export const getAllViews = (
  registry: PluginRegistry
): readonly ViewRegistration[] => registry.views;

/// Returns all tabs from all plugins.
export const getAllTabs = (
  registry: PluginRegistry
): readonly TabRegistration[] => registry.tabs;

/// Returns a new registry with the plugin's public API stored.
export const registerPublicAPI = (
  registry: PluginRegistry,
  pluginId: string,
  publicAPI: PluginPublicAPI
): PluginRegistry => ({
  ...registry,
  publicApis: new Map([...registry.publicApis, [pluginId, publicAPI]]),
});

/// Returns the public API for a plugin, or undefined if not registered.
export const getPublicAPI = (
  registry: PluginRegistry,
  pluginId: string
): PluginPublicAPI | undefined => registry.publicApis.get(pluginId);

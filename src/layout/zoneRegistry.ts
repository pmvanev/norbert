/**
 * Zone Registry — pure functions for managing a keyed map of zones.
 *
 * Invariant: the "main" zone is always present and cannot be removed.
 * All operations return new maps (immutable).
 */

import type { ZoneState, ZoneRegistry } from "./types";

const MAIN_ZONE_NAME = "main";

const emptyMainZone: ZoneState = { viewId: null, pluginId: null };

/**
 * Creates a fresh zone registry with the main zone present.
 */
export const createZoneRegistry = (): ZoneRegistry =>
  new Map([[MAIN_ZONE_NAME, emptyMainZone]]);

/**
 * Retrieves a zone by name. Returns undefined if the zone does not exist.
 */
export const getZone = (
  registry: ZoneRegistry,
  name: string
): ZoneState | undefined => registry.get(name);

/**
 * Adds or replaces a zone in the registry. Returns a new registry.
 */
export const addZone = (
  registry: ZoneRegistry,
  name: string,
  state: ZoneState
): ZoneRegistry => {
  const updated = new Map(registry);
  updated.set(name, state);
  return updated;
};

/**
 * Removes a zone from the registry. The main zone cannot be removed.
 * Returns a new registry.
 */
export const removeZone = (
  registry: ZoneRegistry,
  name: string
): ZoneRegistry => {
  if (name === MAIN_ZONE_NAME) {
    return registry;
  }
  const updated = new Map(registry);
  updated.delete(name);
  return updated;
};

/**
 * Lists all zone names in the registry.
 */
export const listZoneNames = (registry: ZoneRegistry): readonly string[] =>
  [...registry.keys()];

/**
 * Updates the viewId and pluginId for an existing zone.
 * If the zone does not exist, returns the registry unchanged.
 */
export const setZoneView = (
  registry: ZoneRegistry,
  name: string,
  viewId: string | null,
  pluginId: string | null
): ZoneRegistry => {
  if (!registry.has(name)) {
    return registry;
  }
  const updated = new Map(registry);
  updated.set(name, { viewId, pluginId });
  return updated;
};

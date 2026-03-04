/**
 * ConfigScope -- discriminated union representing the 5 configuration scopes.
 *
 * Scopes determine where configuration files are discovered and their
 * precedence in the override hierarchy. Managed scope is highest priority
 * (cannot be overridden); user scope is lowest (overridden by everything).
 *
 * Discriminant field: `scope`
 */

// ---------------------------------------------------------------------------
// Scope Variants
// ---------------------------------------------------------------------------

export interface ManagedScope {
  readonly scope: 'managed';
  readonly color: '#EF4444';
  readonly label: 'Managed';
}

export interface UserScope {
  readonly scope: 'user';
  readonly color: '#3B82F6';
  readonly label: 'User';
}

export interface ProjectScope {
  readonly scope: 'project';
  readonly color: '#22C55E';
  readonly label: 'Project';
}

export interface LocalScope {
  readonly scope: 'local';
  readonly color: '#EAB308';
  readonly label: 'Local';
}

export interface PluginScope {
  readonly scope: 'plugin';
  readonly color: '#A855F7';
  readonly label: 'Plugin';
}

// ---------------------------------------------------------------------------
// Discriminated Union
// ---------------------------------------------------------------------------

export type ConfigScope =
  | ManagedScope
  | UserScope
  | ProjectScope
  | LocalScope
  | PluginScope;

// ---------------------------------------------------------------------------
// Scope Name Literal
// ---------------------------------------------------------------------------

export type ScopeName = ConfigScope['scope'];

// ---------------------------------------------------------------------------
// Constructors (smart constructors returning readonly values)
// ---------------------------------------------------------------------------

export const managedScope: ManagedScope = { scope: 'managed', color: '#EF4444', label: 'Managed' } as const;
export const userScope: UserScope = { scope: 'user', color: '#3B82F6', label: 'User' } as const;
export const projectScope: ProjectScope = { scope: 'project', color: '#22C55E', label: 'Project' } as const;
export const localScope: LocalScope = { scope: 'local', color: '#EAB308', label: 'Local' } as const;
export const pluginScope: PluginScope = { scope: 'plugin', color: '#A855F7', label: 'Plugin' } as const;

// ---------------------------------------------------------------------------
// All Scopes (ordered by precedence: highest first)
// ---------------------------------------------------------------------------

export const ALL_SCOPES: readonly ConfigScope[] = [
  managedScope,
  localScope,
  projectScope,
  userScope,
  pluginScope,
] as const;

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const scopeByName: Readonly<Record<ScopeName, ConfigScope>> = {
  managed: managedScope,
  user: userScope,
  project: projectScope,
  local: localScope,
  plugin: pluginScope,
};

export const scopeFromName = (name: ScopeName): ConfigScope => scopeByName[name];

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

export const isManaged = (scope: ConfigScope): scope is ManagedScope => scope.scope === 'managed';
export const isUser = (scope: ConfigScope): scope is UserScope => scope.scope === 'user';
export const isProject = (scope: ConfigScope): scope is ProjectScope => scope.scope === 'project';
export const isLocal = (scope: ConfigScope): scope is LocalScope => scope.scope === 'local';
export const isPlugin = (scope: ConfigScope): scope is PluginScope => scope.scope === 'plugin';

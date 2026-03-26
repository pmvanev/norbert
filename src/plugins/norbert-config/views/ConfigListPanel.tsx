/// ConfigListPanel -- compact navigation list for each config tab type.
///
/// Renders a scrollable list of items for the active sub-tab.
/// Each row shows the item name, scope badge, and optional metadata.
/// Clicking a row selects the item for display in the detail panel.
/// Filterable tabs (agents, commands, hooks, skills, rules) show a
/// source filter bar for narrowing items by origin (user/project/plugin).

import { useState, useEffect, useMemo, type FC } from "react";
import type {
  ConfigSubTab,
  ConfigScope,
  AggregatedConfig,
  AgentParseResult,
  CommandDefinition,
  HookConfig,
  McpServerConfig,
  SkillDefinition,
  RuleEntry,
  PluginInfo,
  DocFile,
  EnvVarEntry,
  SelectedConfigItem,
} from "../domain/types";
import { EmptyState } from "./EmptyState";
import { ErrorIndicator } from "./ErrorIndicator";
import { ScopeBadge, formatAgentDisplayName, deriveFilename } from "./shared";

// ---------------------------------------------------------------------------
// Source label extraction -- unified across all filterable entity types
// ---------------------------------------------------------------------------

/** Derive the display label for an item's origin (user, project, or plugin name). */
const sourceLabel = (scope: ConfigScope, source?: string): string =>
  scope === "plugin" && source ? source : scope;

/** Tabs that support source filtering. */
const FILTERABLE_TABS = new Set<ConfigSubTab>(["agents", "commands", "hooks", "skills", "rules"]);

/** Extract sorted unique source labels from a list of scoped items. */
function collectSources(items: readonly { readonly scope: ConfigScope; readonly source?: string }[]): readonly string[] {
  const labels = new Set<string>();
  for (const item of items) {
    labels.add(sourceLabel(item.scope, item.source));
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}

/** Extract sources from agents (handles the parsed/error discriminated union). */
function collectAgentSources(agents: readonly AgentParseResult[]): readonly string[] {
  const labels = new Set<string>();
  for (const r of agents) {
    if (r.tag === "parsed") {
      labels.add(sourceLabel(r.agent.scope, r.agent.source));
    }
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}

/** Filter agents by source label. */
function filterAgents(agents: readonly AgentParseResult[], source: string | null): readonly AgentParseResult[] {
  if (source === null) return agents;
  return agents.filter((r) =>
    r.tag === "parsed" && sourceLabel(r.agent.scope, r.agent.source) === source
  );
}

/** Sort agents: by source label first, then by name within each group. */
function sortAgentsBySource(agents: readonly AgentParseResult[]): readonly AgentParseResult[] {
  return [...agents].sort((a, b) => {
    const aLabel = a.tag === "parsed" ? sourceLabel(a.agent.scope, a.agent.source) : "";
    const bLabel = b.tag === "parsed" ? sourceLabel(b.agent.scope, b.agent.source) : "";
    const cmp = aLabel.localeCompare(bLabel);
    if (cmp !== 0) return cmp;
    const aName = a.tag === "parsed" ? a.agent.name : "";
    const bName = b.tag === "parsed" ? b.agent.name : "";
    return aName.localeCompare(bName);
  });
}

/** Generic filter for items with scope and source. */
function filterBySource<T extends { readonly scope: ConfigScope; readonly source?: string }>(
  items: readonly T[],
  source: string | null,
): readonly T[] {
  if (source === null) return items;
  return items.filter((item) => sourceLabel(item.scope, item.source) === source);
}

/** Generic sort by source then name. */
function sortBySource<T extends { readonly scope: ConfigScope; readonly source?: string; readonly name?: string }>(
  items: readonly T[],
): readonly T[] {
  return [...items].sort((a, b) => {
    const cmp = sourceLabel(a.scope, a.source).localeCompare(sourceLabel(b.scope, b.source));
    if (cmp !== 0) return cmp;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

type SortMode = "name" | "source";

// ---------------------------------------------------------------------------
// SourceFilterBar -- filter chips + sort toggle for filterable tabs
// ---------------------------------------------------------------------------

const SourceFilterBar: FC<{
  readonly sources: readonly string[];
  readonly activeSource: string | null;
  readonly onSourceChange: (source: string | null) => void;
  readonly sortMode: SortMode;
  readonly onSortChange: (mode: SortMode) => void;
}> = ({ sources, activeSource, onSourceChange, sortMode, onSortChange }) => {
  if (sources.length <= 1) return null;

  return (
    <div className="config-filter-bar">
      <div className="config-filter-chips">
        <button
          className={`config-filter-chip${activeSource === null ? " active" : ""}`}
          onClick={() => onSourceChange(null)}
          type="button"
        >
          All
        </button>
        {sources.map((src) => (
          <button
            key={src}
            className={`config-filter-chip${activeSource === src ? " active" : ""}`}
            onClick={() => onSourceChange(activeSource === src ? null : src)}
            type="button"
          >
            {src}
          </button>
        ))}
      </div>
      <button
        className="config-sort-toggle"
        onClick={() => onSortChange(sortMode === "name" ? "source" : "name")}
        type="button"
        title={`Sort by ${sortMode === "name" ? "source" : "name"}`}
        aria-label={`Sort by ${sortMode === "name" ? "source" : "name"}`}
      >
        {sortMode === "source" ? "\u2B07 source" : "\u2B07 name"}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConfigListPanelProps {
  readonly tab: ConfigSubTab;
  readonly config: AggregatedConfig;
  readonly selectedKey: string | null;
  readonly onSelect: (item: SelectedConfigItem, key: string) => void;
}

// ---------------------------------------------------------------------------
// List row components
// ---------------------------------------------------------------------------

const AgentRow: FC<{
  readonly result: AgentParseResult;
  readonly active: boolean;
  readonly onSelect: () => void;
}> = ({ result, active, onSelect }) => {
  if (result.tag === "error") {
    return <ErrorIndicator filePath={result.filePath} error={result.message} />;
  }
  const { agent } = result;
  return (
    <button
      className={`config-list-row config-list-row-multi${active ? " active" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <div className="config-list-row-top">
        <span className="config-list-name">{formatAgentDisplayName(agent)}</span>
        <ScopeBadge scope={agent.scope} source={agent.source} />
        <span className="config-list-meta" data-mono="">{agent.model}</span>
      </div>
      {agent.description && (
        <span className="config-list-desc">{agent.description}</span>
      )}
    </button>
  );
};

const CommandRow: FC<{
  readonly command: CommandDefinition;
  readonly active: boolean;
  readonly onSelect: () => void;
}> = ({ command, active, onSelect }) => (
  <button
    className={`config-list-row config-list-row-multi${active ? " active" : ""}`}
    onClick={onSelect}
    type="button"
  >
    <div className="config-list-row-top">
      <span className="config-list-name">{command.name}</span>
      <ScopeBadge scope={command.scope} source={command.source} />
    </div>
    {command.description && (
      <span className="config-list-desc">{command.description}</span>
    )}
  </button>
);

const HookRow: FC<{
  readonly hook: HookConfig;
  readonly active: boolean;
  readonly onSelect: () => void;
}> = ({ hook, active, onSelect }) => (
  <button
    className={`config-list-row${active ? " active" : ""}`}
    onClick={onSelect}
    type="button"
  >
    <span className="config-list-name">{hook.event}</span>
    <ScopeBadge scope={hook.scope} source={hook.source} />
  </button>
);

const McpRow: FC<{
  readonly server: McpServerConfig;
  readonly active: boolean;
  readonly onSelect: () => void;
}> = ({ server, active, onSelect }) => (
  <button
    className={`config-list-row${active ? " active" : ""}`}
    onClick={onSelect}
    type="button"
  >
    <span className="config-list-name">{server.name}</span>
    <ScopeBadge scope={server.scope} />
    <span className="config-list-meta" data-mono="">{server.type}</span>
  </button>
);

const SkillRow: FC<{
  readonly skill: SkillDefinition;
  readonly active: boolean;
  readonly onSelect: () => void;
}> = ({ skill, active, onSelect }) => (
  <button
    className={`config-list-row config-list-row-multi${active ? " active" : ""}`}
    onClick={onSelect}
    type="button"
  >
    <div className="config-list-row-top">
      <span className="config-list-name">{skill.name}</span>
      <ScopeBadge scope={skill.scope} source={skill.source} />
    </div>
    {skill.description && (
      <span className="config-list-desc">{skill.description}</span>
    )}
  </button>
);

/** Derive a short display name from the file path. */
const deriveRuleName = (rule: RuleEntry): string =>
  deriveFilename(rule.filePath, rule.source).replace(/\.md$/, "");

const RuleRow: FC<{
  readonly rule: RuleEntry;
  readonly active: boolean;
  readonly onSelect: () => void;
}> = ({ rule, active, onSelect }) => (
  <button
    className={`config-list-row${active ? " active" : ""}`}
    onClick={onSelect}
    type="button"
  >
    <span className="config-list-name">{deriveRuleName(rule)}</span>
    <ScopeBadge scope={rule.scope} source={rule.source} />
  </button>
);

const PluginRow: FC<{
  readonly plugin: PluginInfo;
  readonly active: boolean;
  readonly onSelect: () => void;
}> = ({ plugin, active, onSelect }) => (
  <button
    className={`config-list-row${active ? " active" : ""}`}
    onClick={onSelect}
    type="button"
  >
    <span className="config-list-name">{plugin.name}</span>
    <ScopeBadge scope={plugin.scope} />
    <span className="config-list-meta" data-mono="">v{plugin.version}</span>
  </button>
);

/** Derive a short display name from the doc file path. */
const deriveDocName = (doc: DocFile): string =>
  deriveFilename(doc.filePath);

const DocRow: FC<{
  readonly doc: DocFile;
  readonly active: boolean;
  readonly onSelect: () => void;
}> = ({ doc, active, onSelect }) => (
  <button
    className={`config-list-row${active ? " active" : ""}`}
    onClick={onSelect}
    type="button"
  >
    <span className="config-list-name">{deriveDocName(doc)}</span>
    <ScopeBadge scope={doc.scope} />
  </button>
);

const EnvVarRow: FC<{
  readonly envVar: EnvVarEntry;
  readonly active: boolean;
  readonly onSelect: () => void;
}> = ({ envVar, active, onSelect }) => (
  <button
    className={`config-list-row${active ? " active" : ""}`}
    onClick={onSelect}
    type="button"
    aria-label={envVar.key}
  >
    <span className="config-list-name">{envVar.key}</span>
    <ScopeBadge scope={envVar.scope} />
    <span className="config-list-meta" data-mono="">{"\u2022\u2022\u2022\u2022"}</span>
  </button>
);

// ---------------------------------------------------------------------------
// Key derivation -- stable keys for each item type
// ---------------------------------------------------------------------------

const agentKey = (r: AgentParseResult, i: number): string =>
  r.tag === "parsed" ? r.agent.filePath : `error-${i}`;

const commandKey = (c: CommandDefinition): string => c.filePath;

const hookKey = (h: HookConfig, i: number): string =>
  `${h.event}-${h.command}-${i}`;

const mcpKey = (s: McpServerConfig): string =>
  `${s.name}-${s.filePath}`;

const skillKey = (s: SkillDefinition): string => s.filePath;

const ruleKey = (r: RuleEntry, i: number): string =>
  `${r.source}-${i}`;

const pluginKey = (p: PluginInfo): string =>
  `${p.name}-${p.filePath}`;

const docKey = (d: DocFile): string => d.filePath;

const envVarKey = (e: EnvVarEntry): string => `${e.key}-${e.filePath}`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConfigListPanel: FC<ConfigListPanelProps> = ({
  tab,
  config,
  selectedKey,
  onSelect,
}) => {
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("name");

  // Reset filter/sort when tab changes.
  useEffect(() => {
    setActiveSource(null);
    setSortMode("name");
  }, [tab]);

  const isFilterable = FILTERABLE_TABS.has(tab);

  // Collect sources for the current tab (only for filterable tabs).
  const sources = useMemo(() => {
    if (!isFilterable) return [];
    switch (tab) {
      case "agents": return collectAgentSources(config.agents);
      case "commands": return collectSources(config.commands);
      case "hooks": return collectSources(config.hooks);
      case "skills": return collectSources(config.skills);
      case "rules": return collectSources(config.rules);
      default: return [];
    }
  }, [tab, isFilterable, config]);

  // Render the filter bar (only when multiple sources exist).
  const filterBar = isFilterable ? (
    <SourceFilterBar
      sources={sources}
      activeSource={activeSource}
      onSourceChange={setActiveSource}
      sortMode={sortMode}
      onSortChange={setSortMode}
    />
  ) : null;

  switch (tab) {
    case "agents": {
      if (config.agents.length === 0) {
        return <EmptyState category="agents" guidance="Add agent definitions in .claude/agents/ as markdown files." />;
      }
      const filtered = filterAgents(config.agents, activeSource);
      const items = sortMode === "source" ? sortAgentsBySource(filtered) : filtered;
      return (
        <>
          {filterBar}
          <div className="config-list" role="listbox" aria-label="Agents">
            {items.map((result, i) => {
              const key = agentKey(result, i);
              return (
                <AgentRow
                  key={key}
                  result={result}
                  active={selectedKey === key}
                  onSelect={() =>
                    result.tag === "parsed"
                      ? onSelect({ tag: "agent", agent: result.agent }, key)
                      : undefined
                  }
                />
              );
            })}
          </div>
        </>
      );
    }

    case "commands": {
      if (config.commands.length === 0) {
        return <EmptyState category="commands" guidance="Add command definitions in .claude/commands/ as markdown files." />;
      }
      const filtered = filterBySource(config.commands, activeSource);
      const items = sortMode === "source" ? sortBySource(filtered) : filtered;
      return (
        <>
          {filterBar}
          <div className="config-list" role="listbox" aria-label="Commands">
            {items.map((command) => {
              const key = commandKey(command);
              return (
                <CommandRow
                  key={key}
                  command={command}
                  active={selectedKey === key}
                  onSelect={() => onSelect({ tag: "command", command }, key)}
                />
              );
            })}
          </div>
        </>
      );
    }

    case "hooks": {
      if (config.hooks.length === 0) {
        return <EmptyState category="hooks" guidance="Define hooks in settings.json under the hooks key." />;
      }
      const filtered = filterBySource(config.hooks, activeSource);
      const items = sortMode === "source" ? sortBySource(filtered) : filtered;
      return (
        <>
          {filterBar}
          <div className="config-list" role="listbox" aria-label="Hooks">
            {items.map((hook, i) => {
              const key = hookKey(hook, i);
              return (
                <HookRow
                  key={key}
                  hook={hook}
                  active={selectedKey === key}
                  onSelect={() => onSelect({ tag: "hook", hook }, key)}
                />
              );
            })}
          </div>
        </>
      );
    }

    case "mcp": {
      if (config.mcpServers.length === 0) {
        return <EmptyState category="MCP servers" guidance="Configure MCP servers in settings.json under the mcpServers key." />;
      }
      return (
        <div className="config-list" role="listbox" aria-label="MCP Servers">
          {config.mcpServers.map((server) => {
            const key = mcpKey(server);
            return (
              <McpRow
                key={key}
                server={server}
                active={selectedKey === key}
                onSelect={() => onSelect({ tag: "mcp", server }, key)}
              />
            );
          })}
        </div>
      );
    }

    case "skills": {
      if (config.skills.length === 0) {
        return <EmptyState category="skills" guidance="Skills are provided by installed plugins." />;
      }
      const filtered = filterBySource(config.skills, activeSource);
      const items = sortMode === "source" ? sortBySource(filtered) : filtered;
      return (
        <>
          {filterBar}
          <div className="config-list" role="listbox" aria-label="Skills">
            {items.map((skill) => {
              const key = skillKey(skill);
              return (
                <SkillRow
                  key={key}
                  skill={skill}
                  active={selectedKey === key}
                  onSelect={() => onSelect({ tag: "skill", skill }, key)}
                />
              );
            })}
          </div>
        </>
      );
    }

    case "rules": {
      if (config.rules.length === 0) {
        return <EmptyState category="rules" guidance="Define rules in settings.json or CLAUDE.md files." />;
      }
      const filtered = filterBySource(config.rules, activeSource);
      const items = sortMode === "source" ? sortBySource(filtered) : filtered;
      return (
        <>
          {filterBar}
          <div className="config-list" role="listbox" aria-label="Rules">
            {items.map((rule, i) => {
              const key = ruleKey(rule, i);
              return (
                <RuleRow
                  key={key}
                  rule={rule}
                  active={selectedKey === key}
                  onSelect={() => onSelect({ tag: "rule", rule }, key)}
                />
              );
            })}
          </div>
        </>
      );
    }

    case "plugins": {
      if (config.plugins.length === 0) {
        return <EmptyState category="plugins" guidance="Plugins are detected from settings.json configuration." />;
      }
      return (
        <div className="config-list" role="listbox" aria-label="Plugins">
          {config.plugins.map((plugin) => {
            const key = pluginKey(plugin);
            return (
              <PluginRow
                key={key}
                plugin={plugin}
                active={selectedKey === key}
                onSelect={() => onSelect({ tag: "plugin", plugin }, key)}
              />
            );
          })}
        </div>
      );
    }

    case "docs": {
      if (config.docs.length === 0) {
        return <EmptyState category="documentation" guidance="Add a CLAUDE.md file to your project root or ~/.claude/ directory." />;
      }
      return (
        <div className="config-list" role="listbox" aria-label="Documentation">
          {config.docs.map((doc) => {
            const key = docKey(doc);
            return (
              <DocRow
                key={key}
                doc={doc}
                active={selectedKey === key}
                onSelect={() => onSelect({ tag: "doc", doc }, key)}
              />
            );
          })}
        </div>
      );
    }

    case "env": {
      if (config.envVars.length === 0) {
        return <EmptyState category="environment variables" guidance="Run /norbert:setup to configure OpenTelemetry environment variables, or add env vars to settings.json manually." />;
      }
      const sorted = [...config.envVars].sort((a, b) => a.key.localeCompare(b.key));
      return (
        <div className="config-list" role="listbox" aria-label="Environment Variables">
          {sorted.map((envVar) => {
            const key = envVarKey(envVar);
            return (
              <EnvVarRow
                key={key}
                envVar={envVar}
                active={selectedKey === key}
                onSelect={() => onSelect({ tag: "env", envVar }, key)}
              />
            );
          })}
        </div>
      );
    }
  }
};

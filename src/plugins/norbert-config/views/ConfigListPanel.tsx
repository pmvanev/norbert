/// ConfigListPanel -- compact navigation list for each config tab type.
///
/// Renders a scrollable list of items for the active sub-tab.
/// Each row shows the item name, scope badge, and optional metadata.
/// Clicking a row selects the item for display in the detail panel.

import type { FC } from "react";
import type {
  ConfigSubTab,
  AggregatedConfig,
  AgentParseResult,
  HookConfig,
  McpServerConfig,
  SkillDefinition,
  RuleEntry,
  PluginInfo,
  DocFile,
  SelectedConfigItem,
} from "../domain/types";
import { EmptyState } from "./EmptyState";
import { ErrorIndicator } from "./ErrorIndicator";

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
// Scope badge (shared)
// ---------------------------------------------------------------------------

const ScopeBadge: FC<{ readonly scope: string; readonly source?: string }> = ({ scope, source }) => (
  <span className="config-scope-badge">{scope === "plugin" && source ? source : scope}</span>
);

// ---------------------------------------------------------------------------
// List row components
// ---------------------------------------------------------------------------

/** Format agent display name: "Persona, name" if persona exists, otherwise just name. */
const formatAgentDisplayName = (agent: { readonly persona: string; readonly name: string }): string =>
  agent.persona ? `${agent.persona}, ${agent.name}` : agent.name;

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
const deriveRuleName = (rule: RuleEntry): string => {
  const segments = rule.filePath.split(/[/\\]/);
  const filename = segments[segments.length - 1] ?? rule.source;
  return filename.replace(/\.md$/, "");
};

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
const deriveDocName = (doc: DocFile): string => {
  const segments = doc.filePath.split(/[/\\]/);
  return segments[segments.length - 1] ?? doc.filePath;
};

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

// ---------------------------------------------------------------------------
// Key derivation -- stable keys for each item type
// ---------------------------------------------------------------------------

const agentKey = (r: AgentParseResult, i: number): string =>
  r.tag === "parsed" ? r.agent.filePath : `error-${i}`;

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConfigListPanel: FC<ConfigListPanelProps> = ({
  tab,
  config,
  selectedKey,
  onSelect,
}) => {
  switch (tab) {
    case "agents": {
      if (config.agents.length === 0) {
        return <EmptyState category="agents" guidance="Add agent definitions in .claude/agents/ as markdown files." />;
      }
      return (
        <div className="config-list" role="listbox" aria-label="Agents">
          {config.agents.map((result, i) => {
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
      );
    }

    case "hooks": {
      if (config.hooks.length === 0) {
        return <EmptyState category="hooks" guidance="Define hooks in settings.json under the hooks key." />;
      }
      return (
        <div className="config-list" role="listbox" aria-label="Hooks">
          {config.hooks.map((hook, i) => {
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
        return <EmptyState category="skills" guidance="Add skill definitions in .claude/commands/ as markdown files." />;
      }
      return (
        <div className="config-list" role="listbox" aria-label="Skills">
          {config.skills.map((skill) => {
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
      );
    }

    case "rules": {
      if (config.rules.length === 0) {
        return <EmptyState category="rules" guidance="Define rules in settings.json or CLAUDE.md files." />;
      }
      return (
        <div className="config-list" role="listbox" aria-label="Rules">
          {config.rules.map((rule, i) => {
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
  }
};

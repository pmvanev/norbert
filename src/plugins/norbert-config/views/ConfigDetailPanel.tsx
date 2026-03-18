/// ConfigDetailPanel -- renders full details for the selected config item.
///
/// Receives a SelectedConfigItem and renders the appropriate detail view.
/// When nothing is selected, this component is not rendered.

import { useState, type FC } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  SelectedConfigItem,
  AgentDefinition,
  CommandDefinition,
  HookConfig,
  McpServerConfig,
  SkillDefinition,
  RuleEntry,
  PluginInfo,
  DocFile,
  EnvVar,
} from "../domain/types";

// ---------------------------------------------------------------------------
// Scope badge
// ---------------------------------------------------------------------------

const ScopeBadge: FC<{ readonly scope: string; readonly source?: string }> = ({ scope, source }) => (
  <span className="config-scope-badge">{scope === "plugin" && source ? source : scope}</span>
);

// ---------------------------------------------------------------------------
// Masked env var row (MCP detail)
// ---------------------------------------------------------------------------

const MASK = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

const EnvVarRow: FC<{ readonly envVar: EnvVar }> = ({ envVar }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="config-env-row">
      <span className="config-env-key" data-mono="">{envVar.key}</span>
      <button
        className="config-env-value-btn"
        onClick={() => setRevealed((c) => !c)}
        type="button"
        aria-label={revealed ? `Hide value for ${envVar.key}` : `Reveal value for ${envVar.key}`}
      >
        <span data-mono="">{revealed ? envVar.value : MASK}</span>
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Detail renderers
// ---------------------------------------------------------------------------

/** Format agent display name: "Persona, name" if persona exists, otherwise just name. */
const formatAgentDisplayName = (agent: { readonly persona: string; readonly name: string }): string =>
  agent.persona ? `${agent.persona}, ${agent.name}` : agent.name;

const AgentDetail: FC<{ readonly agent: AgentDefinition }> = ({ agent }) => (
  <div className="config-detail-content">
    <div className="config-detail-header">
      <span className="config-detail-title">{formatAgentDisplayName(agent)}</span>
      <ScopeBadge scope={agent.scope} source={agent.source} />
      <span className="config-card-meta" data-mono="">
        {agent.model} {"\u00B7"} {agent.toolCount} tool{agent.toolCount !== 1 ? "s" : ""}
      </span>
    </div>
    {agent.role && (
      <p className="config-card-description">{agent.role}</p>
    )}
    <div className="config-card-section">
      <span className="config-card-section-label">Source</span>
      <span className="config-card-source" data-mono="">{agent.filePath}</span>
    </div>
    <p className="config-card-description">{agent.description}</p>
    <div className="config-card-section">
      <span className="config-card-section-label">System Prompt</span>
      <div className="config-doc-body">
        <Markdown remarkPlugins={[remarkGfm]}>{agent.systemPrompt}</Markdown>
      </div>
    </div>
    {agent.tools.length > 0 && (
      <div className="config-card-section">
        <span className="config-card-section-label">Tools</span>
        <div className="config-tag-list">
          {agent.tools.map((tool) => (
            <span key={tool} className="config-tag">{tool}</span>
          ))}
        </div>
      </div>
    )}
  </div>
);

const CommandDetail: FC<{ readonly command: CommandDefinition }> = ({ command }) => (
  <div className="config-detail-content">
    <div className="config-detail-header">
      <span className="config-detail-title">{command.name}</span>
      <ScopeBadge scope={command.scope} source={command.source} />
    </div>
    <div className="config-card-section">
      <span className="config-card-section-label">Source</span>
      <span className="config-card-source" data-mono="">{command.filePath}</span>
    </div>
    {command.content ? (
      <div className="config-doc-body">
        <Markdown remarkPlugins={[remarkGfm]}>{command.content}</Markdown>
      </div>
    ) : (
      <p className="config-card-description">{command.description}</p>
    )}
  </div>
);

const HookDetail: FC<{ readonly hook: HookConfig }> = ({ hook }) => (
  <div className="config-detail-content">
    <div className="config-detail-header">
      <span className="config-detail-title">{hook.event}</span>
      <ScopeBadge scope={hook.scope} source={hook.source} />
    </div>
    <div className="config-card-section">
      <span className="config-card-section-label">Command</span>
      <code className="config-card-code-inline">{hook.command}</code>
    </div>
    {hook.matchers.length > 0 && (
      <div className="config-card-section">
        <span className="config-card-section-label">Matchers</span>
        <div className="config-tag-list">
          {hook.matchers.map((matcher, i) => (
            <span key={`${matcher}-${i}`} className="config-tag">{matcher}</span>
          ))}
        </div>
      </div>
    )}
    <div className="config-card-section">
      <span className="config-card-section-label">Source</span>
      <span className="config-card-source" data-mono="">{hook.filePath}</span>
    </div>
  </div>
);

const McpDetail: FC<{ readonly server: McpServerConfig }> = ({ server }) => (
  <div className="config-detail-content">
    <div className="config-detail-header">
      <span className="config-detail-title">{server.name}</span>
      <ScopeBadge scope={server.scope} />
      <span className="config-card-meta" data-mono="">{server.type}</span>
    </div>
    <div className="config-card-section">
      <span className="config-card-section-label">Command</span>
      <code className="config-card-code-inline">
        {server.command}{server.args.length > 0 ? ` ${server.args.join(" ")}` : ""}
      </code>
    </div>
    {server.env.length > 0 && (
      <div className="config-card-section">
        <span className="config-card-section-label">Environment</span>
        <div className="config-env-list">
          {server.env.map((envVar) => (
            <EnvVarRow key={envVar.key} envVar={envVar} />
          ))}
        </div>
      </div>
    )}
    {server.warnings.length > 0 && (
      <div className="config-card-section">
        <span className="config-card-section-label config-card-section-label-warn">Warnings</span>
        {server.warnings.map((warning, i) => (
          <span key={i} className="config-card-warning">{"\u26A0"} {warning}</span>
        ))}
      </div>
    )}
    <div className="config-card-section">
      <span className="config-card-section-label">Source</span>
      <span className="config-card-source" data-mono="">{server.filePath}</span>
    </div>
  </div>
);

const SkillDetail: FC<{ readonly skill: SkillDefinition }> = ({ skill }) => (
  <div className="config-detail-content">
    <div className="config-detail-header">
      <span className="config-detail-title">{skill.name}</span>
      <ScopeBadge scope={skill.scope} source={skill.source} />
    </div>
    <div className="config-card-section">
      <span className="config-card-section-label">Source</span>
      <span className="config-card-source" data-mono="">{skill.filePath}</span>
    </div>
    {skill.content ? (
      <div className="config-doc-body">
        <Markdown remarkPlugins={[remarkGfm]}>{skill.content}</Markdown>
      </div>
    ) : (
      <p className="config-card-description">{skill.description}</p>
    )}
  </div>
);

const RuleDetail: FC<{ readonly rule: RuleEntry }> = ({ rule }) => {
  const segments = rule.filePath.split(/[/\\]/);
  const name = (segments[segments.length - 1] ?? rule.source).replace(/\.md$/, "");

  return (
    <div className="config-detail-content">
      <div className="config-detail-header">
        <span className="config-detail-title">{name}</span>
        <ScopeBadge scope={rule.scope} source={rule.source} />
      </div>
      <div className="config-card-section">
        <span className="config-card-section-label">Source</span>
        <span className="config-card-source" data-mono="">{rule.filePath}</span>
      </div>
      <div className="config-card-section">
        {rule.filePath.endsWith(".md") ? (
          <div className="config-doc-body">
            <Markdown remarkPlugins={[remarkGfm]}>{rule.text}</Markdown>
          </div>
        ) : (
          <p className="config-card-rule-text">{rule.text}</p>
        )}
      </div>
    </div>
  );
};

/// Format an ISO date string to a human-readable local date.
const formatDate = (iso: string): string => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

const PluginDetail: FC<{ readonly plugin: PluginInfo }> = ({ plugin }) => (
  <div className="config-detail-content">
    <div className="config-detail-header">
      <span className="config-detail-title">{plugin.name}</span>
      <ScopeBadge scope={plugin.scope} />
      <span className="config-card-meta" data-mono="">v{plugin.version}</span>
    </div>

    {plugin.description && (
      <p className="config-card-description">{plugin.description}</p>
    )}

    <div className="config-plugin-info">
      {plugin.homepage && (
        <div className="config-card-section">
          <span className="config-card-section-label">Homepage</span>
          <span className="config-card-source" data-mono="">{plugin.homepage}</span>
        </div>
      )}

      {plugin.installedAt && (
        <div className="config-card-section">
          <span className="config-card-section-label">Installed</span>
          <span className="config-card-source">{formatDate(plugin.installedAt)}</span>
        </div>
      )}

      {plugin.installPath && (
        <div className="config-card-section">
          <span className="config-card-section-label">Install Path</span>
          <span className="config-card-source" data-mono="">{plugin.installPath}</span>
        </div>
      )}
    </div>

    {plugin.readme && (
      <div className="config-card-section">
        <span className="config-card-section-label">Readme</span>
        <div className="config-doc-body">
          <Markdown remarkPlugins={[remarkGfm]}>{plugin.readme}</Markdown>
        </div>
      </div>
    )}

    {!plugin.readme && (
      <div className="config-card-section">
        <span className="config-card-section-label">Source</span>
        <span className="config-card-source" data-mono="">{plugin.filePath}</span>
      </div>
    )}
  </div>
);

const DocDetail: FC<{ readonly doc: DocFile }> = ({ doc }) => (
  <div className="config-detail-content">
    <div className="config-detail-header">
      <span className="config-card-source" data-mono="">{doc.filePath}</span>
      <ScopeBadge scope={doc.scope} />
    </div>
    <div className="config-doc-body">
      <Markdown remarkPlugins={[remarkGfm]}>{doc.content}</Markdown>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConfigDetailPanelProps {
  readonly selection: SelectedConfigItem | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConfigDetailPanel: FC<ConfigDetailPanelProps> = ({ selection }) => {
  if (selection === null) {
    return null;
  }

  const content = (() => {
    switch (selection.tag) {
      case "agent":
        return <AgentDetail agent={selection.agent} />;
      case "command":
        return <CommandDetail command={selection.command} />;
      case "hook":
        return <HookDetail hook={selection.hook} />;
      case "mcp":
        return <McpDetail server={selection.server} />;
      case "skill":
        return <SkillDetail skill={selection.skill} />;
      case "rule":
        return <RuleDetail rule={selection.rule} />;
      case "plugin":
        return <PluginDetail plugin={selection.plugin} />;
      case "doc":
        return <DocDetail doc={selection.doc} />;
    }
  })();

  return (
    <div className="config-viewer" role="region" aria-label="Configuration Detail">
      {content}
    </div>
  );
};

# Project Brief: Norbert

**Named after**: Norbert Wiener (father of cybernetics)

## Vision

A visualization dashboard for Claude Code users to observe, understand, and potentially control their complex agentic workflows and multi-agent orchestration systems.

## Problem Space

As Claude Code usage becomes more sophisticated — with frameworks like nwave-ai and other multi-agent systems — users lose visibility into what's actually happening inside their agentic orchestration. The complexity of nested agents, context files, token consumption, and task execution becomes opaque and hard to manage.

## Target Users

- Claude Code power users running complex multi-agent workflows
- Developers using frameworks like nwave-ai, custom agent orchestrators
- Teams wanting observability into AI-assisted development processes

## Initial Feature Ideas (Unvalidated)

- **Token usage visualization** — track and display token consumption across agents/tasks
- **Context file mapping** — "Which .claude or CLAUDE.md am I actually using right now?"
- **Agent/subagent topology** — visualize the tree/graph of agents and their relationships
- **Time tracking** — time spent per task, per agent
- **Task history** — searchable history of completed and in-progress tasks
- **Prompt effectiveness** — which prompts worked well vs. which didn't
- **Orchestration control** — ability to pause, redirect, or modify running workflows

## Open Questions

- What is the most painful visibility gap for power users today?
- Which features would drive adoption vs. which are nice-to-have?
- Is the primary value in observation (dashboard) or control (orchestration)?
- What's the right delivery model — CLI overlay, web dashboard, IDE extension, or something else?
- How does this integrate with Claude Code's existing architecture?
- What data is actually accessible from Claude Code's runtime?

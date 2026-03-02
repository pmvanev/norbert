# ADR-001: Modular Monolith with Dependency Inversion

## Status
Accepted

## Context
Norbert is a local-first observability tool for Claude Code. Quality attribute priorities: (1) time-to-market (solo developer), (2) maintainability (easy to extend). The system has a data pipeline nature (hooks -> processing -> storage -> display) with multiple query interfaces (web dashboard, CLI, future MCP server).

Team size: 1 developer. No independent deployment requirements. No scaling requirements beyond a single machine.

## Decision
Modular monolith with dependency inversion (ports-and-adapters). Seven packages in a pnpm workspace: core (pure domain), config, storage (port + adapter), server, cli, dashboard, hooks. All dependencies point inward toward core. Storage port enables adapter swapping.

## Alternatives Considered

### Alternative 1: Microservices (separate server, CLI, dashboard services)
- Overhead: Service communication, deployment orchestration, monitoring per service
- Team = 1 developer. No benefit from independent deployment.
- Rejection: Operational complexity unjustifiable for solo dev and local-only tool.

### Alternative 2: Monolith without module boundaries (single package)
- Ships fastest initially. Fewer configuration files.
- Maintainability degrades as features accumulate. Dashboard, CLI, and server logic couple.
- Rejection: Unacceptable for maintainability priority. Module boundaries prevent accidental coupling.

### Alternative 3: Pipe-and-filter architecture
- Natural fit for ingestion pipeline. Clean data flow.
- Does not model the interactive query interfaces (dashboard API, CLI commands).
- Rejection: Pipe-and-filter applies within the ingestion path only, not as the overall system style. Used internally within the server's event processing.

## Consequences
- Positive: Single deployment, fast development, clear module boundaries, testable in isolation, dependency inversion enables adapter swapping
- Positive: pnpm workspace enforces boundaries at package manager level
- Negative: More configuration than single-package (7 package.json files, TypeScript project references)
- Negative: Must discipline inter-package imports (mitigated by CI architecture tests)

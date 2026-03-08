# ADR-001: Architectural Style -- Modular Monolith with Ports-and-Adapters

## Status

Accepted

## Context

Norbert is a local-first desktop observability app for Claude Code. The product spec defines a plugin architecture (Phase 3) where core features and third-party extensions load as plugins against a NorbertAPI. The walking skeleton (Phase 0+1) must prove the data pipeline without plugin infrastructure, but its architecture must not require rewrite when plugins arrive.

**Business drivers**: Time-to-market (solo developer), maintainability (plugin architecture coming), reliability (no data loss), testability (TDD workflow).

**Constraints**: Solo developer. Desktop app (not distributed system). All data local. Walking skeleton scope is 4 stories, 6-10 days.

## Decision

Modular monolith with dependency inversion (ports-and-adapters). A single Tauri application with internal module boundaries enforced by Rust's module system and trait-based ports.

Modules: core (domain types), ports (traits), adapters (HTTP server, SQLite, settings merger), app (Tauri lifecycle/IPC), ui (React frontend).

## Alternatives Considered

### Microservices (separate hook server, separate UI server, separate DB service)

- Evaluated against: team size (1), deployment target (desktop app), operational complexity
- Rejection: Dramatically over-engineered for a single-user desktop app built by one developer. Adds IPC complexity, deployment surface, and debugging difficulty with zero benefit. Microservices are for independent team deployment -- neither condition applies.

### Layered architecture without ports-and-adapters

- Evaluated against: testability, maintainability, future plugin extraction
- Rejection: Layers without dependency inversion couple domain logic to infrastructure. When plugin architecture arrives in Phase 3, extracting the hook receiver or event store into plugin-accessible APIs would require untangling hardcoded dependencies. Ports-and-adapters adds minimal overhead (trait definitions) while preserving extraction options.

### Event-driven architecture with message broker

- Evaluated against: complexity budget, team size, local-first constraint
- Rejection: An in-process event bus adds indirection without benefit at this scale. The data flow is linear: HTTP POST -> validate -> write to SQLite -> notify UI. A message broker (even in-process) adds ordering concerns, dead letter handling, and debugging complexity for a pipeline that handles one event type at a time. If event-driven patterns become useful later (plugin event bus in Phase 3), they can be added without architectural rewrite.

## Consequences

**Positive**:
- Single binary deployment (Tauri bundles everything)
- Rust module system enforces boundaries at compile time
- Traits enable isolated unit testing of each adapter
- Module boundaries map to future plugin extraction points
- Minimal overhead for solo developer

**Negative**:
- All components share a process -- a crash in the HTTP server takes down the UI
- No independent scaling (irrelevant for desktop app)
- Discipline required to maintain port/adapter boundaries (Rust's type system helps)

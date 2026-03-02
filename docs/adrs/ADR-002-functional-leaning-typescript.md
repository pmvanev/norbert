# ADR-002: Functional-Leaning TypeScript Paradigm

## Status
Accepted

## Context
Norbert processes a stream of hook events through transformations (validate, normalize, enrich, aggregate) and serves query results. TypeScript supports both OOP and functional paradigms. The team (solo developer) needs to choose a consistent paradigm for the codebase.

The data flow is: raw hook event -> validated event -> domain event -> aggregated session/trace/cost data -> API response / terminal output. This is a pipeline of transformations over immutable data.

## Decision
Functional-leaning TypeScript with pure core / effect shell.

Specifics:
- **Types-first**: Define domain models as discriminated unions (algebraic data types) before implementation
- **Pure core**: Event processing, cost calculation, trace building, MCP analysis are pure functions (no side effects)
- **Effect shell**: HTTP server, SQLite operations, filesystem access are at adapter boundaries only
- **Function-signature ports**: Storage port defined as a record of function types, not a class interface
- **Result types**: Domain errors represented as return values (Result/Either pattern), not thrown exceptions
- **No class inheritance**: Composition through function composition and type composition
- **Immutable domain**: Event and session types are readonly; processing produces new values

## Alternatives Considered

### Alternative 1: Object-oriented TypeScript (classes, interfaces, inheritance)
- Familiar pattern for many developers. Rich IDE support for class navigation.
- Classes with mutable state complicate testing of event processing pipeline.
- OOP adapters (Repository pattern as class) add ceremony for a solo developer.
- Rejection: Pipeline nature of the system makes functional composition more natural. OOP adds unnecessary ceremony for data transformation logic.

### Alternative 2: Pure functional (fp-ts or Effect library)
- Maximum type safety. Monadic composition. Effect tracking.
- Steep learning curve. Heavy library dependency. Verbose for simple operations.
- Solo developer context: library overhead slows development without proportional benefit.
- Rejection: Too much ceremony for MVP. The functional-leaning approach gets 80% of the benefit at 20% of the complexity. Can adopt Effect for specific subsystems later if warranted.

## Consequences
- Positive: Pure core is trivially testable (input -> output, no mocking)
- Positive: Discriminated unions make hook event handling exhaustive and type-safe
- Positive: Immutable domain prevents subtle state mutation bugs
- Positive: Function composition maps naturally to the data pipeline
- Negative: Some TypeScript developers less familiar with functional patterns
- Negative: Result types add wrapping/unwrapping overhead compared to try/catch
- Negative: No established community convention for functional TypeScript project structure (less copy-paste from examples)

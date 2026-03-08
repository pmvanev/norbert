# ADR-004: Development Paradigm -- Functional-Leaning

## Status

Accepted

## Context

Norbert uses Rust (backend) and TypeScript/React (frontend). Both are multi-paradigm languages. The domain is event processing: receiving immutable hook events, transforming them, storing them, displaying derived data. The development workflow is TDD with a solo developer.

## Decision

Functional-leaning for both Rust and TypeScript. Not dogmatic FP -- idiomatic use of each language's functional features.

**Rust backend**:
- Traits as ports (dependency inversion via trait objects or generics)
- Result/Option types for error handling (no panics in production paths)
- Immutable data by default (Rust's ownership model enforces this naturally)
- Pure functions for data transformation (event validation, session aggregation)
- Effects at the boundary (HTTP handler, SQLite adapter)

**TypeScript frontend**:
- React functional components with hooks (no class components)
- Pure functions for data formatting and display logic
- Effects isolated to Tauri IPC invoke calls
- Immutable state updates (React's state model enforces this)

## Alternatives Considered

### Object-oriented with class hierarchies

- Evaluated against: domain fit, team preference, language idiom
- Rejection: Event processing is naturally a pipeline of transformations on immutable data. Class hierarchies add indirection (EventProcessor base class, ConcreteProcessor subclasses) without modeling the domain better than functions. Rust's idiomatic style is already functional-adjacent (traits, enums, pattern matching). React has moved entirely to functional components with hooks. OOP patterns would fight both languages' grain.

### Pure functional with algebraic effects / IO monad

- Evaluated against: team capability, ecosystem maturity, pragmatism
- Rejection: Rust does not have a mature algebraic effects ecosystem. TypeScript's FP libraries (fp-ts, Effect) add significant learning curve and bundle size for marginal benefit in a desktop app. Idiomatic functional-leaning code achieves the same testability and composability without the ceremony.

## Consequences

**Positive**:
- Aligns with both languages' idiomatic style
- Event processing maps naturally to transformation pipelines
- Pure core / effect shell pattern improves testability
- No framework overhead (no FP library dependencies)

**Negative**:
- "Functional-leaning" is less prescriptive than strict FP -- discipline required to maintain purity boundaries
- Some Rust patterns (mutable state for connection pools, Tauri app state) are inherently stateful and must be accepted

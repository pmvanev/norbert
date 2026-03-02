# ADR-004: Fastify as HTTP Server Framework

## Status
Accepted

## Context
Norbert Server handles two traffic patterns: (1) high-frequency hook event ingress (many small POST requests), (2) dashboard API queries (lower frequency GET requests). Schema validation of incoming hook events is critical -- malformed events should be rejected before processing.

## Decision
Fastify 5.

## Alternatives Considered

### Alternative 1: Express 4/5
- Most popular, largest middleware ecosystem. Every developer knows it.
- No built-in schema validation. Slower than Fastify (benchmarked ~2x slower for JSON serialization).
- TypeScript support is bolted on (DefinitelyTyped), not first-class.
- Rejection: Missing built-in schema validation means adding ajv or joi manually. Fastify includes this and is faster.

### Alternative 2: Hono
- Ultralight, fast, runs on multiple runtimes (Node, Bun, Deno, Cloudflare).
- Multi-runtime flexibility is unnecessary (we committed to Node.js in ADR-003).
- Smaller ecosystem and fewer plugins than Fastify.
- Rejection: Multi-runtime flexibility is not a driver. Fastify's plugin system and schema validation are more aligned with Norbert's needs.

### Alternative 3: No framework (raw http module)
- Zero dependencies. Maximum control.
- Must implement routing, content-type parsing, error handling, CORS from scratch.
- Rejection: Development time cost for reimplementing standard HTTP server concerns.

## Consequences
- Positive: Built-in JSON Schema validation for hook event ingress (reject malformed events at the boundary)
- Positive: Plugin system maps to modular architecture (ingress plugin, API plugin, WebSocket plugin)
- Positive: Fastest mainstream Node.js HTTP framework
- Positive: First-class TypeScript support
- Negative: Learning curve for Fastify-specific patterns (plugin encapsulation, decorators)
- Negative: Slightly less community content than Express

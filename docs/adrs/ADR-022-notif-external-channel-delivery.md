# ADR-022: External Channel Delivery -- lettre for SMTP, reqwest for Webhooks

## Status

Accepted

## Context

norbert-notif must deliver notifications to external channels: SMTP email and HTTP webhooks (e.g., Slack). Browser-based JavaScript cannot perform SMTP operations. Webhook delivery requires timeout control and TLS support. Both operations must be non-blocking relative to other notification channels.

**Quality attribute drivers**: Fault tolerance (channel isolation), maintainability (well-maintained libraries), time-to-market (proven crates).

**Constraints**: Rust backend required for SMTP. Async operation required for non-blocking delivery. Solo developer.

## Decision

Use `lettre` 0.11 (MIT) for SMTP email delivery and `reqwest` 0.12 (MIT/Apache-2.0) for webhook HTTP POST. Both are invoked from Tauri IPC commands in the Rust backend. Frontend initiates delivery via `invoke()`.

### SMTP (lettre)
- Supports PLAIN, LOGIN, XOAUTH2 authentication
- TLS and STARTTLS encryption
- Async transport via tokio (already in Cargo.toml)

### Webhook (reqwest)
- Async HTTP client with timeout control
- Default TLS support
- JSON body serialization via serde (already in Cargo.toml)
- 10-second timeout for webhook requests

## Alternatives Considered

### SMTP Alternatives

#### mail-send
- What: Newer Rust SMTP crate with simpler API.
- Expected impact: Slightly simpler code.
- Why insufficient: Fewer downloads (1/10th of lettre), smaller community, less battle-tested. For a notification system where reliability matters, `lettre` has a 7+ year track record.

#### Frontend fetch() to SMTP relay service
- What: Use a cloud SMTP relay (SendGrid, Mailgun) via REST API from frontend.
- Expected impact: No Rust code needed for email.
- Why insufficient: Introduces SaaS dependency and API key management. Violates local-first principle. Users' SMTP credentials should connect directly to their own servers.

### Webhook Alternatives

#### ureq (blocking HTTP)
- What: Simple synchronous HTTP client.
- Expected impact: Simpler code, no async complexity.
- Why insufficient: Blocking I/O would freeze the Tauri command handler during webhook timeouts. The 10-second webhook timeout would block all IPC for 10 seconds. `reqwest` with async avoids this.

#### hyper (low-level)
- What: Low-level HTTP library that reqwest is built on.
- Expected impact: Maximum control over HTTP behavior.
- Why insufficient: Requires building request construction, TLS handling, and timeout logic manually. `reqwest` provides all of this as high-level API. Solo developer cannot justify the effort.

## Consequences

**Positive**:
- Both crates are the most popular in their category in the Rust ecosystem
- Async operation prevents blocking during network timeouts
- `tokio` runtime already in Cargo.toml -- no new async runtime needed
- `serde_json` already in Cargo.toml -- webhook payload serialization is free
- Both MIT-licensed, compatible with project licensing

**Negative**:
- Two new Rust dependencies increase compile time
- `reqwest` pulls in significant transitive dependencies (hyper, http, h2)
- SMTP password storage requires separate credential management decision (see data-models.md)

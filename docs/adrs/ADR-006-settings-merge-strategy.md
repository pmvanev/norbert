# ADR-006: Settings Merge Strategy -- Surgical JSON Merge with Backup

## Status

Accepted

## Context

Norbert must register HTTP hooks in `~/.claude/settings.json` for Claude Code to send events. Users have existing configuration (MCP servers, permissions, custom settings) that must not be disturbed. This is the highest-anxiety moment in the user journey -- any data loss here destroys trust permanently.

**Constraints**: Must handle missing file, malformed JSON, and existing hook entries. Must be reversible.

## Decision

Read-backup-merge-write pattern:

1. Read `~/.claude/settings.json`
2. If file does not exist: create it with hook config only, skip backup
3. If file contains invalid JSON: do NOT modify, warn user, continue without hooks
4. If valid: write byte-identical backup to `~/.norbert/settings.json.bak`
5. Deep merge: add/update `hooks` key entries while preserving all other keys
6. Write merged JSON back to settings.json
7. If hooks already present with correct values: skip merge (idempotent)

Hook entries use `async: true` for non-blocking operation.

## Alternatives Considered

### Replace entire settings.json with Norbert's version

- Simplest implementation
- Rejection: Destroys all user configuration. Violates the core safety requirement. Unacceptable.

### Append-only strategy (add hooks section, never touch existing keys)

- Simpler than deep merge
- Rejection: Cannot handle the case where user already has a `hooks` key with their own entries. Append would create duplicate keys (invalid JSON) or overwrite user's hooks. Deep merge preserves both Norbert's and user's hook entries.

### Instruct user to manually edit settings.json

- Zero risk of data loss
- Rejection: Violates zero-config install goal. Manual JSON editing is error-prone and creates friction that prevents adoption. The JTBD analysis identifies this as the primary anxiety point -- automating it with safety guarantees (backup, validation, idempotency) is the correct design.

## Consequences

**Positive**:
- User's existing configuration completely preserved
- Byte-identical backup enables manual recovery
- Invalid JSON detected and reported without corruption
- Idempotent: safe to run multiple times
- Missing file handled gracefully

**Negative**:
- Deep merge logic must handle edge cases (nested objects, arrays, conflicting keys)
- Backup location (~/.norbert/) must exist before backup (handled by app initialization)
- User must restart running Claude Code sessions after merge (notification displayed)

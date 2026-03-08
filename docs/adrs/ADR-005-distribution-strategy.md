# ADR-005: Distribution Strategy -- npx from GitHub with postinstall Binary Download

## Status

Accepted

## Context

Norbert must be installable with a single command by Claude Code developers who universally have Node.js installed. The Tauri architecture requires platform-specific binaries. The walking skeleton targets Windows 11 x64 only.

## Decision

Distribute via `npx github:pmvanev/norbert-cc`. The npm package contains a `postinstall` script that detects the platform (win32-x64), downloads the pre-built Tauri binary from GitHub Releases, and extracts it to `~/.norbert/bin/`. The binary is built by GitHub Actions on version tag push using `tauri-apps/tauri-action`.

## Alternatives Considered

### curl-pipe-sh install script

- Single line in README, no npm dependency
- Rejection: Requires platform detection in shell script (fragile). Less familiar than npm to the Node.js developer target audience. npm provides dependency management, versioning, and update paths for free.

### Publish to npm registry immediately

- `npx norbert-cc` (shorter command, no github: prefix)
- Rejection: Requires reserving package name, setting up npm org, and maintaining published package from day one. `npx github:` sources directly from the repo with zero registry overhead. Promotion to npm registry is a one-command change when ready for wider distribution.

### Manual binary download from GitHub Releases

- User downloads .tar.gz, extracts manually
- Rejection: Multiple manual steps. Violates zero-friction install goal. Acceptable as fallback but not primary distribution.

## Consequences

**Positive**:
- Single command install for target audience
- No npm registry dependency during early development
- Platform detection handled automatically by postinstall
- GitHub Actions builds are free for public repos
- Upgrade path to `npx norbert-cc` is trivial when ready

**Negative**:
- `npx github:` is slightly slower than registry (clones repo)
- postinstall must handle download failures gracefully
- Binary not signed initially (Windows SmartScreen warning -- acceptable for dev-audience early stage)

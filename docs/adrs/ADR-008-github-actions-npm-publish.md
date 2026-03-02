# ADR-008: GitHub Actions with npm Publish for Local-First Tool

## Status
Proposed

## Context
Norbert is a local-first npm package with no cloud infrastructure. The platform must validate cross-platform compatibility (macOS, Linux, Windows), enforce quality gates (typecheck, lint, test, coverage, security, mutation testing), and automate npm publishing with provenance.

The project is greenfield with no existing CI/CD configuration. The deployment target is the npm registry (not a cloud environment, container registry, or server infrastructure).

## Decision
GitHub Actions as the sole CI/CD platform with three workflows:

1. **ci.yml** -- PR and push-to-main quality gates with cross-platform matrix (ubuntu, macos, windows)
2. **release.yml** -- Cross-platform validation and npm publish with provenance on GitHub Release
3. **mutation.yml** -- Per-feature mutation testing (Stryker) on push to main, scoped to modified files

Release management via Changesets (automated version bumps and CHANGELOG generation). Semantic versioning with squash-merge to main (GitHub Flow branching).

## Alternatives Considered

### Alternative 1: CircleCI or GitLab CI
- Additional vendor dependency beyond GitHub.
- GitHub Actions is native to the GitHub repository, free for public repos, and provides macOS/Windows runners natively.
- Rejection: No advantage over GitHub Actions for this project; adds vendor complexity.

### Alternative 2: Self-hosted runners
- Full control over runner environment.
- Unnecessary for a public open-source project. GitHub-hosted runners provide all three target platforms.
- Rejection: Maintenance overhead for zero benefit.

### Alternative 3: Release via GitHub Packages (npm)
- Keeps everything within GitHub ecosystem.
- npm registry is the standard distribution channel for Node.js CLI tools. Users expect `npm install -g norbert`, not GitHub Packages configuration.
- Rejection: Friction for end users; npm registry is the correct distribution target.

### Alternative 4: Manual npm publish from developer machine
- Simplest possible approach.
- Cannot validate cross-platform behavior. Solo developer on macOS cannot test Windows. No enforcement of quality gates before publish.
- Rejection: Insufficient for a cross-platform tool with native dependencies (better-sqlite3).

## Consequences

### Positive
- Zero infrastructure cost (GitHub Actions free tier for public repos)
- Native integration with GitHub (PR checks, Dependabot, CodeQL, branch protection)
- Cross-platform matrix testing validates macOS, Linux, and Windows on every PR
- npm provenance links published packages to specific GitHub Actions builds
- Changesets automates the tedious version bump and changelog workflow

### Negative
- Vendor lock-in to GitHub Actions (acceptable for this project; workflows are portable to other CI systems)
- macOS runners are 2-3x slower than Linux (mitigated by running full suite on Linux first, platform-specific tests only on macOS/Windows)
- Free tier has usage limits (2,000 minutes/month for private repos; unlimited for public)

## Evidence
- GitHub Actions is the most commonly used CI/CD platform for npm packages (npm ecosystem standard)
- npm provenance is natively supported only in GitHub Actions and GitLab CI
- Cross-platform matrix testing is a first-class feature of GitHub Actions
- Changesets is the standard versioning tool for pnpm monorepos

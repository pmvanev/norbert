# Platform Architecture: Norbert Observatory

**Feature ID**: norbert
**Architect**: Apex (Platform Architect)
**Date**: 2026-03-02
**Status**: DRAFT -- pending peer review

---

## 1. Platform Context

Norbert is a **local-first npm CLI tool and web dashboard**. There is no cloud deployment, no container orchestration in production, and no server infrastructure to manage. The "platform" for Norbert is the **build, test, and release pipeline** that ensures quality across three operating systems and delivers the package to the npm registry.

### 1.1 Deployment Topology

```
Developer Machine (development)
  |
  | git push
  v
GitHub Actions (CI/CD)
  |
  |-- PR workflow: lint, typecheck, test, security scan, mutation test
  |-- Release workflow: build, cross-platform validate, npm publish
  |
  v
npm Registry (distribution)
  |
  | npm install -g norbert
  v
End User Machine (production = user's localhost)
```

There are exactly **two environments**: the CI runner and the user's machine. There is no staging, no production server, no container registry.

### 1.2 Simplest Solution Check

**Proposed approach**: GitHub Actions CI/CD with npm publish.

#### Rejected Simpler Alternatives

**Alternative 1: Manual npm publish from developer machine**
- What: Developer runs `npm publish` locally after manual testing.
- Expected impact: Meets 60% of requirements (publish works, no cross-platform validation).
- Why insufficient: Solo developer on macOS cannot validate Windows/Linux behavior. No quality gates enforce standards as the project grows. Manual process is error-prone and non-repeatable.

**Alternative 2: GitHub Actions for tests only, manual publish**
- What: CI runs tests on PRs, but publish remains a manual local step.
- Expected impact: Meets 80% of requirements (cross-platform tests, quality gates).
- Why insufficient: Release process is not repeatable. Version bumps and changelog generation become tedious manual work. Risk of publishing without passing all quality gates.

**Selected**: Full GitHub Actions with automated test gates and automated npm publish on tagged releases. This is the simplest approach that meets all requirements: cross-platform validation, quality enforcement, and repeatable releases.

### 1.3 Platform Requirements (Extracted from Architecture)

| Requirement | Source | Quantitative Target |
|-------------|--------|---------------------|
| Cross-platform compatibility | ADR-007, architecture-design | macOS, Linux, Windows -- all three must pass CI |
| TypeScript strict mode | technology-stack | Zero type errors (`noEmit` check) |
| Test coverage | CLAUDE.md paradigm | >= 80% unit coverage (pure core focus) |
| Mutation test kill rate | Configuration | >= 80% per-feature, scoped to modified files |
| Security scanning | Shift-left principle | Zero critical/high in SAST + SCA |
| npm package quality | Distribution target | Clean build, no dev-only files in package |
| Dashboard bundle | technology-stack | SvelteKit static build bundled into package |
| Native addon compatibility | better-sqlite3 dependency | Prebuilt binaries resolve on all 3 platforms |

### 1.4 DORA Metrics Targets (Baseline for Greenfield)

| Metric | Initial Target | Rationale |
|--------|---------------|-----------|
| Deployment frequency | Weekly during active development | Solo developer, 5 phases over ~5 weeks |
| Lead time for changes | < 1 day | PR merged to npm publish within same day |
| Change failure rate | < 15% | Quality gates catch issues before publish |
| Time to restore | < 1 hour | npm unpublish + republish previous version |

These targets align with "High" performance per Accelerate benchmarks, appropriate for a solo developer greenfield project.

---

## 2. Build Infrastructure

### 2.1 Monorepo Build Strategy

The pnpm workspace contains 7 packages with dependency ordering:

```
Build Order (topological sort):
  1. @norbert/core          (zero deps -- builds first)
  2. @norbert/config         (zero deps -- builds first, parallel with core)
  3. @norbert/storage        (depends on core)
  4. @norbert/hooks          (depends on config)
  5. @norbert/server         (depends on core, storage, config)
  6. @norbert/cli            (depends on core, storage, config)
  7. @norbert/dashboard      (independent build -- parallel, builds last due to size)
```

**Build tools**:
- `tsup` for server-side packages (core, config, storage, server, cli, hooks) -- zero-config TypeScript bundler, ESM output
- `vite` for dashboard (SvelteKit static build)
- `pnpm --filter` for targeted package builds
- `pnpm -r run build` for full workspace build with topological ordering

### 2.2 Package Composition for npm Publish

The published npm package bundles all 7 packages into a single distributable:

```
norbert (npm package)
  bin/
    norbert.js          -- CLI entry point (from @norbert/cli)
  dist/
    core/               -- Compiled @norbert/core
    config/             -- Compiled @norbert/config
    storage/            -- Compiled @norbert/storage
    server/             -- Compiled @norbert/server (includes static dashboard assets)
    hooks/              -- Compiled @norbert/hooks
  dashboard/            -- Static SvelteKit build (HTML, JS, CSS)
  package.json          -- Root package with bin entry, dependencies, engines
```

**Critical**: The `better-sqlite3` native addon is declared as a production dependency. It uses prebuilt binaries (via `prebuild-install`) so end users do not need a C++ compiler. The CI matrix validates this resolves correctly on all three platforms.

### 2.3 Architecture Enforcement in CI

The following checks run on every PR to enforce module boundaries:

1. **Zero-dependency core check**: Verify `packages/core/package.json` has zero entries in `dependencies`.
2. **Dashboard isolation check**: Verify `packages/dashboard/package.json` has no `@norbert/*` runtime dependencies.
3. **Circular dependency check**: Run `madge --circular packages/` to detect circular imports.
4. **Import boundary check**: TypeScript project references (`tsconfig.json` per package) with `composite: true` enforce compile-time import boundaries.

---

## 3. Quality Gate Definitions

### 3.1 PR Quality Gates (Commit Stage -- target: < 10 minutes)

| Gate | Tool | Threshold | Fail Action |
|------|------|-----------|-------------|
| TypeScript strict typecheck | `tsc --noEmit` | Zero errors | Block merge |
| Lint | ESLint 9 + typescript-eslint | Zero errors, zero warnings on changed files | Block merge |
| Format | Prettier 3 (check mode) | All files formatted | Block merge |
| Unit tests | Vitest | 100% pass rate | Block merge |
| Unit coverage | Vitest + v8 | >= 80% lines on @norbert/core, >= 70% overall | Block merge |
| Security: SAST | CodeQL (GitHub native) | Zero critical/high | Block merge |
| Security: SCA | `npm audit` / Dependabot | Zero critical | Block merge |
| Security: secrets | Gitleaks (pre-commit + CI) | Zero findings | Block merge |
| Build | `pnpm -r run build` | All 7 packages compile | Block merge |
| Architecture | Custom script (zero-dep core, no circular) | All checks pass | Block merge |

### 3.2 PR Quality Gates (Acceptance Stage -- target: < 15 minutes, parallel with commit)

| Gate | Tool | Threshold | Fail Action |
|------|------|-----------|-------------|
| Cross-platform build | GitHub Actions matrix (ubuntu, macos, windows) | All 3 pass | Block merge |
| Integration tests | Vitest (test files tagged `*.integration.test.ts`) | 100% pass rate | Block merge |
| E2E smoke test | Custom script: global install, `norbert init`, verify health | Pass on all 3 platforms | Block merge |
| Dashboard build | `vite build` for SvelteKit | Zero errors, bundle size < 500KB | Block merge |

### 3.3 Post-Merge Quality Gates (per-feature mutation testing)

| Gate | Tool | Threshold | Fail Action |
|------|------|-----------|-------------|
| Mutation testing | Stryker Mutator | >= 80% kill rate on modified files | Advisory (block release if persistent) |

Mutation testing runs after merge on the main branch, scoped to files modified in the merged PR. Runtime target: 5-15 minutes. Results posted as PR comment on the merge commit.

### 3.4 Release Quality Gates (before npm publish)

| Gate | Tool | Threshold | Fail Action |
|------|------|-----------|-------------|
| Full test suite | Vitest (all: unit + integration) | 100% pass rate, all 3 platforms | Block release |
| Full mutation test | Stryker (all modified since last release) | >= 80% kill rate | Block release |
| Package validation | `npm pack --dry-run` | No dev files, correct bin entry, < 10MB package | Block release |
| Changelog | Changesets | Changelog entry exists for version | Block release |
| SBOM generation | Syft | SPDX SBOM generated and attached to release | Advisory |

---

## 4. Dependency Management

### 4.1 Strategy

- **Dependabot** enabled for automated dependency update PRs (weekly schedule)
- **Renovate** as alternative if finer control needed (group minor updates, auto-merge patches)
- `pnpm audit` runs in CI on every PR to catch known vulnerabilities
- `better-sqlite3` pinned to major version with explicit cross-platform validation before bumps

### 4.2 Lock File

- `pnpm-lock.yaml` committed to repository
- CI installs with `pnpm install --frozen-lockfile` (fails if lock file is outdated)
- Lock file changes reviewed in PRs to detect unexpected dependency additions

### 4.3 Node.js Version

- `.node-version` file specifying `20` (LTS)
- CI uses `actions/setup-node@v4` with the `.node-version` file
- `engines` field in root `package.json`: `"node": ">=20.0.0"`

---

## 5. Release Infrastructure

### 5.1 Versioning

**Semantic Versioning** (semver) managed by **Changesets**:

- Each PR includes a changeset file describing the change type (patch/minor/major)
- `@changesets/cli` automates version bumps and CHANGELOG generation
- Version bump PR created automatically by Changesets GitHub Action
- Single version across all workspace packages (fixed versioning -- all packages share version)

### 5.2 Release Channels

| Channel | npm Tag | Trigger | Purpose |
|---------|---------|---------|---------|
| Stable | `latest` | GitHub Release (tag `v*.*.*`) | Production releases |
| Beta | `beta` | Manual workflow dispatch or tag `v*.*.*-beta.*` | Early adopter testing |
| Next | `next` | Push to `main` (optional, disabled initially) | Continuous pre-release |

Initial setup uses **Stable only**. Beta channel added when user base grows.

### 5.3 Release Workflow

```
1. Developer creates PR with changeset file
2. PR passes all quality gates, merged to main
3. Changesets bot creates "Version Packages" PR
   - Bumps version in all package.json files
   - Updates CHANGELOG.md
4. Maintainer reviews and merges Version Packages PR
5. GitHub Release created (manually or via automation)
6. Release workflow triggers:
   a. Full test suite on all 3 platforms
   b. Build all packages
   c. npm publish with provenance (--provenance flag)
   d. SBOM generated and attached to GitHub Release
   e. GitHub Release notes auto-populated from changelog
```

### 5.4 npm Publish Security

- **npm provenance** enabled (`--provenance` flag) -- links published package to specific GitHub Actions build
- **npm 2FA** on publish (configured on npmjs.com account)
- **NPM_TOKEN** stored as GitHub Actions encrypted secret
- **GITHUB_TOKEN** used for provenance attestation (automatic in GitHub Actions)
- No secrets in source code -- Gitleaks enforces

### 5.5 Rollback Procedure

**Rollback-first design** (every release has a tested rollback path):

1. **Immediate rollback**: `npm unpublish norbert@{broken-version}` within 72 hours (npm policy) + `npm dist-tag add norbert@{previous-version} latest`
2. **Post-72-hour rollback**: Publish new patch version with reverted code
3. **Database migration rollback**: Forward-only migrations (per data-models.md). If a migration causes issues, a new migration is published to reverse it.
4. **User-side rollback**: `npm install -g norbert@{previous-version}` always works since npm retains all published versions

**Rollback validation**: The release workflow includes a post-publish smoke test that installs the just-published version globally and runs `norbert --version` + `norbert init --dry-run`. If this fails, the release is flagged for manual review.

---

## 6. Developer Experience

### 6.1 Pre-commit Hooks (Local Quality Gates)

**Husky** + **lint-staged** for fast local feedback:

```
Pre-commit:
  - lint-staged:
      "*.ts": ["eslint --fix", "prettier --write"]
      "*.svelte": ["eslint --fix", "prettier --write"]
  - Gitleaks (secrets scan on staged files)

Pre-push:
  - pnpm run typecheck (full workspace tsc --noEmit)
```

### 6.2 Development Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm -r run build` | Build all packages (topological order) |
| `pnpm --filter @norbert/core test` | Run tests for a specific package |
| `pnpm test` | Run all tests across workspace |
| `pnpm run typecheck` | TypeScript strict check across workspace |
| `pnpm run lint` | ESLint across workspace |
| `pnpm run format` | Prettier format all files |
| `pnpm --filter @norbert/dashboard dev` | Start dashboard in dev mode (HMR) |
| `pnpm --filter @norbert/server dev` | Start server with watch mode (nodemon/tsx) |
| `pnpm run e2e` | Run E2E smoke test locally |

### 6.3 Editor Configuration

- `.editorconfig` for consistent whitespace/encoding
- `.vscode/settings.json` with recommended ESLint + Prettier config
- `.vscode/extensions.json` recommending: ESLint, Prettier, Svelte for VS Code

---

## 7. Cross-Platform Concerns

### 7.1 CI Matrix

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node-version: [20]
```

All quality gates must pass on all three platforms.

### 7.2 Platform-Specific Risks

| Risk | Platform | Mitigation |
|------|----------|------------|
| `better-sqlite3` native addon | Windows | Prebuilt binaries via `prebuild-install`. CI validates install on Windows. |
| File path separators | Windows | Node.js `path` module used everywhere. No hardcoded `/` in file paths. |
| Hook script execution | Windows | Hooks implemented as Node.js scripts (not bash). ADR-007 confirms this decision. |
| SQLite file locking | Windows | WAL mode + single-writer pattern. CLI reads use `PRAGMA journal_mode=wal`. |
| Line endings | All | `.gitattributes` with `* text=auto` + `*.ts text eol=lf` |
| Shell differences in CI | Windows | GitHub Actions `shell: bash` on all platforms for consistency. |

### 7.3 E2E Smoke Test (Cross-Platform)

A minimal smoke test validates the entire install-to-first-event pipeline:

```
1. npm install -g <path-to-package-tarball>
2. norbert --version (validates CLI entry point)
3. norbert init --dry-run (validates config, hook generation, port check)
4. Start norbert server in background
5. POST test event to localhost:{port}/api/events
6. norbert status (validates event was captured)
7. Shutdown server
8. npm uninstall -g norbert (clean up)
```

This runs on all three platforms in CI.

---

## 8. Security Pipeline

### 8.1 Security Stages

| Stage | What | Tool | When |
|-------|------|------|------|
| Pre-commit | Secrets detection on staged files | Gitleaks | Every commit (local) |
| PR - SAST | Static application security testing | GitHub CodeQL | Every PR |
| PR - SCA | Dependency vulnerability scan | `pnpm audit` + Dependabot alerts | Every PR |
| PR - Secrets | Full repo secrets scan | Gitleaks (CI action) | Every PR |
| Release - SBOM | Software Bill of Materials | Syft (CycloneDX format) | Every release |
| Release - Provenance | npm provenance attestation | npm CLI `--provenance` | Every release |

### 8.2 Security Posture (Local-First Tool)

Norbert has a reduced attack surface compared to cloud services:

- **No network exposure**: Server binds to `127.0.0.1` only
- **No authentication**: Local trust boundary (same user on same machine)
- **No secrets in code**: All configuration in `~/.norbert/config.json`
- **No data exfiltration**: Data never leaves the machine
- **Supply chain**: SBOM + provenance + dependency scanning mitigate npm supply chain risk

The primary security concern is **supply chain integrity** (malicious dependency injection). This is addressed by:
1. Dependabot alerts for known vulnerabilities
2. `pnpm audit` in CI
3. Lock file review in PRs
4. SBOM generation for transparency
5. npm provenance linking package to GitHub build

---

## 9. Platform ADR: ADR-008 -- GitHub Actions with npm Publish for Local-First Tool

### Status
Proposed

### Context
Norbert is a local-first npm package with no cloud infrastructure. The platform must validate cross-platform compatibility, enforce quality gates, and automate npm publishing.

### Decision
GitHub Actions as sole CI/CD platform. No container registry, no cloud deployment, no infrastructure-as-code beyond workflow files. Release via npm publish with provenance from tagged GitHub Releases.

### Alternatives Considered
1. **CircleCI / GitLab CI**: Additional vendor dependency. GitHub Actions is native to GitHub repository, free for public repos, and sufficient for this workload.
2. **Self-hosted runners**: Unnecessary for public open-source project. GitHub-hosted runners provide all three target platforms.
3. **Release via GitHub Packages**: Adds complexity. npm registry is the standard distribution channel for Node.js tools.

### Consequences
- Positive: Zero infrastructure cost (GitHub Actions free tier for public repos)
- Positive: Native integration with GitHub (PR checks, Dependabot, CodeQL)
- Positive: Cross-platform matrix testing built-in
- Positive: npm provenance supported natively
- Negative: Vendor lock-in to GitHub (acceptable for this project)
- Negative: macOS runners are slower (2-3x vs Linux) -- mitigated by running platform-specific tests only

---

## 10. Requirements Traceability

| Platform Requirement | Architecture Source | Deliverable |
|---------------------|-------------------|-------------|
| Cross-platform CI matrix | ADR-007 (Node.js hooks for Windows) | ci-cd-pipeline.md, workflow skeleton |
| Quality gates (coverage, lint, typecheck) | technology-stack (Vitest, ESLint, Prettier) | ci-cd-pipeline.md |
| Mutation testing per-feature | Configuration (>= 80% kill rate) | ci-cd-pipeline.md |
| npm publish automation | Deployment target (npm package) | platform-architecture.md (this doc) |
| Module boundary enforcement | component-boundaries (zero-dep core) | ci-cd-pipeline.md |
| Structured logging | architecture-design (section 9.3) | observability-design.md |
| GitHub Flow branching | Configuration | branching-strategy.md |
| Rollback procedure | Rollback-first principle | platform-architecture.md (section 5.5) |
| Security scanning | Shift-left principle | platform-architecture.md (section 8) |

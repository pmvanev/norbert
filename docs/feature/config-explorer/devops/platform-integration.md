# Platform Integration: Config Explorer

**Feature ID**: config-explorer
**Architect**: Apex (Platform Architect)
**Date**: 2026-03-03
**Status**: DRAFT -- pending peer review
**Baseline**: Norbert DEVOPS infrastructure (see `docs/feature/norbert/devops/`)

---

## 1. Integration Summary

Config Explorer introduces one new package (`@norbert/config-explorer`) and extends two existing packages (`@norbert/server`, `@norbert/dashboard`). It adds no new services, databases, containers, or infrastructure. All existing CI/CD workflows, branching strategy, release pipeline, and observability apply without structural changes.

This document covers ONLY incremental concerns. For baseline infrastructure, see:
- `docs/feature/norbert/devops/platform-architecture.md` -- build, release, rollback, security
- `docs/feature/norbert/devops/ci-cd-pipeline.md` -- workflow structure, quality gates, caching
- `docs/feature/norbert/devops/observability-design.md` -- logging, health checks, SLOs
- `docs/feature/norbert/devops/branching-strategy.md` -- GitHub Flow, PR workflow, release process

---

## 2. CI/CD Integration

### 2.1 What Changes

**Nothing structural.** The three existing workflows (`ci.yml`, `release.yml`, `mutation.yml`) require zero modifications to their YAML files. Config Explorer is absorbed automatically because:

1. **pnpm workspace wildcard**: `pnpm-workspace.yaml` uses `packages/*`. Adding `packages/config-explorer/` is discovered automatically by pnpm.
2. **Workspace-wide commands**: CI steps use `pnpm -r run build`, `pnpm run test:unit`, `pnpm run lint`, and `pnpm run typecheck`. These already iterate all workspace packages. A new package with a `build` script, Vitest tests, and TypeScript config participates automatically.
3. **Cross-platform matrix**: The existing `os: [ubuntu-latest, macos-latest, windows-latest]` matrix covers Config Explorer's cross-platform path handling concerns.
4. **Mutation testing file discovery**: The `mutation.yml` workflow uses `git diff --name-only HEAD~1 HEAD -- 'packages/*/src/**/*.ts'`. The glob `packages/*/src/**/*.ts` matches `packages/config-explorer/src/**/*.ts` without changes.

### 2.2 Architecture Enforcement Extension

The existing `scripts/check-architecture.ts` must be extended with two new checks:

**New check**: `@norbert/config-explorer` has zero `@norbert/*` dependencies.
- Verify `packages/config-explorer/package.json` has no `@norbert/*` entries in `dependencies` or `devDependencies`.
- Same enforcement pattern as the existing zero-dependency check for `@norbert/core`.

**New check**: `@norbert/config-explorer` source files contain no `@norbert/*` imports.
- Scan `packages/config-explorer/src/**/*.ts` for import statements referencing `@norbert/`.
- Ensures the boundary rule (zero outbound dependencies to other Norbert packages) holds.

**Existing checks unaffected**:
- Core zero-dependency check: unchanged.
- Dashboard isolation check: unchanged (dashboard still has no `@norbert/*` runtime dependencies).
- Circular dependency check (`madge --circular`): unchanged -- the new package is a leaf node.

### 2.3 Coverage Gate

The existing coverage gate checks core coverage (>= 80%) and overall coverage (>= 70%). Config Explorer's pure functions in `@norbert/config-explorer` increase the overall code volume but do not change the gate thresholds. The per-package coverage for `@norbert/config-explorer` is not gated separately in CI; it is included in the overall aggregate.

**Recommended practice**: The `@norbert/config-explorer` package should target >= 80% unit coverage since it contains exclusively pure functions, matching the `@norbert/core` standard. This is not enforced as a separate CI gate but is a team expectation.

---

## 3. Build Pipeline

### 3.1 Build Order Update

Config Explorer adds one node to the topological build graph:

```
Build Order (topological sort):
  1. @norbert/core              (zero deps -- builds first)
  2. @norbert/config            (zero deps -- parallel with core)
  3. @norbert/config-explorer   (zero @norbert/* deps -- parallel with core and config)
  4. @norbert/storage           (depends on core)
  5. @norbert/hooks             (depends on config)
  6. @norbert/server            (depends on core, storage, config, config-explorer)
  7. @norbert/cli               (depends on core, storage, config)
  8. @norbert/dashboard         (independent build -- parallel, builds last due to size)
```

`@norbert/config-explorer` builds in parallel with `@norbert/core` and `@norbert/config` since it has zero `@norbert/*` dependencies. This adds no serial build time to the pipeline.

### 3.2 Build Tool

`tsup` (existing) builds the config-explorer package to ESM output, matching the pattern used by core, config, storage, server, cli, and hooks.

### 3.3 Package Composition for npm Publish

The published npm package gains one additional compiled directory:

```
norbert (npm package)
  dist/
    config-explorer/    -- Compiled @norbert/config-explorer (NEW)
    core/               -- Compiled @norbert/core
    config/             -- Compiled @norbert/config
    storage/            -- Compiled @norbert/storage
    server/             -- Compiled @norbert/server
    hooks/              -- Compiled @norbert/hooks
  ...
```

The `@norbert/config-explorer` package is bundled with the server (not published as a standalone npm package). picomatch and gray-matter become production dependencies in the published package.

### 3.4 Impact on Pipeline Duration

The config-explorer package contains pure functions with no native addon compilation. Estimated build time: < 5 seconds. Impact on commit stage target (< 8 minutes): negligible. Impact on cross-platform stage target (< 12 minutes): negligible.

---

## 4. Test Strategy in CI

### 4.1 Pure Function Testing

Config Explorer's parser functions are pure: string in, typed model out. These tests require no filesystem access, no server, and no database. They run as standard Vitest unit tests and are discovered automatically by the existing `pnpm run test:unit` command.

**Test file patterns** (all in `packages/config-explorer/`):
- `src/**/*.test.ts` -- unit tests for classifier, parser, resolver, matcher, extractor
- No `*.integration.test.ts` files needed in the config-explorer package itself

### 4.2 Filesystem Adapter Testing

The filesystem adapter (`packages/server/src/api/config-file-reader.ts`) is the integration boundary. Two testing strategies:

**Unit tests (mock filesystem)**: The adapter implements `ConfigFileReaderPort`. Tests inject a fake implementation that returns synthetic file data. These tests validate that the server correctly calls the pure parser functions and assembles API responses. These run on all platforms via the existing cross-platform matrix.

**Integration tests (real filesystem)**: A small set of integration tests create a temporary `.claude/` directory structure, run the actual filesystem adapter, and verify file discovery. These tests run in the cross-platform CI matrix to validate path handling on Windows, macOS, and Linux.

### 4.3 Cross-Platform Path Concerns in CI

Config Explorer reads `~/.claude/` (via `os.homedir()`) and `.claude/` (via `process.cwd()`). The CI environment does not have a real `~/.claude/` directory.

**Strategy**: Integration tests create a temporary directory structure and configure the adapter to read from it, not from the real home directory. The `ConfigFileReaderPort` design enables this injection. No CI environment variable or special configuration needed.

**Platform-specific path separators**: All path operations use `path.join()` and `path.resolve()`. Display paths normalize to forward slashes. The cross-platform CI matrix validates this works on Windows (backslash filesystem) and Unix (forward slash).

**Managed settings paths**: Platform-specific managed settings paths (`/Library/Application Support/ClaudeCode/` on macOS, `C:\Program Files\ClaudeCode\` on Windows) are not present in CI environments. The adapter's graceful degradation (return empty scope with warning) is validated by unit tests with the mock filesystem port.

### 4.4 Dashboard Component Testing

New Svelte components for Config Explorer views (`ConfigAtlas.svelte`, `ConfigGalaxy.svelte`, etc.) follow the same testing pattern as existing dashboard components: mock API responses, verify rendering. No new dashboard testing infrastructure needed.

---

## 5. Mutation Testing Scope

### 5.1 Primary Mutation Targets

The `@norbert/config-explorer` package contains exclusively pure functions -- the ideal mutation testing target. These files are the highest-value mutation targets:

| File | Why High Value |
|------|---------------|
| `file-classifier.ts` | Mapping logic -- mutations can silently misclassify files |
| `content-parser.ts` | Parsing edge cases -- mutations can produce incorrect parsed structures |
| `precedence-resolver.ts` | Complex business rules -- mutations can invert override order |
| `cross-ref-extractor.ts` | Relationship detection -- mutations can miss or fabricate edges |
| `glob-matcher.ts` | Pattern matching -- mutations can alter match semantics |
| `conflict-detector.ts` | Conflict logic -- mutations can miss naming conflicts |
| `search-index.ts` | Matching logic -- mutations can alter search results |

### 5.2 Automatic Inclusion

The existing `mutation.yml` workflow discovers modified files via `git diff --name-only HEAD~1 HEAD -- 'packages/*/src/**/*.ts'`. Files in `packages/config-explorer/src/` are included automatically when modified. No workflow changes needed.

### 5.3 Stryker Configuration

The existing `stryker.config.mjs` `mutate` array targets `packages/core/src/**/*.ts` as the default scope. When Config Explorer is mature, consider extending the default scope to include `packages/config-explorer/src/**/*.ts`:

```javascript
mutate: [
  'packages/core/src/**/*.ts',
  'packages/config-explorer/src/**/*.ts',  // Add after Phase 01 complete
  '!packages/*/src/**/*.test.ts',
  '!packages/*/src/**/*.spec.ts',
  '!packages/*/src/**/index.ts'
]
```

This is a configuration change to `stryker.config.mjs`, not a workflow change. The per-feature `--mutate` flag in `mutation.yml` overrides this array anyway for post-merge runs, so the immediate impact is on the release-gate full mutation run only.

### 5.4 Kill Rate Expectation

Config Explorer's pure functions should achieve >= 80% kill rate (the project standard). Given that all functions are pure with no side effects, the kill rate for this package should be among the highest in the monorepo.

---

## 6. Dependency Management

### 6.1 New Dependencies

| Dependency | Version | License | Type | Weekly Downloads |
|-----------|---------|---------|------|------------------|
| picomatch | ^4.0.0 | MIT | Production | 75M+ |
| gray-matter | ^4.0.0 | MIT | Production | 51M+ |

### 6.2 License Compliance

Both dependencies use the MIT license. The existing Norbert dependency set is entirely MIT/ISC/Apache-2.0. No license compliance concern is introduced.

The existing `pnpm audit` step in CI and Dependabot configuration cover these dependencies automatically. No new license checking tooling is needed.

### 6.3 Vulnerability Scanning

Both dependencies are scanned automatically by the existing pipeline:

- **Dependabot**: Monitors all `package.json` files in the workspace, including `packages/config-explorer/package.json`.
- **`pnpm audit`**: The CI step runs `pnpm audit --audit-level=critical` against the entire workspace lock file. New dependencies are included.
- **CodeQL (SAST)**: Scans all TypeScript source files, including the new package.

### 6.4 Transitive Dependency Risk

| Dependency | Transitive Deps | Risk Assessment |
|-----------|----------------|-----------------|
| picomatch | 0 (zero dependencies) | Minimal. Self-contained glob engine. |
| gray-matter | 1 (js-yaml internally) | Low. js-yaml is widely used and well-maintained. |

Combined: 2 new direct dependencies, 1 new transitive dependency (js-yaml). Minimal supply chain expansion.

### 6.5 Native Addon Impact

Neither picomatch nor gray-matter contains native addons. Unlike `better-sqlite3`, these are pure JavaScript/TypeScript packages. No prebuilt binary resolution needed. No cross-platform native compilation risk.

---

## 7. Cross-Platform Considerations

### 7.1 Path Handling

Config Explorer's primary cross-platform concern is filesystem path resolution. The design uses `os.homedir()` and `path.join()` throughout, avoiding hardcoded path separators. The existing CI matrix validates this.

| Path Operation | Implementation | CI Validation |
|---------------|----------------|---------------|
| Home directory (`~`) | `os.homedir()` | Cross-platform matrix runs on all 3 OS |
| Directory joining | `path.join()` | Integration tests verify path construction |
| Display normalization | Forward slashes for display | Unit tests verify normalization |
| Managed settings | Platform detection + hardcoded paths | Unit tests with mock (not present in CI) |

### 7.2 Existing CI Matrix Coverage

The existing `os: [ubuntu-latest, macos-latest, windows-latest]` matrix is sufficient. Config Explorer adds no new platform-specific concerns beyond what the existing matrix already validates (filesystem paths, `better-sqlite3` native addon, line endings).

### 7.3 gray-matter on Windows

gray-matter handles line ending differences (CRLF vs LF) in YAML frontmatter parsing. This is validated by the cross-platform CI matrix when integration tests parse sample files with platform-native line endings.

---

## 8. Release Impact

### 8.1 Bundling

`@norbert/config-explorer` ships inside the existing `norbert` npm package. It is not published as a separate package. The release workflow (`release.yml`) requires zero changes:

- `pnpm -r run build` builds the new package alongside existing packages.
- `npm publish` publishes the root package which includes all compiled workspace packages.
- `npm pack --dry-run` package validation in CI catches any dev-only files leaking into the bundle.

### 8.2 Package Size Impact

Config Explorer adds pure TypeScript compilation output (estimated < 50 KB compiled) plus two dependencies:
- picomatch: ~4 KB
- gray-matter: ~15 KB (including js-yaml)

Total estimated size increase: < 100 KB. Well within the existing < 10 MB package size gate.

### 8.3 SBOM Impact

The SBOM generated during release (via `anchore/sbom-action`) automatically includes picomatch and gray-matter. No configuration change needed.

### 8.4 Rollback

Config Explorer follows the existing rollback procedure (see `docs/feature/norbert/devops/platform-architecture.md` section 5.5). No database migrations, no data format changes, no additional rollback concerns.

If a Config Explorer release introduces a regression:
1. **npm dist-tag**: Point `latest` back to previous version (existing procedure).
2. **No data cleanup**: Config Explorer is read-only, creates no persistent state.
3. **Dashboard gracefully degrades**: If server lacks `/api/config/*` routes (older version), dashboard Config tab shows "feature not available" (standard 404 handling).

---

## 9. What Is Inherited As-Is (Zero Changes Required)

The following existing infrastructure applies to Config Explorer without modification:

| Concern | Inherited From | Why No Change Needed |
|---------|---------------|---------------------|
| GitHub Flow branching | `branching-strategy.md` | Config Explorer PRs follow same branch naming (`feature/us-ce-*`) and squash merge process |
| PR quality gates (lint, typecheck, format) | `ci-cd-pipeline.md` section 3.1 | Workspace-wide commands automatically include new package |
| Cross-platform CI matrix | `ci.yml` | `os: [ubuntu-latest, macos-latest, windows-latest]` covers config-explorer path handling |
| Dependabot | `platform-architecture.md` section 4.1 | Monitors all `package.json` files in workspace automatically |
| Gitleaks secrets scanning | `ci.yml` commit-stage | Scans all files in repository |
| CodeQL SAST | `ci.yml` security-sast job | Analyzes all TypeScript files in repository |
| `pnpm audit` SCA | `ci.yml` commit-stage | Audits entire workspace lock file |
| npm provenance | `release.yml` publish job | Provenance applies to entire published package |
| SBOM generation | `release.yml` publish job | SBOM covers all dependencies including new ones |
| Changeset version management | `branching-strategy.md` section 5.2 | Config Explorer PRs include changeset files (same flow) |
| Post-publish smoke test | `release.yml` post-publish job | Verifies `norbert --version` and `norbert init --dry-run` |
| Pre-commit hooks (Husky + lint-staged) | `platform-architecture.md` section 6.1 | lint-staged glob `*.ts` matches config-explorer TypeScript files |
| Dashboard build cache | `ci-cd-pipeline.md` section 2.6 | Vite/SvelteKit cache unchanged |
| pnpm store cache | `ci-cd-pipeline.md` section 2.6 | pnpm cache key uses `pnpm-lock.yaml` hash (changes when deps added) |
| Structured JSON logging | `observability-design.md` section 3 | Config API routes log using existing server logging module |
| Health endpoint | `observability-design.md` section 4.2 | `/health` endpoint unchanged; Config Explorer adds no health concerns |
| Bug report template | `observability-design.md` section 8 | `norbert doctor` captures general diagnostics |

---

## 10. Action Items for Implementation

These are the concrete tasks the software crafter must complete to integrate Config Explorer into the existing platform infrastructure:

| Item | Package | What To Do |
|------|---------|-----------|
| Create package directory | `packages/config-explorer/` | `package.json`, `tsconfig.json`, `vitest.config.ts` following existing package patterns |
| Add workspace dependency | `packages/server/package.json` | Add `"@norbert/config-explorer": "workspace:*"` to dependencies |
| Add tsconfig reference | `packages/server/tsconfig.json` | Add project reference to `../config-explorer` |
| Extend architecture check | `scripts/check-architecture.ts` | Add zero-dep check for config-explorer package and import boundary scan |
| Extend Stryker config | `stryker.config.mjs` | Add `packages/config-explorer/src/**/*.ts` to mutate array (after Phase 01) |
| Extend lint scope | Root `package.json` lint script | Verify ESLint glob covers `packages/config-explorer/src/**/*.ts` (should work if using `packages/*/src/**/*.ts`) |

No workflow YAML changes. No new CI jobs. No new GitHub Actions secrets. No new infrastructure.

---

## 11. Requirements Traceability

| DEVOPS Concern | Source | Resolution |
|---------------|--------|------------|
| New package in CI | architecture-design.md section 3 | Automatic via pnpm workspace wildcard (section 2.1) |
| Architecture boundary enforcement | component-boundaries.md | Extended check in `scripts/check-architecture.ts` (section 2.2) |
| picomatch + gray-matter license check | technology-stack.md | Both MIT, covered by existing `pnpm audit` (section 6.2) |
| Cross-platform path handling | architecture-design.md section 9.2 | Existing CI matrix + integration tests with temp dirs (section 7.1) |
| Mutation testing scope | CLAUDE.md mutation strategy | Auto-discovered by `mutation.yml` glob; Stryker config extended (section 5) |
| Release bundling | architecture-design.md section 11 | Bundled with existing npm package, no separate publish (section 8.1) |
| Filesystem mocking in CI | component-boundaries.md `ConfigFileReaderPort` | Port-based injection enables testing without real `~/.claude/` (section 4.2) |
| Dashboard bundle size | platform-architecture.md section 3.2 | New Svelte components within existing < 500 KB budget (section 8.2) |

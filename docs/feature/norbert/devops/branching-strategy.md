# Branching Strategy: Norbert Observatory

**Feature ID**: norbert
**Architect**: Apex (Platform Architect)
**Date**: 2026-03-02
**Status**: DRAFT -- pending peer review

---

## 1. Strategy Selection: GitHub Flow

**Selected**: GitHub Flow (feature branches from main, PRs with review, merge to main after approval).

### 1.1 Why GitHub Flow

| Factor | GitHub Flow | Trunk-Based | GitFlow |
|--------|------------|-------------|---------|
| Team size | Solo developer | Solo developer | Multi-team |
| Release cadence | Weekly (flexible) | Multiple/day | Scheduled |
| Complexity | Low | Lowest | High |
| PR review culture | Yes (self-review + CI gates) | Optional | Yes |
| Branching overhead | 1 long-lived branch (main) | 1 long-lived branch | 3+ long-lived branches |
| Release branches | Not needed (npm tags) | Not needed | release/* branches |

**Rationale**: Solo developer eliminates the need for GitFlow's develop/release/hotfix branches. Trunk-based was considered but GitHub Flow's PR model provides a CI gate checkpoint even for solo development -- the developer creates a PR, CI runs all quality gates, and the PR is merged only when green. This discipline prevents pushing broken code directly to main.

### 1.2 Rejected Alternatives

**Trunk-Based Development (direct push to main)**
- Simpler, but no quality gate checkpoint before code reaches main.
- For a solo developer, the temptation to push directly is high. PR-based gates enforce discipline.
- Would be appropriate if CI ran pre-push hooks reliably, but pre-push hooks can be bypassed.

**GitFlow**
- Over-engineered for solo developer. develop branch adds no value when there is one person.
- Release branches unnecessary -- npm versioning with tags handles release management.

---

## 2. Branch Model

### 2.1 Long-Lived Branches

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production-ready code. Every commit to main is potentially releasable. | Protected: require PR, require status checks, no force push |

**One branch only.** No develop, no staging, no release branches.

### 2.2 Short-Lived Branches

| Pattern | Purpose | Lifetime | Merge Target |
|---------|---------|----------|--------------|
| `feature/{description}` | New feature work | 1-5 days | main |
| `fix/{description}` | Bug fix | < 1 day | main |
| `chore/{description}` | Tooling, config, CI changes | < 1 day | main |
| `docs/{description}` | Documentation updates | < 1 day | main |

### 2.3 Naming Convention

```
feature/us-001-walking-skeleton
feature/us-002-event-capture
fix/sqlite-wal-mode-windows
chore/update-stryker-config
docs/update-readme-install
```

Pattern: `{type}/{kebab-case-description}`

Branch names align with roadmap steps (e.g., `feature/us-001-walking-skeleton` maps to step 01-01 through 01-04).

---

## 3. PR Workflow

### 3.1 PR Lifecycle

```
1. Create feature branch from main
     git checkout -b feature/us-001-walking-skeleton main

2. Develop with local quality checks
     Pre-commit: lint-staged (ESLint + Prettier on staged files)
     Pre-push: typecheck (tsc --noEmit)

3. Push branch and create PR
     git push -u origin feature/us-001-walking-skeleton
     gh pr create --title "US-001: Walking skeleton -- project scaffold and core types"

4. CI runs automatically (ci.yml)
     commit-stage (ubuntu): lint, format, typecheck, arch-check, unit tests, coverage, security, build
     cross-platform (matrix): build + tests on ubuntu, macos, windows
     security-sast: CodeQL analysis

5. Self-review PR (solo developer)
     Review diff in GitHub UI
     Verify CI status checks all green
     Check coverage report
     Verify no unintended files

6. Merge PR (squash merge)
     Squash and merge to main
     Delete branch

7. Post-merge
     mutation.yml runs (per-feature mutation testing on modified files)
```

### 3.2 PR Template

```markdown
## Summary

<!-- What does this PR do? Link to user story if applicable. -->

Implements [US-XXX](link) -- {title}

## Changes

- {change 1}
- {change 2}

## Test Evidence

- [ ] Unit tests pass locally (`pnpm run test:unit`)
- [ ] TypeScript strict check passes (`pnpm run typecheck`)
- [ ] Lint passes (`pnpm run lint`)

## Changeset

- [ ] Changeset file included (run `pnpm changeset` if missing)

## Screenshots / Demo

<!-- For dashboard changes, include a screenshot -->
```

### 3.3 Merge Strategy

**Squash merge** for all PRs to main.

Rationale:
- Each PR becomes a single clean commit on main
- Feature branch commit history (WIP, fixup, review feedback) is compressed
- Main branch history reads as a changelog of meaningful changes
- Simplifies `git log` and mutation testing diff analysis (each commit = one logical change)

Configure in GitHub repository settings:
- Allow squash merging: Yes
- Allow merge commits: No
- Allow rebase merging: No
- Default commit message: PR title + PR description

---

## 4. Branch Protection Rules

### 4.1 Main Branch Protection

```yaml
# GitHub Branch Protection for main
protection_rules:
  require_pull_request:
    required_approving_review_count: 0  # Solo developer -- no reviewer required
    dismiss_stale_reviews: true
    require_code_owner_reviews: false
  require_status_checks:
    strict: true  # Branch must be up to date with main before merge
    contexts:
      - commit-stage
      - cross-platform (ubuntu-latest)
      - cross-platform (macos-latest)
      - cross-platform (windows-latest)
      - security-sast
  require_linear_history: true  # Enforces squash merge
  allow_force_pushes: false
  allow_deletions: false
  require_signed_commits: false  # Defer -- adds friction for solo dev
```

### 4.2 Rationale for 0 Required Reviewers

Solo developer project. Requiring 1+ reviewer would block all progress. The CI quality gates serve as the automated reviewer. When contributors join, this should be raised to 1.

### 4.3 Strict Status Checks

`strict: true` means the branch must be up to date with main before merging. This prevents merge-skew where two PRs individually pass CI but break when combined. For a solo developer this is rarely an issue (one PR at a time) but it is good hygiene to enable from day one.

---

## 5. Release Process

### 5.1 Release Flow

```
main (continuous)
  |
  | Feature PRs merged via squash
  | Each merge triggers mutation testing
  |
  | When ready to release:
  |
  | 1. Changesets bot creates "Version Packages" PR
  |    - Bumps version in package.json files
  |    - Updates CHANGELOG.md from changeset files
  |    - Removes consumed changeset files
  |
  | 2. Developer reviews and merges Version Packages PR
  |
  | 3. Developer creates GitHub Release
  |    - Tag: v{major}.{minor}.{patch} (e.g., v0.1.0)
  |    - Title: v0.1.0
  |    - Body: auto-populated from CHANGELOG.md
  |
  | 4. release.yml triggers
  |    - Full cross-platform validation
  |    - npm publish with provenance
  |    - Post-publish smoke test
  |
  v
npm registry (published)
```

### 5.2 Changeset Workflow

```bash
# After completing a feature PR:
pnpm changeset
# Interactive prompt:
#   Which packages? (all, since it is fixed versioning)
#   Semver bump? (patch/minor/major)
#   Summary? "Add walking skeleton with hook capture and minimal dashboard"

# This creates a file like:
# .changeset/fuzzy-cats-dance.md
# ---
# "norbert": minor
# ---
# Add walking skeleton with hook capture and minimal dashboard

# Commit the changeset file with the PR
```

### 5.3 Version Strategy

| Change Type | Semver Bump | Examples |
|-------------|-------------|---------|
| Bug fix, typo, dependency update | Patch (0.1.x) | Fix SQLite WAL mode on Windows |
| New feature, new command, new dashboard view | Minor (0.x.0) | Add execution trace graph |
| Breaking change to CLI flags, config format, hook format | Major (x.0.0) | Change config.json schema |

**Pre-1.0 convention**: During 0.x development, minor bumps may include breaking changes. The project follows npm convention where 0.x is considered unstable. Stability commitment begins at 1.0.0.

### 5.4 Hotfix Process

Since there is only one long-lived branch (main), hotfixes follow the same flow:

```
1. Create fix/critical-bug-description branch from main
2. Fix the issue
3. Create PR with changeset (patch bump)
4. CI runs all gates
5. Merge to main
6. Merge Changesets Version Packages PR
7. Create GitHub Release
8. release.yml publishes to npm
```

No separate hotfix branch or fast-track pipeline. The CI pipeline is fast enough (< 12 minutes) that this process completes within 30 minutes of identifying the fix.

---

## 6. Tag Strategy

### 6.1 Release Tags

```
v0.1.0    -- First MVP release (Phase 01 complete)
v0.2.0    -- Event capture pipeline (Phase 02)
v0.3.0    -- Dashboard core views (Phase 03)
v0.4.0    -- MCP observatory (Phase 04)
v0.5.0    -- Optimization loop (Phase 05)
v1.0.0    -- Stable release (all phases complete, API stable)
```

Tags are created by the GitHub Release UI. The `release.yml` workflow triggers on tags matching `v*`.

### 6.2 Pre-release Tags

```
v0.1.0-beta.1   -- Beta channel for early testers
v0.1.0-beta.2   -- Second beta iteration
```

Created manually via workflow dispatch or by publishing a GitHub pre-release.

---

## 7. Workflow Integration Summary

| Event | CI Workflow | Mutation | Release |
|-------|-----------|----------|---------|
| PR opened/updated | `ci.yml` runs | -- | -- |
| PR merged to main | -- | `mutation.yml` runs | -- |
| Changesets Version PR merged | `ci.yml` runs (it is a PR) | `mutation.yml` runs | -- |
| GitHub Release published | -- | -- | `release.yml` runs |

### 7.1 Pipeline Triggers Aligned to GitHub Flow

```yaml
# ci.yml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

# mutation.yml
on:
  push:
    branches: [main]

# release.yml
on:
  release:
    types: [published]
```

---

## 8. Contributor Onboarding (Future)

When contributors join the project, update the following:

1. Branch protection: Raise required reviewers from 0 to 1
2. Add CODEOWNERS file mapping package paths to reviewers
3. Add contributor guide with branching conventions
4. Consider enabling signed commits requirement
5. Add PR labeling automation (auto-label based on changed paths)

---

## 9. Requirements Traceability

| Strategy Requirement | Source | Implementation |
|---------------------|--------|----------------|
| GitHub Flow branching | Configuration input | Sections 1-2 |
| PR quality gates | ci-cd-pipeline.md | Section 3.1, 4.1 |
| Squash merge for clean history | DORA: lead time optimization | Section 3.3 |
| Automated release via npm publish | platform-architecture.md | Section 5 |
| Changesets for version management | Release infrastructure | Section 5.2 |
| Branch protection | Shift-left security | Section 4 |

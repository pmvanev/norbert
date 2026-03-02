# CI/CD Pipeline Design: Norbert Observatory

**Feature ID**: norbert
**Architect**: Apex (Platform Architect)
**Date**: 2026-03-02
**Status**: DRAFT -- pending peer review

---

## 1. Pipeline Overview

Two primary workflows, one auxiliary workflow:

| Workflow | Trigger | Purpose | Target Duration |
|----------|---------|---------|-----------------|
| `ci.yml` | PR to main, push to main | Quality gates: lint, typecheck, test, security, build | < 12 minutes |
| `release.yml` | GitHub Release published (tag `v*`) | Cross-platform validation + npm publish | < 20 minutes |
| `mutation.yml` | Push to main (post-merge) | Per-feature mutation testing on modified files | < 15 minutes |

---

## 2. CI Workflow (`ci.yml`)

### 2.1 Trigger

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
```

### 2.2 Job Structure

```
ci.yml
  |
  |-- commit-stage (ubuntu-latest)          -- < 8 min
  |     |-- checkout + pnpm install
  |     |-- lint (ESLint)
  |     |-- format-check (Prettier)
  |     |-- typecheck (tsc --noEmit)
  |     |-- architecture-check (custom script)
  |     |-- unit-tests (Vitest + coverage)
  |     |-- coverage-gate (>= 80% core, >= 70% overall)
  |     |-- security-secrets (Gitleaks)
  |     |-- security-audit (pnpm audit)
  |     |-- build (pnpm -r run build)
  |
  |-- cross-platform (matrix: ubuntu, macos, windows) -- < 12 min
  |     |-- checkout + pnpm install
  |     |-- build
  |     |-- unit-tests
  |     |-- integration-tests
  |     |-- e2e-smoke-test
  |
  |-- security-sast (ubuntu-latest)         -- < 10 min (parallel)
        |-- CodeQL analysis (TypeScript)
```

### 2.3 Commit Stage Detail

```yaml
commit-stage:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version-file: '.node-version'
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile

    - name: Lint
      run: pnpm run lint

    - name: Format Check
      run: pnpm run format:check

    - name: TypeScript Strict Typecheck
      run: pnpm run typecheck

    - name: Architecture Boundary Check
      run: pnpm run check:architecture

    - name: Unit Tests with Coverage
      run: pnpm run test:unit -- --coverage

    - name: Coverage Gate
      run: |
        CORE_COVERAGE=$(jq '.total.lines.pct' packages/core/coverage/coverage-summary.json)
        OVERALL_COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)
        echo "Core coverage: ${CORE_COVERAGE}%"
        echo "Overall coverage: ${OVERALL_COVERAGE}%"
        if (( $(echo "$CORE_COVERAGE < 80" | bc -l) )); then
          echo "FAIL: Core coverage ${CORE_COVERAGE}% is below 80% threshold"
          exit 1
        fi
        if (( $(echo "$OVERALL_COVERAGE < 70" | bc -l) )); then
          echo "FAIL: Overall coverage ${OVERALL_COVERAGE}% is below 70% threshold"
          exit 1
        fi

    - name: Security - Secrets Scan
      uses: gitleaks/gitleaks-action@v2
      env:
        GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}

    - name: Security - Dependency Audit
      run: pnpm audit --audit-level=critical

    - name: Build All Packages
      run: pnpm -r run build

    - name: Package Validation
      run: |
        cd packages/cli
        npm pack --dry-run 2>&1 | tee /tmp/pack-output.txt
        # Verify no dev files leaked into package
        if grep -q "\.test\." /tmp/pack-output.txt; then
          echo "FAIL: Test files found in package"
          exit 1
        fi
```

### 2.4 Cross-Platform Stage Detail

```yaml
cross-platform:
  needs: commit-stage
  strategy:
    fail-fast: false
    matrix:
      os: [ubuntu-latest, macos-latest, windows-latest]
  runs-on: ${{ matrix.os }}
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version-file: '.node-version'
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile

    - name: Build All Packages
      run: pnpm -r run build

    - name: Unit Tests
      run: pnpm run test:unit

    - name: Integration Tests
      run: pnpm run test:integration

    - name: E2E Smoke Test
      shell: bash
      run: |
        # Pack and install globally
        TARBALL=$(pnpm pack --pack-destination /tmp | tail -1)
        npm install -g "/tmp/${TARBALL}"

        # Verify CLI entry point
        norbert --version

        # Verify init dry-run (no side effects)
        norbert init --dry-run

        # Start server, post test event, verify capture
        norbert serve --background --port 17890
        sleep 2

        curl -s -X POST http://localhost:17890/api/events \
          -H "Content-Type: application/json" \
          -d '{"event_type":"SessionStart","session_id":"smoke-test","timestamp":"2026-03-02T00:00:00Z","model":"claude-sonnet-4"}'

        STATUS=$(curl -s http://localhost:17890/health)
        echo "Health check: ${STATUS}"

        norbert status --port 17890

        # Cleanup
        norbert stop --port 17890 || true
        npm uninstall -g norbert
```

### 2.5 Security SAST Stage

```yaml
security-sast:
  runs-on: ubuntu-latest
  permissions:
    security-events: write
  steps:
    - uses: actions/checkout@v4

    - name: Initialize CodeQL
      uses: github/codeql-action/init@v3
      with:
        languages: javascript-typescript

    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v3
```

### 2.6 Caching Strategy

```yaml
# pnpm store cache (shared across jobs via actions/setup-node cache: 'pnpm')
# Key: runner.os + hash of pnpm-lock.yaml
# Restore: partial match on runner.os prefix

# Dashboard build cache (Vite)
- uses: actions/cache@v4
  with:
    path: packages/dashboard/.svelte-kit
    key: ${{ runner.os }}-svelte-${{ hashFiles('packages/dashboard/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-svelte-
```

---

## 3. Release Workflow (`release.yml`)

### 3.1 Trigger

```yaml
on:
  release:
    types: [published]
```

### 3.2 Job Structure

```
release.yml
  |
  |-- validate (matrix: ubuntu, macos, windows)  -- < 15 min
  |     |-- full test suite (unit + integration)
  |     |-- build all packages
  |     |-- e2e smoke test
  |
  |-- publish (ubuntu-latest, needs: validate)    -- < 5 min
  |     |-- build
  |     |-- generate SBOM
  |     |-- npm publish --provenance
  |     |-- attach SBOM to GitHub Release
  |
  |-- post-publish (ubuntu-latest, needs: publish) -- < 5 min
        |-- install from npm registry
        |-- verify published version
        |-- smoke test against published package
```

### 3.3 Publish Job Detail

```yaml
publish:
  needs: validate
  runs-on: ubuntu-latest
  permissions:
    contents: write
    id-token: write  # Required for npm provenance
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version-file: '.node-version'
        registry-url: 'https://registry.npmjs.org'

    - run: pnpm install --frozen-lockfile
    - run: pnpm -r run build

    - name: Generate SBOM
      uses: anchore/sbom-action@v0
      with:
        artifact-name: norbert-sbom.spdx.json
        output-file: norbert-sbom.spdx.json

    - name: Publish to npm
      run: npm publish --provenance --access public
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

    - name: Attach SBOM to Release
      uses: softprops/action-gh-release@v2
      with:
        files: norbert-sbom.spdx.json
```

### 3.4 Post-Publish Verification

```yaml
post-publish:
  needs: publish
  runs-on: ubuntu-latest
  steps:
    - name: Wait for npm propagation
      run: sleep 30

    - uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install published package
      run: npm install -g norbert@${{ github.event.release.tag_name }}

    - name: Verify version
      run: |
        INSTALLED=$(norbert --version)
        EXPECTED="${{ github.event.release.tag_name }}"
        EXPECTED="${EXPECTED#v}"  # Strip leading v
        if [ "$INSTALLED" != "$EXPECTED" ]; then
          echo "FAIL: Installed version $INSTALLED does not match expected $EXPECTED"
          exit 1
        fi

    - name: Smoke test
      run: norbert init --dry-run
```

---

## 4. Mutation Testing Workflow (`mutation.yml`)

### 4.1 Trigger

```yaml
on:
  push:
    branches: [main]
```

### 4.2 Strategy

**Per-feature mutation testing** (project < 50k LOC):
- Runs after each merge to main
- Scoped to files modified in the merge commit
- Kill rate gate: >= 80%
- Runtime target: 5-15 minutes
- Tool: Stryker Mutator (TypeScript support via @stryker-mutator/typescript-checker)

### 4.3 Job Detail

```yaml
mutation-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 2  # Need parent commit for diff

    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version-file: '.node-version'
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile

    - name: Determine modified source files
      id: changed
      run: |
        FILES=$(git diff --name-only HEAD~1 HEAD -- 'packages/*/src/**/*.ts' | grep -v '\.test\.' | grep -v '\.spec\.' | tr '\n' ',')
        echo "files=${FILES}" >> "$GITHUB_OUTPUT"
        if [ -z "$FILES" ]; then
          echo "skip=true" >> "$GITHUB_OUTPUT"
        else
          echo "skip=false" >> "$GITHUB_OUTPUT"
        fi

    - name: Run Stryker Mutation Tests
      if: steps.changed.outputs.skip != 'true'
      run: |
        npx stryker run \
          --mutate "${{ steps.changed.outputs.files }}" \
          --reporters html,json,clear-text

    - name: Mutation Kill Rate Gate
      if: steps.changed.outputs.skip != 'true'
      run: |
        KILL_RATE=$(jq '.schemaVersion' reports/mutation/mutation.json && jq '.files | to_entries | map(.value.mutants | map(select(.status == "Killed")) | length) | add' reports/mutation/mutation.json)
        TOTAL=$(jq '.files | to_entries | map(.value.mutants | length) | add' reports/mutation/mutation.json)
        if [ "$TOTAL" -gt 0 ]; then
          RATE=$(echo "scale=1; $KILL_RATE * 100 / $TOTAL" | bc)
          echo "Mutation kill rate: ${RATE}% (${KILL_RATE}/${TOTAL})"
          if (( $(echo "$RATE < 80" | bc -l) )); then
            echo "WARNING: Kill rate ${RATE}% is below 80% threshold"
            # Advisory: does not block merge, but blocks release
          fi
        fi

    - name: Upload Mutation Report
      if: steps.changed.outputs.skip != 'true'
      uses: actions/upload-artifact@v4
      with:
        name: mutation-report
        path: reports/mutation/
```

---

## 5. Workflow Dependencies and Parallelization

```
PR opened/updated:
  |
  +-- commit-stage (ubuntu)  ----+
  |                              |
  +-- security-sast (ubuntu) -+  +--> PR status checks (all must pass)
                              |  |
                              +--+
                              |
                              +--> cross-platform (matrix) --> PR ready for merge

Merge to main:
  |
  +--> mutation.yml (per-feature mutation testing)

GitHub Release published:
  |
  +--> release.yml: validate (matrix) --> publish --> post-publish
```

### 5.1 Required Status Checks (Branch Protection)

Configure in GitHub repository settings for `main` branch:

```
Required status checks:
  - commit-stage
  - cross-platform (ubuntu-latest)
  - cross-platform (macos-latest)
  - cross-platform (windows-latest)
  - security-sast
```

---

## 6. CI/CD Architecture Enforcement Scripts

### 6.1 Architecture Check Script (`scripts/check-architecture.ts`)

```typescript
// Validates module boundaries defined in component-boundaries.md
// Run as: pnpm run check:architecture

// Check 1: @norbert/core has zero dependencies
// Read packages/core/package.json, verify "dependencies" is empty or absent

// Check 2: @norbert/dashboard has no @norbert/* runtime dependencies
// Read packages/dashboard/package.json, verify no @norbert/* in "dependencies"

// Check 3: No circular dependencies
// Run madge --circular --extensions ts packages/

// Check 4: Import boundary enforcement
// For each package, verify imports only reference declared dependencies
// Uses TypeScript compiler API or simple grep on import statements
```

### 6.2 Root package.json Scripts

```json
{
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm run test:unit && pnpm run test:integration",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:e2e": "bash scripts/e2e-smoke.sh",
    "typecheck": "tsc --build --noEmit",
    "lint": "eslint packages/*/src/**/*.ts",
    "lint:fix": "eslint --fix packages/*/src/**/*.ts",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check:architecture": "tsx scripts/check-architecture.ts",
    "mutate": "stryker run",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "pnpm -r run build && changeset publish"
  }
}
```

---

## 7. Stryker Configuration

```javascript
// stryker.config.mjs
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'pnpm',
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  reporters: ['html', 'json', 'clear-text', 'progress'],
  coverageAnalysis: 'perTest',
  thresholds: {
    high: 80,
    low: 60,
    break: null  // Advisory in CI, not blocking
  },
  mutate: [
    'packages/core/src/**/*.ts',
    '!packages/core/src/**/*.test.ts',
    '!packages/core/src/**/*.spec.ts',
    '!packages/core/src/**/index.ts'
  ],
  timeoutMS: 60000,
  concurrency: 4
};
```

Note: The `--mutate` flag in the CI workflow overrides the `mutate` array to scope to modified files only.

---

## 8. CI/CD Measurement Coupling

Per the skill guidance on test architecture and measurement coupling:

| Measurement | Tool | Architecture Consideration |
|-------------|------|---------------------------|
| Unit coverage | Vitest + v8 | pnpm workspace runs tests per-package. Coverage is aggregated at root. The `coverage-summary.json` at root and per-package must both be generated. |
| Mutation kill rate | Stryker | Stryker runs against the workspace root with `--mutate` scoping. Modified files may span multiple packages -- Stryker handles this via TypeScript project references. |
| Bundle size | Vite build output | Dashboard bundle size checked post-build. Threshold: < 500KB (gzipped). |

**Baseline documentation**: After the first successful CI run, baseline metrics will be recorded in `docs/feature/norbert/devops/quality-baselines.md` and updated after each phase completion.

#!/usr/bin/env bash
# release.sh — version bump, commit, tag, push, trigger release build.
#
# The GitHub Actions workflow in .github/workflows/build.yml triggers on
# tags matching v*, so pushing the tag kicks off the release build.
#
# Usage:
#   ./scripts/release.sh 0.5.1           explicit version
#   ./scripts/release.sh --patch         bump patch (0.5.0 -> 0.5.1)
#   ./scripts/release.sh --minor         bump minor (0.5.0 -> 0.6.0)
#   ./scripts/release.sh --major         bump major (0.5.0 -> 1.0.0)
#   ./scripts/release.sh --dry-run ...   show actions without executing
#   ./scripts/release.sh -m "msg" ...    custom commit subject suffix

set -euo pipefail

# ----------------------------------------------------------------------------
# Arg parsing
# ----------------------------------------------------------------------------

DRY_RUN=0
BUMP=""
EXPLICIT_VERSION=""
MESSAGE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=1; shift ;;
        --patch|--minor|--major) BUMP="${1#--}"; shift ;;
        -m|--message) MESSAGE="$2"; shift 2 ;;
        -h|--help)
            grep '^#' "$0" | sed 's/^# \?//'; exit 0 ;;
        -*)
            echo "error: unknown flag '$1'" >&2; exit 2 ;;
        *)
            if [[ -n "$EXPLICIT_VERSION" ]]; then
                echo "error: multiple versions given" >&2; exit 2
            fi
            EXPLICIT_VERSION="$1"; shift ;;
    esac
done

if [[ -z "$BUMP" && -z "$EXPLICIT_VERSION" ]]; then
    echo "error: give a version (e.g. 0.5.1) or a bump flag (--patch/--minor/--major)" >&2
    exit 2
fi

# ----------------------------------------------------------------------------
# Paths relative to repo root
# ----------------------------------------------------------------------------

cd "$(git rev-parse --show-toplevel)"

PKG_JSON="package.json"
CARGO_MAIN="src-tauri/Cargo.toml"
CARGO_HOOK="src-tauri/hook-receiver/Cargo.toml"
TAURI_CONF="src-tauri/tauri.conf.json"

for f in "$PKG_JSON" "$CARGO_MAIN" "$CARGO_HOOK" "$TAURI_CONF"; do
    [[ -f "$f" ]] || { echo "error: missing $f" >&2; exit 1; }
done

# ----------------------------------------------------------------------------
# Compute target version
# ----------------------------------------------------------------------------

CURRENT=$(sed -n 's/^  "version": "\([^"]*\)".*/\1/p' "$PKG_JSON" | head -1)
[[ -n "$CURRENT" ]] || { echo "error: could not read current version from $PKG_JSON" >&2; exit 1; }

if [[ -n "$EXPLICIT_VERSION" ]]; then
    NEXT="$EXPLICIT_VERSION"
else
    IFS='.' read -r MAJ MIN PATCH <<< "$CURRENT"
    case "$BUMP" in
        patch) NEXT="$MAJ.$MIN.$((PATCH + 1))" ;;
        minor) NEXT="$MAJ.$((MIN + 1)).0" ;;
        major) NEXT="$((MAJ + 1)).0.0" ;;
    esac
fi

if ! [[ "$NEXT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "error: '$NEXT' is not a valid semver" >&2; exit 1
fi
if [[ "$NEXT" == "$CURRENT" ]]; then
    echo "error: next version ($NEXT) is the same as current ($CURRENT)" >&2; exit 1
fi

TAG="v$NEXT"

# ----------------------------------------------------------------------------
# Guards
# ----------------------------------------------------------------------------

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
    echo "error: must run from main (on '$BRANCH')" >&2; exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "error: working tree not clean; commit or stash first" >&2
    git status --short >&2
    exit 1
fi

git fetch --quiet origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
    echo "error: local main is not in sync with origin/main" >&2; exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "error: tag $TAG already exists" >&2; exit 1
fi

# ----------------------------------------------------------------------------
# Plan
# ----------------------------------------------------------------------------

echo "Release plan:"
echo "  current : $CURRENT"
echo "  next    : $NEXT"
echo "  tag     : $TAG"
echo "  branch  : $BRANCH"
echo "  dry-run : $([[ $DRY_RUN -eq 1 ]] && echo yes || echo no)"
echo

if [[ $DRY_RUN -eq 1 ]]; then
    echo "Would update:"
    echo "  $PKG_JSON    0.x.y -> $NEXT"
    echo "  $CARGO_MAIN  0.x.y -> $NEXT"
    echo "  $CARGO_HOOK  0.x.y -> $NEXT"
    echo "  $TAURI_CONF  0.x.y -> $NEXT"
    echo "Would run: cargo check, npx vitest run"
    echo "Would commit, tag $TAG, push origin main + $TAG"
    exit 0
fi

# ----------------------------------------------------------------------------
# Bump versions
# ----------------------------------------------------------------------------

echo "Bumping versions..."
sed -i "s/^  \"version\": \"$CURRENT\",/  \"version\": \"$NEXT\",/" "$PKG_JSON"
sed -i "s/^  \"version\": \"$CURRENT\",/  \"version\": \"$NEXT\",/" "$TAURI_CONF"
sed -i "s/^version = \"$CURRENT\"/version = \"$NEXT\"/" "$CARGO_MAIN"
sed -i "s/^version = \"$CURRENT\"/version = \"$NEXT\"/" "$CARGO_HOOK"

assert_version_in() {
    local file="$1" pattern="$2"
    grep -q "$pattern" "$file" || {
        echo "error: $file does not contain '$pattern' — sed did not match" >&2
        exit 1
    }
}

assert_version_in "$PKG_JSON"   "\"version\": \"$NEXT\""
assert_version_in "$CARGO_MAIN" "^version = \"$NEXT\""
assert_version_in "$CARGO_HOOK" "^version = \"$NEXT\""
assert_version_in "$TAURI_CONF" "\"version\": \"$NEXT\""

echo "Regenerating Cargo.lock..."
( cd src-tauri && cargo check -p norbert >/dev/null )

# ----------------------------------------------------------------------------
# Tests
# ----------------------------------------------------------------------------

echo "Running frontend tests..."
npx vitest run --silent

# ----------------------------------------------------------------------------
# Commit, tag, push
# ----------------------------------------------------------------------------

SUBJECT="release: v$NEXT"
[[ -n "$MESSAGE" ]] && SUBJECT="release: v$NEXT — $MESSAGE"

git add "$PKG_JSON" "$CARGO_MAIN" "$CARGO_HOOK" "$TAURI_CONF" src-tauri/Cargo.lock
git commit -m "$SUBJECT"
git tag -a "$TAG" -m "$TAG"
git push origin main
git push origin "$TAG"

echo
echo "Released $TAG. GitHub Actions will build on the tag push."

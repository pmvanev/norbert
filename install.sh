#!/bin/sh
# Norbert installer — downloads pre-built binaries from GitHub Releases.
# Works on macOS, Linux, and Git Bash on Windows.
set -e

REPO="pmvanev/norbert"
INSTALL_DIR="$HOME/.norbert/bin"

# --- Helpers ---

die() {
  echo "Error: $1" >&2
  exit 1
}

cleanup() {
  if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
}

trap cleanup EXIT

# --- Detect latest version ---

detect_version() {
  url="https://api.github.com/repos/${REPO}/releases/latest"
  response=$(curl -fsSL "$url" 2>/dev/null) || die "Failed to fetch latest release from GitHub API. Check your network connection."
  version=$(echo "$response" | grep '"tag_name"' | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\{0,1\}\([^"]*\)".*/\1/')
  # Strip leading v if present
  version=$(echo "$version" | sed 's/^v//')
  if [ -z "$version" ]; then
    die "Could not determine latest release version."
  fi
  echo "$version"
}

# --- Detect platform ---

detect_platform() {
  os_name=$(uname -s)
  arch_name=$(uname -m)

  case "$os_name" in
    Darwin)
      os="darwin"
      ;;
    Linux)
      os="linux"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      os="win32"
      ;;
    *)
      die "Unsupported operating system: $os_name. Supported: macOS, Linux, Windows (Git Bash)."
      ;;
  esac

  case "$arch_name" in
    x86_64|amd64)
      arch="x64"
      ;;
    arm64|aarch64)
      arch="arm64"
      ;;
    *)
      die "Unsupported architecture: $arch_name. Supported: x86_64, arm64."
      ;;
  esac

  # Validate supported combinations
  case "${os}-${arch}" in
    win32-x64|linux-x64|darwin-x64|darwin-arm64)
      ;;
    *)
      die "Unsupported platform: ${os}-${arch}. Supported: win32-x64, linux-x64, darwin-x64, darwin-arm64."
      ;;
  esac

  echo "${os}-${arch}"
}

# --- Main ---

echo "Detecting platform..."
PLATFORM=$(detect_platform)
echo "Platform: $PLATFORM"

echo "Fetching latest release version..."
VERSION=$(detect_version)
echo "Version: $VERSION"

ASSET="norbert-v${VERSION}-${PLATFORM}.tar.gz"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${VERSION}/${ASSET}"

echo "Downloading ${ASSET}..."
TEMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'norbert-install')
TEMP_FILE="${TEMP_DIR}/${ASSET}"

curl -fSL --progress-bar "$DOWNLOAD_URL" -o "$TEMP_FILE" || die "Failed to download ${DOWNLOAD_URL}. The release asset may not exist for your platform."

echo "Installing to ${INSTALL_DIR}..."
mkdir -p "$INSTALL_DIR"
tar -xzf "$TEMP_FILE" -C "$INSTALL_DIR" || die "Failed to extract archive."

# Make binaries executable on Unix
case "$PLATFORM" in
  darwin-*|linux-*)
    chmod +x "$INSTALL_DIR/norbert" 2>/dev/null || true
    chmod +x "$INSTALL_DIR/norbert-hook-receiver" 2>/dev/null || true
    ;;
esac

# Create Start Menu shortcut on Windows
case "$PLATFORM" in
  win32-*)
    if [ -n "$APPDATA" ]; then
      echo "Creating Start Menu shortcut..."
      # Convert Unix-style path to Windows-style for PowerShell
      WIN_TARGET=$(cygpath -w "$INSTALL_DIR/norbert.exe" 2>/dev/null || echo "$INSTALL_DIR/norbert.exe")
      SHORTCUT_DIR="$APPDATA/Microsoft/Windows/Start Menu/Programs"
      WIN_SHORTCUT=$(cygpath -w "$SHORTCUT_DIR/Norbert.lnk" 2>/dev/null || echo "$SHORTCUT_DIR/Norbert.lnk")
      powershell.exe -NoProfile -Command "
        \$ws = New-Object -ComObject WScript.Shell;
        \$s = \$ws.CreateShortcut('$WIN_SHORTCUT');
        \$s.TargetPath = '$WIN_TARGET';
        \$s.Save()
      " 2>/dev/null || echo "Warning: Could not create Start Menu shortcut."
    fi
    ;;
esac

echo ""
echo "Norbert installed successfully!"
echo ""
echo "To connect to Claude Code:"
echo "  /plugin install norbert@pmvanev-plugins"
echo ""

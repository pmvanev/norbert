#!/bin/sh
# Norbert local installer — installs from a local Tauri build.
# Copies binaries from src-tauri/target/release/ to ~/.norbert/bin/
# and runs the same post-install steps as the production installer.
#
# Usage:
#   ./local_install.sh          # install from target/release/
#   ./local_install.sh --build  # run cargo build --release first, then install
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RELEASE_DIR="$SCRIPT_DIR/src-tauri/target/release"
INSTALL_DIR="$HOME/.norbert/bin"

# --- Helpers ---

die() {
  echo "Error: $1" >&2
  exit 1
}

# --- Optional build step ---

if [ "$1" = "--build" ]; then
  echo "Building Norbert (release mode)..."
  (cd "$SCRIPT_DIR/src-tauri" && cargo build --release) || die "Build failed."
  echo "Build complete."
fi

# --- Validate binaries exist ---

detect_platform() {
  os_name=$(uname -s)
  case "$os_name" in
    Darwin)       echo "darwin" ;;
    Linux)        echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "win32" ;;
    *)            die "Unsupported OS: $os_name" ;;
  esac
}

PLATFORM=$(detect_platform)

case "$PLATFORM" in
  win32)
    NORBERT_BIN="norbert.exe"
    RECEIVER_BIN="norbert-hook-receiver.exe"
    ;;
  *)
    NORBERT_BIN="norbert"
    RECEIVER_BIN="norbert-hook-receiver"
    ;;
esac

[ -f "$RELEASE_DIR/$NORBERT_BIN" ] || die "$NORBERT_BIN not found in $RELEASE_DIR. Run with --build or 'cargo tauri build' first."
[ -f "$RELEASE_DIR/$RECEIVER_BIN" ] || die "$RECEIVER_BIN not found in $RELEASE_DIR. Run with --build or 'cargo tauri build' first."

# --- Stop existing processes ---

NORBERT_WAS_RUNNING=false
case "$PLATFORM" in
  win32)
    echo "Stopping existing Norbert processes..."
    if powershell.exe -NoProfile -Command "Get-Process -Name 'norbert' -ErrorAction SilentlyContinue" 2>/dev/null | grep -q norbert; then
      NORBERT_WAS_RUNNING=true
    fi
    powershell.exe -NoProfile -Command "Stop-Process -Name 'norbert' -ErrorAction SilentlyContinue; Stop-Process -Name 'norbert-hook-receiver' -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1" 2>/dev/null || true
    ;;
  *)
    echo "Stopping existing Norbert processes..."
    pkill -f norbert-hook-receiver 2>/dev/null || true
    pkill -f "norbert$" 2>/dev/null || true
    sleep 1
    ;;
esac

# --- Copy binaries ---

echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp "$RELEASE_DIR/$NORBERT_BIN" "$INSTALL_DIR/"
cp "$RELEASE_DIR/$RECEIVER_BIN" "$INSTALL_DIR/"

# Make binaries executable on Unix
case "$PLATFORM" in
  darwin|linux)
    chmod +x "$INSTALL_DIR/$NORBERT_BIN"
    chmod +x "$INSTALL_DIR/$RECEIVER_BIN"
    ;;
esac

# --- Windows post-install: shortcuts + start receiver ---

case "$PLATFORM" in
  win32)
    # Start Menu shortcut
    if [ -n "$APPDATA" ]; then
      echo "Creating Start Menu shortcut..."
      WIN_TARGET=$(cygpath -w "$INSTALL_DIR/$NORBERT_BIN" 2>/dev/null || echo "$INSTALL_DIR/$NORBERT_BIN")
      SHORTCUT_DIR="$APPDATA/Microsoft/Windows/Start Menu/Programs"
      WIN_SHORTCUT=$(cygpath -w "$SHORTCUT_DIR/Norbert.lnk" 2>/dev/null || echo "$SHORTCUT_DIR/Norbert.lnk")
      powershell.exe -NoProfile -Command "
        \$ws = New-Object -ComObject WScript.Shell;
        \$s = \$ws.CreateShortcut('$WIN_SHORTCUT');
        \$s.TargetPath = '$WIN_TARGET';
        \$s.Save()
      " 2>/dev/null || echo "Warning: Could not create Start Menu shortcut."
    fi

    # Startup shortcut for hook receiver
    echo "Creating startup shortcut for hook receiver..."
    WIN_RECEIVER=$(cygpath -w "$INSTALL_DIR/$RECEIVER_BIN" 2>/dev/null || echo "$INSTALL_DIR/$RECEIVER_BIN")
    STARTUP_DIR="$APPDATA/Microsoft/Windows/Start Menu/Programs/Startup"
    WIN_STARTUP_SHORTCUT=$(cygpath -w "$STARTUP_DIR/NorbertHookReceiver.lnk" 2>/dev/null || echo "$STARTUP_DIR/NorbertHookReceiver.lnk")
    powershell.exe -NoProfile -Command "
      \$ws = New-Object -ComObject WScript.Shell;
      \$s = \$ws.CreateShortcut('$WIN_STARTUP_SHORTCUT');
      \$s.TargetPath = '$WIN_RECEIVER';
      \$s.WindowStyle = 7;
      \$s.Save()
    " 2>/dev/null && echo "Startup shortcut created." || echo "Warning: Could not create startup shortcut (non-fatal)."

    # Start hook receiver
    echo "Starting hook receiver..."
    powershell.exe -NoProfile -Command "
      Start-Process -FilePath '$WIN_RECEIVER' -WindowStyle Hidden
    " 2>/dev/null && echo "Hook receiver started." || echo "Warning: Could not start hook receiver (non-fatal)."

    # Reopen Norbert if it was running
    if [ "$NORBERT_WAS_RUNNING" = true ]; then
      echo "Reopening Norbert..."
      WIN_NORBERT=$(cygpath -w "$INSTALL_DIR/$NORBERT_BIN" 2>/dev/null || echo "$INSTALL_DIR/$NORBERT_BIN")
      powershell.exe -NoProfile -Command "
        Start-Process -FilePath '$WIN_NORBERT'
      " 2>/dev/null && echo "Norbert reopened." || echo "Warning: Could not reopen Norbert (non-fatal)."
    fi
    ;;
esac

echo ""
echo "Norbert installed from local build!"
echo "  Binaries: $INSTALL_DIR"
echo ""

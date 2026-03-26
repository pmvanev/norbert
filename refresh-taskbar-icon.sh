#!/bin/bash
# Norbert taskbar icon refresh for Git Bash on Windows
# Nuclear icon cache reset: kills Explorer first so cache files are unlocked,
# then clears ALL icon caches, then restarts everything fresh.
set -e

INSTALL_DIR="$HOME/.norbert/bin"
NORBERT_EXE="$INSTALL_DIR/norbert.exe"

if [ ! -f "$NORBERT_EXE" ]; then
    echo "Error: Norbert not found at $NORBERT_EXE"
    exit 1
fi

WIN_NORBERT_EXE=$(cygpath -w "$NORBERT_EXE")

# --- Step 1: Unpin from taskbar ---

echo "Step 1: Unpinning Norbert from taskbar..."
TASKBAR_PIN_DIR="$APPDATA/Microsoft/Internet Explorer/Quick Launch/User Pinned/TaskBar"
if [ -d "$TASKBAR_PIN_DIR" ]; then
    for lnk in "$TASKBAR_PIN_DIR"/*.lnk; do
        [ -f "$lnk" ] || continue
        if powershell.exe -NoProfile -Command \
            "(New-Object -ComObject WScript.Shell).CreateShortcut('$(cygpath -w "$lnk")').TargetPath" 2>/dev/null \
            | grep -qi "norbert"; then
            rm -f "$lnk"
            echo "  Removed: $(basename "$lnk")"
        fi
    done
fi

# --- Step 2: Close Norbert ---

echo "Step 2: Closing Norbert..."
taskkill.exe //IM norbert.exe //F > /dev/null 2>&1 || true
sleep 1

# --- Step 3: Delete Start Menu shortcut ---

echo "Step 3: Removing Start Menu shortcut..."
START_MENU_LNK="$APPDATA/Microsoft/Windows/Start Menu/Programs/Norbert.lnk"
rm -f "$START_MENU_LNK" 2>/dev/null && echo "  Removed." || echo "  Not found."

# --- Step 4: Kill Explorer (unlocks icon cache files) ---

echo "Step 4: Killing Explorer (desktop will disappear briefly)..."
taskkill.exe //IM explorer.exe //F > /dev/null 2>&1 || true
sleep 2

# --- Step 5: Clear ALL icon caches while Explorer is dead ---
# This is the critical window — cache .db files are only deletable when Explorer isn't running.

echo "Step 5: Clearing icon caches (Explorer is stopped)..."

# Explorer icon cache and thumbnail cache
ICON_CACHE_DIR="$LOCALAPPDATA/Microsoft/Windows/Explorer"
if [ -d "$ICON_CACHE_DIR" ]; then
    for f in "$ICON_CACHE_DIR"/iconcache*; do
        [ -f "$f" ] || continue
        rm -f "$f" 2>/dev/null && echo "  Deleted: $(basename "$f")" || echo "  Locked: $(basename "$f")"
    done
    for f in "$ICON_CACHE_DIR"/thumbcache*; do
        [ -f "$f" ] || continue
        rm -f "$f" 2>/dev/null && echo "  Deleted: $(basename "$f")" || echo "  Locked: $(basename "$f")"
    done
fi

# Legacy IconCache.db
rm -f "$LOCALAPPDATA/IconCache.db" 2>/dev/null && echo "  Deleted: IconCache.db" || true

# Windows Search icon cache
SEARCH_CACHE="$LOCALAPPDATA/Packages/Microsoft.Windows.Search_cw5n1h2txyewy/LocalState"
if [ -d "$SEARCH_CACHE" ]; then
    rm -rf "$SEARCH_CACHE/AppIconCache" 2>/dev/null && echo "  Cleared: Search AppIconCache"
    rm -rf "$SEARCH_CACHE/DeviceSearchCache" 2>/dev/null && echo "  Cleared: Search DeviceSearchCache"
fi

# StartMenuExperienceHost caches
for subdir in TempState LocalState; do
    cache_dir="$LOCALAPPDATA/Packages/Microsoft.Windows.StartMenuExperienceHost_cw5n1h2txyewy/$subdir"
    if [ -d "$cache_dir" ]; then
        rm -rf "$cache_dir"/* 2>/dev/null && echo "  Cleared: StartMenu $subdir"
    fi
done

# Windows Search index (SearchUI / SearchHost) — kill it so it rebuilds its icon cache
taskkill.exe //IM SearchHost.exe //F > /dev/null 2>&1 || true
taskkill.exe //IM SearchUI.exe //F > /dev/null 2>&1 || true
taskkill.exe //IM SearchApp.exe //F > /dev/null 2>&1 || true

echo "  All caches cleared."

# --- Step 6: Restart Explorer ---

echo "Step 6: Restarting Explorer..."
explorer.exe &
sleep 4
echo "  Explorer restarted."

# --- Step 7: Refresh shell icon cache ---

echo "Step 7: Refreshing shell icon cache..."
ie4uinit.exe -show 2>/dev/null || true

# --- Step 8: Recreate Start Menu shortcut ---

echo "Step 8: Recreating Start Menu shortcut..."
powershell.exe -NoProfile -Command "
    \$shortcutPath = Join-Path \$env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Norbert.lnk'
    \$ws = New-Object -ComObject WScript.Shell
    \$sc = \$ws.CreateShortcut(\$shortcutPath)
    \$sc.TargetPath = '$WIN_NORBERT_EXE'
    \$sc.Save()
    Write-Host '  Start Menu shortcut recreated.'
" || echo "  Warning: Could not recreate Start Menu shortcut."

# --- Step 9: Reopen Norbert ---

echo "Step 9: Reopening Norbert..."
"$NORBERT_EXE" &
sleep 2

# --- Step 10: Re-pin to taskbar ---

echo "Step 10: Re-pinning Norbert to taskbar..."
powershell.exe -NoProfile -Command "
    \$lnk = Join-Path \$env:TEMP 'Norbert.lnk'
    \$ws = New-Object -ComObject WScript.Shell
    \$sc = \$ws.CreateShortcut(\$lnk)
    \$sc.TargetPath = '$WIN_NORBERT_EXE'
    \$sc.Save()

    \$shell = New-Object -ComObject Shell.Application
    \$folder = \$shell.Namespace((Split-Path \$lnk))
    \$item = \$folder.ParseName((Split-Path \$lnk -Leaf))
    \$verb = \$item.Verbs() | Where-Object { \$_.Name -match 'pin.*taskbar|taskbar.*pin' }
    if (\$verb) {
        \$verb.DoIt()
        Write-Host '  Pinned to taskbar via shell verb.'
    } else {
        \$pinDir = Join-Path \$env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
        Copy-Item -Path \$lnk -Destination (Join-Path \$pinDir 'Norbert.lnk') -Force
        Write-Host '  Pinned to taskbar via shortcut copy.'
    }
    Remove-Item -Path \$lnk -Force -ErrorAction SilentlyContinue
" 2>/dev/null || echo "  Warning: Could not auto-pin. Right-click Norbert in the taskbar and select 'Pin to taskbar'."

# --- Done ---

echo ""
echo "Done! If the Start Menu search icon is still stale, sign out and back in — the"
echo "search index fully rebuilds on login."

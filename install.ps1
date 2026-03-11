# Norbert installer for Windows PowerShell
# Downloads pre-built binaries from GitHub Releases.
$ErrorActionPreference = "Stop"

$Repo = "pmvanev/norbert"
$InstallDir = Join-Path $HOME ".norbert" "bin"
$TaskName = "NorbertHookReceiver"
$HookReceiverBinary = "norbert-hook-receiver.exe"

# --- Detect latest version ---

Write-Host "Fetching latest release version..."
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -UseBasicParsing
    $version = $release.tag_name -replace '^v', ''
} catch {
    Write-Host "Error: Failed to fetch latest release from GitHub API. Check your network connection." -ForegroundColor Red
    exit 1
}

if (-not $version) {
    Write-Host "Error: Could not determine latest release version." -ForegroundColor Red
    exit 1
}

Write-Host "Version: $version"

# --- Download ---

$asset = "norbert-v${version}-win32-x64.tar.gz"
$downloadUrl = "https://github.com/$Repo/releases/download/v${version}/$asset"
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "norbert-install-$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
$tempFile = Join-Path $tempDir $asset

Write-Host "Downloading $asset..."
try {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -UseBasicParsing
} catch {
    Write-Host "Error: Failed to download $downloadUrl. The release asset may not exist." -ForegroundColor Red
    if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
    exit 1
}

# --- Stop existing receiver (unlock binary before overwrite) ---

Write-Host "Stopping existing hook receiver..."
Stop-Process -Name 'norbert-hook-receiver' -ErrorAction SilentlyContinue

# --- Extract ---

Write-Host "Installing to $InstallDir..."
try {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    tar -xzf $tempFile -C $InstallDir
} catch {
    Write-Host "Error: Failed to extract archive." -ForegroundColor Red
    if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
    exit 1
}

# --- Cleanup ---

Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

# --- Start Menu shortcut ---

Write-Host "Creating Start Menu shortcut..."
try {
    $targetPath = Join-Path $InstallDir "norbert.exe"
    $shortcutDir = Join-Path $env:APPDATA "Microsoft" "Windows" "Start Menu" "Programs"
    $shortcutPath = Join-Path $shortcutDir "Norbert.lnk"

    $ws = New-Object -ComObject WScript.Shell
    $shortcut = $ws.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetPath
    $shortcut.Save()
} catch {
    Write-Host "Warning: Could not create Start Menu shortcut." -ForegroundColor Yellow
}

# --- Register hook receiver startup task ---

Write-Host "Registering hook receiver startup task..."
try {
    $binaryPath = Join-Path $InstallDir $HookReceiverBinary
    $action = New-ScheduledTaskAction -Execute $binaryPath
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Force | Out-Null
    Write-Host "Startup task registered."
} catch {
    Write-Host "Warning: Could not register startup task (non-fatal)." -ForegroundColor Yellow
}

# --- Start hook receiver ---

Write-Host "Starting hook receiver..."
try {
    $binaryPath = Join-Path $InstallDir $HookReceiverBinary
    Start-Process -FilePath $binaryPath
    Write-Host "Hook receiver started."
} catch {
    Write-Host "Warning: Could not start hook receiver (non-fatal)." -ForegroundColor Yellow
}

# --- Success ---

Write-Host ""
Write-Host "Norbert installed successfully!"
Write-Host ""
Write-Host "To connect to Claude Code:"
Write-Host "  /plugin install norbert@pmvanev-plugins"
Write-Host ""

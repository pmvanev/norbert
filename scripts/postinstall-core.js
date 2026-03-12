import path from "node:path";

const GITHUB_REPO = "pmvanev/norbert";
const BINARY_NAME = "norbert";
const HOOK_RECEIVER_BINARY = "norbert-hook-receiver.exe";

export const STARTUP_SHORTCUT_NAME = "NorbertHookReceiver.lnk";

const SUPPORTED_PLATFORMS = new Map([
  ["win32-x64", { os: "win32", arch: "x64", extension: ".tar.gz" }],
  ["linux-x64", { os: "linux", arch: "x64", extension: ".tar.gz" }],
  ["darwin-x64", { os: "darwin", arch: "x64", extension: ".tar.gz" }],
  ["darwin-arm64", { os: "darwin", arch: "arm64", extension: ".tar.gz" }],
]);

export function detectPlatform(os, arch) {
  const key = `${os}-${arch}`;
  const platform = SUPPORTED_PLATFORMS.get(key);

  if (platform) {
    return { ok: true, value: platform };
  }

  return {
    ok: false,
    error: `Unsupported platform: ${os}-${arch}. Supported: ${[...SUPPORTED_PLATFORMS.keys()].join(", ")}`,
  };
}

export function buildAssetFilename(version, platform) {
  return `${BINARY_NAME}-v${version}-${platform.os}-${platform.arch}${platform.extension}`;
}

export function buildDownloadUrl(version, platform) {
  const filename = buildAssetFilename(version, platform);
  return `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${filename}`;
}

export function getInstallDirectory(homeDir) {
  return path.join(homeDir, ".norbert", "bin");
}

export function getStartMenuShortcutPath(appDataDir) {
  return path.join(appDataDir, "Microsoft", "Windows", "Start Menu", "Programs", "Norbert.lnk");
}

function quotePath(filePath) {
  return `'${filePath}'`;
}

function buildBinaryPath(installDir) {
  return path.join(installDir, HOOK_RECEIVER_BINARY);
}

export function buildStartupShortcutCommand(installDir, appDataDir) {
  const binaryPath = buildBinaryPath(installDir);
  const shortcutPath = path.join(appDataDir, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", STARTUP_SHORTCUT_NAME);

  return [
    `$ws = New-Object -ComObject WScript.Shell`,
    `$s = $ws.CreateShortcut(${quotePath(shortcutPath)})`,
    `$s.TargetPath = ${quotePath(binaryPath)}`,
    `$s.WindowStyle = 7`,
    `$s.Save()`,
  ].join("; ");
}

export function buildStartReceiverCommand(installDir) {
  const binaryPath = buildBinaryPath(installDir);
  const quotedPath = quotePath(binaryPath);

  return [
    `Stop-Process -Name 'norbert-hook-receiver' -ErrorAction SilentlyContinue`,
    `Start-Process -FilePath ${quotedPath} -WindowStyle Hidden`,
  ].join("; ");
}

export function encodeForPowerShell(cmd) {
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(cmd);
  // Convert UTF-8 to UTF-16LE: each byte becomes [byte, 0x00]
  const utf16leBytes = new Uint8Array(utf8Bytes.length * 2);
  for (let i = 0; i < utf8Bytes.length; i++) {
    utf16leBytes[i * 2] = utf8Bytes[i];
    utf16leBytes[i * 2 + 1] = 0;
  }
  // Convert to base64
  let binary = "";
  for (let i = 0; i < utf16leBytes.length; i++) {
    binary += String.fromCharCode(utf16leBytes[i]);
  }
  return btoa(binary);
}

export function registerAndStartHookReceiver(installDir, platform, execCommand, appDataDir) {
  if (platform.os !== "win32") {
    return { registered: false, started: false, warnings: [] };
  }

  const warnings = [];
  let registered = false;
  let started = false;

  try {
    const registrationCmd = buildStartupShortcutCommand(installDir, appDataDir);
    const encoded = encodeForPowerShell(registrationCmd);
    execCommand(`powershell -NoProfile -EncodedCommand ${encoded}`);
    registered = true;
  } catch (_registrationError) {
    warnings.push("Could not create startup shortcut (non-fatal).");
  }

  try {
    const startCmd = buildStartReceiverCommand(installDir);
    const encoded = encodeForPowerShell(startCmd);
    execCommand(`powershell -NoProfile -EncodedCommand ${encoded}`);
    started = true;
  } catch (_startError) {
    warnings.push("Could not start hook receiver (non-fatal).");
  }

  return { registered, started, warnings };
}

export function buildInstallSuccessMessage() {
  return [
    "",
    "Norbert installed successfully!",
    "",
    "To connect to Claude Code:",
    "  /plugin install norbert@pmvanev-plugins",
    "",
  ].join("\n");
}

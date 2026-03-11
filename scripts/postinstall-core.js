import path from "node:path";

const GITHUB_REPO = "pmvanev/norbert";
const BINARY_NAME = "norbert";
const HOOK_RECEIVER_BINARY = "norbert-hook-receiver.exe";

export const TASK_NAME = "NorbertHookReceiver";

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

export function buildTaskRegistrationCommand(installDir) {
  const binaryPath = buildBinaryPath(installDir);
  const quotedPath = quotePath(binaryPath);

  return [
    `$action = New-ScheduledTaskAction -Execute ${quotedPath}`,
    `$trigger = New-ScheduledTaskTrigger -AtLogOn`,
    `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Trigger $trigger -Force`,
  ].join("; ");
}

export function buildStartReceiverCommand(installDir) {
  const binaryPath = buildBinaryPath(installDir);
  const quotedPath = quotePath(binaryPath);

  return [
    `Stop-Process -Name 'norbert-hook-receiver' -ErrorAction SilentlyContinue`,
    `Start-Process -FilePath ${quotedPath}`,
  ].join("; ");
}

export function registerAndStartHookReceiver(installDir, platform, execCommand) {
  if (platform.os !== "win32") {
    return { registered: false, started: false, warnings: [] };
  }

  const warnings = [];
  let registered = false;
  let started = false;

  try {
    const registrationCmd = buildTaskRegistrationCommand(installDir);
    execCommand(`powershell -NoProfile -Command "${registrationCmd}"`);
    registered = true;
  } catch (_registrationError) {
    warnings.push("Could not register startup task (non-fatal).");
  }

  try {
    const startCmd = buildStartReceiverCommand(installDir);
    execCommand(`powershell -NoProfile -Command "${startCmd}"`);
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

import path from "node:path";

const GITHUB_REPO = "pmvanev/norbert";
const BINARY_NAME = "norbert";

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

export function buildInstallSuccessMessage() {
  return [
    "",
    "Norbert installed successfully!",
    "",
    "To connect to Claude Code:",
    "  /plugin install norbert@pmvanev-marketplace",
    "",
  ].join("\n");
}

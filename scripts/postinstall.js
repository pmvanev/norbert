#!/usr/bin/env node

import { createWriteStream, mkdirSync, existsSync, unlinkSync, renameSync, chmodSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { extract } from "tar";
import path from "node:path";
import os from "node:os";
import { detectPlatform, buildDownloadUrl, getInstallDirectory } from "./postinstall-core.js";

async function downloadFile(url, destPath) {
  const tempPath = `${destPath}.tmp`;

  try {
    const response = await fetch(url, { redirect: "follow" });

    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
    }

    const fileStream = createWriteStream(tempPath);
    await pipeline(response.body, fileStream);
    renameSync(tempPath, destPath);
  } catch (error) {
    // Clean up partial file on failure
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch (_cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

async function extractTarGz(archivePath, destDir) {
  await extract({
    file: archivePath,
    cwd: destDir,
  });
}

async function postinstall() {
  const packageJson = await import("../package.json", { with: { type: "json" } });
  const version = packageJson.default.version;

  const platformResult = detectPlatform(process.platform, process.arch);

  if (!platformResult.ok) {
    console.error(`Error: ${platformResult.error}`);
    process.exit(1);
  }

  const platform = platformResult.value;
  const installDir = getInstallDirectory(os.homedir());
  const downloadUrl = buildDownloadUrl(version, platform);
  const archiveName = path.basename(downloadUrl);
  const archivePath = path.join(installDir, archiveName);

  console.log(`Installing norbert v${version} for ${platform.os}-${platform.arch}...`);
  console.log(`Download URL: ${downloadUrl}`);
  console.log(`Install directory: ${installDir}`);

  // Create install directory
  mkdirSync(installDir, { recursive: true });

  try {
    // Download the archive
    console.log("Downloading...");
    await downloadFile(downloadUrl, archivePath);

    // Extract the archive
    console.log("Extracting...");
    await extractTarGz(archivePath, installDir);

    // Clean up the archive
    unlinkSync(archivePath);

    // Make binary executable on Unix
    if (platform.os !== "win32") {
      const binaryPath = path.join(installDir, "norbert-cc");
      if (existsSync(binaryPath)) {
        chmodSync(binaryPath, 0o755);
      }
    }

    console.log("Installation complete!");
    console.log(`Binary installed to: ${installDir}`);
  } catch (error) {
    // Clean up any partial files on failure
    try {
      if (existsSync(archivePath)) {
        unlinkSync(archivePath);
      }
    } catch (_cleanupError) {
      // Ignore cleanup errors
    }

    if (error.cause?.code === "ENOTFOUND" || error.cause?.code === "ECONNREFUSED" || error.message.includes("fetch failed")) {
      console.error(`\nNetwork error: Unable to download norbert binary.`);
      console.error(`URL: ${downloadUrl}`);
      console.error(`\nPlease check your network connection and try again.`);
      console.error(`You can retry by running: npm run postinstall`);
    } else {
      console.error(`\nInstallation failed: ${error.message}`);
      console.error(`You can retry by running: npm run postinstall`);
    }

    process.exit(1);
  }
}

postinstall();

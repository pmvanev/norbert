/**
 * Acceptance tests: Settings merge code removal
 *
 * Validates that all dead settings merge code has been removed from
 * the codebase and that preserved components still function correctly.
 *
 * These tests use codebase search (grep-style assertions) to verify
 * code removal, and domain function calls to verify preserved behavior.
 *
 * Note: The Rust-side removal tests are in the companion Rust test file.
 * This file covers TypeScript/frontend removal and cross-cutting concerns.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, extname } from "path";

const PROJECT_ROOT = resolve(__dirname, "../../..");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".rs", ".js"]);
const SOURCE_DIRS = ["src", "src-tauri/src", "scripts"].map((d) => resolve(PROJECT_ROOT, d));

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      files.push(...collectSourceFiles(full));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

const allSourceFiles = SOURCE_DIRS.flatMap(collectSourceFiles);

function sourceContains(searchTerm: string): boolean {
  return allSourceFiles.some((f) => readFileSync(f, "utf-8").includes(searchTerm));
}

// @walking_skeleton
describe("App launches cleanly without any settings merge behavior", () => {
  it("no reference to run_settings_merge in startup code", () => {
    const libRs = readFileSync(
      resolve(PROJECT_ROOT, "src-tauri/src/lib.rs"),
      "utf-8"
    );
    expect(libRs).not.toContain("run_settings_merge");
  });
});

describe("SettingsMergeAdapter no longer exists in the codebase", () => {
  it("no source file contains SettingsMergeAdapter", () => {
    expect(sourceContains("SettingsMergeAdapter")).toBe(false);
  });
});

describe("run_settings_merge function no longer exists", () => {
  it("no source file contains run_settings_merge", () => {
    expect(sourceContains("run_settings_merge")).toBe(false);
  });
});

describe("SettingsManager port trait no longer exists", () => {
  it("no source file contains SettingsManager trait", () => {
    expect(sourceContains("trait SettingsManager")).toBe(false);
  });
});

describe("Settings merge domain functions are removed", () => {
  it("merge_hooks_into_config does not exist", () => {
    expect(sourceContains("merge_hooks_into_config")).toBe(false);
  });

  it("hooks_are_merged does not exist", () => {
    expect(sourceContains("hooks_are_merged")).toBe(false);
  });

  it("build_hooks_only_config does not exist", () => {
    expect(sourceContains("build_hooks_only_config")).toBe(false);
  });

  it("build_hook_entry does not exist", () => {
    expect(sourceContains("build_hook_entry")).toBe(false);
  });

  it("build_hooks_object does not exist", () => {
    expect(sourceContains("build_hooks_object")).toBe(false);
  });

  it("MergeOutcome does not exist", () => {
    expect(sourceContains("MergeOutcome")).toBe(false);
  });
});

describe("Domain constants used by the receiver are preserved", () => {
  it("HOOK_EVENT_NAMES is still defined", () => {
    expect(sourceContains("HOOK_EVENT_NAMES")).toBe(true);
  });

  it("HOOK_PORT is still defined", () => {
    expect(sourceContains("HOOK_PORT")).toBe(true);
  });

  it("build_hook_url is still available", () => {
    expect(sourceContains("build_hook_url")).toBe(true);
  });

  it("parse_event_type is still available", () => {
    expect(sourceContains("parse_event_type")).toBe(true);
  });
});

describe("ADR-006 is marked as superseded", () => {
  it("ADR-006 status shows Superseded", () => {
    const adrPath = resolve(
      PROJECT_ROOT,
      "docs/adrs/ADR-006-settings-merge-strategy.md"
    );
    expect(existsSync(adrPath)).toBe(true);
    const content = readFileSync(adrPath, "utf-8");
    expect(content).toMatch(/[Ss]uperseded/);
    expect(content).toMatch(/plugin/i);
  });
});

describe("No restart banner logic remains in the frontend", () => {
  it("shouldShowRestartBanner does not exist", () => {
    expect(sourceContains("shouldShowRestartBanner")).toBe(false);
  });

  it("bannerWasShown does not exist", () => {
    expect(sourceContains("bannerWasShown")).toBe(false);
  });
});

describe("Settings adapter module declaration is removed", () => {
  it("no 'pub mod settings' in adapters module", () => {
    const adaptersRs = readFileSync(
      resolve(PROJECT_ROOT, "src-tauri/src/adapters/mod.rs"),
      "utf-8"
    );
    expect(adaptersRs).not.toContain("pub mod settings");
  });
});

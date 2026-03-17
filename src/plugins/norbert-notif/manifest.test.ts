/// Unit tests for norbert-notif manifest.
///
/// Verifies manifest identity, version, and dependency declarations.

import { describe, it, expect } from "vitest";
import { NORBERT_NOTIF_MANIFEST } from "./manifest";

describe("norbert-notif manifest", () => {
  it("declares plugin id as norbert-notif", () => {
    expect(NORBERT_NOTIF_MANIFEST.id).toBe("norbert-notif");
  });

  it("declares no plugin dependencies", () => {
    expect(NORBERT_NOTIF_MANIFEST.dependencies).toEqual({});
  });

  it("declares a valid version string", () => {
    expect(NORBERT_NOTIF_MANIFEST.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("declares a norbert_api compatibility range", () => {
    expect(NORBERT_NOTIF_MANIFEST.norbert_api).toBeTruthy();
  });
});

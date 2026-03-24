import { describe, it, expect } from "vitest";
import {
  deriveStatusLabel,
  deriveStatusClass,
  deriveSessionRowClass,
  deriveSessionDotClass,
} from "./sessionPresentation";

describe("deriveStatusLabel", () => {
  it("returns 'Active' when session is active", () => {
    expect(deriveStatusLabel(true)).toBe("Active");
  });

  it("returns 'Completed' when session is not active", () => {
    expect(deriveStatusLabel(false)).toBe("Completed");
  });
});

describe("deriveStatusClass", () => {
  it("returns 'status-active' when session is active", () => {
    expect(deriveStatusClass(true)).toBe("status-active");
  });

  it("returns 'status-completed' when session is not active", () => {
    expect(deriveStatusClass(false)).toBe("status-completed");
  });
});

describe("deriveSessionRowClass", () => {
  it("returns 'srow live-s' when session is active", () => {
    expect(deriveSessionRowClass(true)).toBe("srow live-s");
  });

  it("returns 'srow' when session is not active", () => {
    expect(deriveSessionRowClass(false)).toBe("srow");
  });
});

describe("deriveSessionDotClass", () => {
  it("returns 'sdot live' when session is active", () => {
    expect(deriveSessionDotClass(true)).toBe("sdot live");
  });

  it("returns 'sdot done' when session is not active", () => {
    expect(deriveSessionDotClass(false)).toBe("sdot done");
  });
});

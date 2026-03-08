import { describe, it, expect } from "vitest";
import { formatHeader, formatField, type AppStatus } from "./status";

describe("formatHeader", () => {
  it("uppercases app name and prepends v to version", () => {
    const result = formatHeader("Norbert", "0.1.0");
    expect(result).toBe("NORBERT v0.1.0");
  });

  it("works with any app name and version", () => {
    const result = formatHeader("myapp", "2.3.4");
    expect(result).toBe("MYAPP v2.3.4");
  });
});

describe("formatField", () => {
  it("formats status field", () => {
    expect(formatField("Status", "Listening")).toBe("Status: Listening");
  });

  it("formats port field with number", () => {
    expect(formatField("Port", 3748)).toBe("Port: 3748");
  });

  it("formats sessions field with zero", () => {
    expect(formatField("Sessions", 0)).toBe("Sessions: 0");
  });

  it("formats events field with zero", () => {
    expect(formatField("Events", 0)).toBe("Events: 0");
  });
});

describe("AppStatus type", () => {
  it("represents initial status with correct shape", () => {
    const status: AppStatus = {
      version: "0.1.0",
      status: "Listening",
      port: 3748,
      session_count: 0,
      event_count: 0,
    };

    expect(status.version).toBe("0.1.0");
    expect(status.status).toBe("Listening");
    expect(status.port).toBe(3748);
    expect(status.session_count).toBe(0);
    expect(status.event_count).toBe(0);
  });
});

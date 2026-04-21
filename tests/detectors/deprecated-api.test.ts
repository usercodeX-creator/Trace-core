import { describe, it, expect } from "vitest";
import { deprecatedApi } from "../../src/detectors/deprecated-api.js";

const ctx = (code: string, language: "python" | "javascript" | "typescript" = "python") => ({
  filePath: "test.py",
  content: code,
  language,
});

describe("deprecated-api", () => {
  // ── Python positive cases ──

  it("flags os.exists in Python", async () => {
    const detections = await deprecatedApi.run(ctx('if os.exists("/tmp/foo"):\n    pass'));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("medium");
    expect(detections[0].line).toBe(1);
    expect(detections[0].message).toContain("os.path.exists()");
  });

  it("flags os.makedir in Python", async () => {
    const detections = await deprecatedApi.run(ctx('os.makedir("/tmp/new")'));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("os.makedirs()");
  });

  it("flags sys.argvs in Python", async () => {
    const detections = await deprecatedApi.run(ctx("args = sys.argvs"));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("sys.argv");
  });

  it("flags .has_key in Python", async () => {
    const detections = await deprecatedApi.run(ctx('if d.has_key("x"):'));
    expect(detections).toHaveLength(1);
  });

  it("flags import urllib2 in Python", async () => {
    const detections = await deprecatedApi.run(ctx("import urllib2"));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("urllib.request");
  });

  // ── Python negative cases ──

  it("does NOT flag os.path.exists", async () => {
    const detections = await deprecatedApi.run(ctx('if os.path.exists("/tmp/foo"):'));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag os.exists inside a comment", async () => {
    const detections = await deprecatedApi.run(ctx("# os.exists is deprecated"));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag os.exists inside a string literal", async () => {
    const detections = await deprecatedApi.run(ctx('msg = "use os.exists for that"'));
    expect(detections).toHaveLength(0);
  });

  // ── JS positive cases ──

  it("flags .contains() in JavaScript", async () => {
    const detections = await deprecatedApi.run(ctx('arr.contains("x")', "javascript"));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain(".includes()");
  });

  it("flags escape() in JavaScript", async () => {
    const detections = await deprecatedApi.run(ctx('var x = escape("hello")', "javascript"));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("encodeURIComponent()");
  });

  // ── JS negative cases ──

  it("does NOT flag .contains() inside a comment", async () => {
    const detections = await deprecatedApi.run(ctx('// arr.contains("x")', "javascript"));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag .contains() inside a string", async () => {
    const detections = await deprecatedApi.run(ctx('var s = "arr.contains(x)"', "javascript"));
    expect(detections).toHaveLength(0);
  });
});

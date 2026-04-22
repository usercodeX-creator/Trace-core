import { describe, it, expect } from "vitest";
import { envNoFallback } from "../../src/detectors/env-no-fallback.js";

const jsCtx = (code: string) => ({
  filePath: "config.js",
  content: code,
  language: "javascript" as const,
});

const pyCtx = (code: string) => ({
  filePath: "settings.py",
  content: code,
  language: "python" as const,
});

describe("env-no-fallback", () => {
  // ── Python positive cases ──

  it("flags os.environ[] bracket access in Python", async () => {
    const detections = await envNoFallback.run(pyCtx('SECRET_KEY = os.environ["DJANGO_SECRET"]'));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("medium");
    expect(detections[0].message).toContain("os.environ.get()");
  });

  // ── JS positive cases ──

  it("flags process.env without fallback in JS", async () => {
    const detections = await envNoFallback.run(jsCtx("const apiKey = process.env.OPENAI_API_KEY;"));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("fallback");
  });

  it("flags let assignment without fallback", async () => {
    const detections = await envNoFallback.run(jsCtx("let dbUrl = process.env.DATABASE_URL;"));
    expect(detections).toHaveLength(1);
  });

  // ── Negative cases ──

  it("does NOT flag os.environ.get with default in Python", async () => {
    const detections = await envNoFallback.run(pyCtx('SECRET_KEY = os.environ.get("DJANGO_SECRET", "dev-default")'));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag process.env with || fallback in JS", async () => {
    const detections = await envNoFallback.run(jsCtx('const apiKey = process.env.OPENAI_API_KEY || "test-key";'));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag process.env with ?? fallback in JS", async () => {
    const detections = await envNoFallback.run(jsCtx('const apiKey = process.env.OPENAI_API_KEY ?? "default";'));
    expect(detections).toHaveLength(0);
  });

  it("does NOT run on Go files", async () => {
    const detections = await envNoFallback.run({
      filePath: "main.go",
      content: 'const x = process.env.FOO;',
      language: "go",
    });
    expect(detections).toHaveLength(0);
  });
});

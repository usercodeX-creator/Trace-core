import { describe, it, expect } from "vitest";
import { insecureRng } from "../../src/detectors/insecure-rng.js";

const jsCtx = (code: string) => ({
  filePath: "auth.js",
  content: code,
  language: "javascript" as const,
});

const pyCtx = (code: string) => ({
  filePath: "auth.py",
  content: code,
  language: "python" as const,
});

describe("insecure-rng", () => {
  // ── JS positive cases ──

  it("flags Math.random for sessionToken in JS", async () => {
    const detections = await insecureRng.run(jsCtx("const sessionToken = Math.random().toString(36);"));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("high");
    expect(detections[0].message).toContain("Math.random()");
  });

  it("flags Math.random for authKey in JS", async () => {
    const detections = await insecureRng.run(jsCtx("let authKey = Math.random();"));
    expect(detections).toHaveLength(1);
  });

  // ── Python positive cases ──

  it("flags random.randint for api_key in Python", async () => {
    const detections = await insecureRng.run(pyCtx('api_key = "sk_" + str(random.randint(1000000, 9999999))'));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("random module");
  });

  // ── Negative cases ──

  it("does NOT flag crypto.randomUUID", async () => {
    const detections = await insecureRng.run(jsCtx("const sessionId = crypto.randomUUID();"));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag secrets module in Python", async () => {
    const detections = await insecureRng.run(pyCtx("api_key = secrets.token_urlsafe(32)"));
    expect(detections).toHaveLength(0);
  });

  it("does NOT run on Go files", async () => {
    const detections = await insecureRng.run({
      filePath: "main.go",
      content: "token := Math.random()",
      language: "go",
    });
    expect(detections).toHaveLength(0);
  });
});

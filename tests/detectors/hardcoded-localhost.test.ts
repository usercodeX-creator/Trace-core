import { describe, it, expect } from "vitest";
import { hardcodedLocalhost } from "../../src/detectors/hardcoded-localhost.js";

const ctx = (code: string, filePath = "config.js", language: "javascript" | "python" | "go" = "javascript") => ({
  filePath,
  content: code,
  language,
});

describe("hardcoded-localhost", () => {
  // ── Positive cases ──

  it("flags http://localhost:3000 in JS", async () => {
    const detections = await hardcodedLocalhost.run(ctx('const API_URL = "http://localhost:3000/api";'));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("medium");
    expect(detections[0].message).toContain("localhost");
  });

  it("flags http://127.0.0.1 in Python", async () => {
    const detections = await hardcodedLocalhost.run(ctx('BACKEND = "http://127.0.0.1:8000"', "config.py", "python"));
    expect(detections).toHaveLength(1);
  });

  it("flags http://localhost in Go", async () => {
    const detections = await hardcodedLocalhost.run(ctx('const endpoint = "http://localhost:8080"', "main.go", "go"));
    expect(detections).toHaveLength(1);
  });

  // ── Negative cases (test files) ──

  it("does NOT flag in __tests__ directory", async () => {
    const detections = await hardcodedLocalhost.run(
      ctx('const TEST_URL = "http://localhost:3000";', "__tests__/api.test.js")
    );
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag in .test. files", async () => {
    const detections = await hardcodedLocalhost.run(
      ctx('const url = "http://localhost:3000";', "api.test.js")
    );
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag in /tests/ path", async () => {
    const detections = await hardcodedLocalhost.run(
      ctx('url = "http://localhost:5000"', "tests/test_api.py", "python")
    );
    expect(detections).toHaveLength(0);
  });
});

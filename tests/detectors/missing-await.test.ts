import { describe, it, expect } from "vitest";
import { missingAwait } from "../../src/detectors/missing-await.js";

const ctx = (code: string, language: "javascript" | "typescript" = "javascript") => ({
  filePath: "app.js",
  content: code,
  language,
});

describe("missing-await", () => {
  // ── Positive cases ──

  it("flags fetch() without await", async () => {
    const detections = await missingAwait.run(ctx('const data = fetch("/api/users");\nconsole.log(data.name);'));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("high");
    expect(detections[0].message).toContain("fetch");
  });

  it("flags prisma call without await in TypeScript", async () => {
    const detections = await missingAwait.run(
      ctx("async function load() {\n  const user = prisma.user.findFirst({ where: { id } });\n  return user.email;\n}", "typescript")
    );
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("prisma");
  });

  it("flags axios.get without await", async () => {
    const detections = await missingAwait.run(ctx('const res = axios.get("/users");'));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("axios");
  });

  // ── Negative cases ──

  it("does NOT flag fetch with await", async () => {
    const detections = await missingAwait.run(ctx('const data = await fetch("/api/users");'));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag fetch with .then()", async () => {
    const detections = await missingAwait.run(ctx('const data = fetch("/api/users").then(r => r.json());'));
    expect(detections).toHaveLength(0);
  });

  it("does NOT run on Python files", async () => {
    const detections = await missingAwait.run({
      filePath: "app.py",
      content: 'const data = fetch("/api");',
      language: "python",
    });
    expect(detections).toHaveLength(0);
  });
});

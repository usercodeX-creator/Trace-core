import { describe, it, expect } from "vitest";
import { dynamicEval } from "../../src/detectors/dynamic-eval.js";

const jsCtx = (code: string) => ({
  filePath: "app.js",
  content: code,
  language: "javascript" as const,
});

const pyCtx = (code: string) => ({
  filePath: "app.py",
  content: code,
  language: "python" as const,
});

describe("dynamic-eval", () => {
  // ── JS positive cases ──

  it("flags eval(userInput) in JS", async () => {
    const detections = await dynamicEval.run(jsCtx("const result = eval(userInput);"));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("critical");
    expect(detections[0].message).toContain("JavaScript");
    expect(detections[0].message).toContain("eval");
  });

  it("flags Function(code) in JS", async () => {
    const detections = await dynamicEval.run(jsCtx("const fn = Function(code);"));
    expect(detections).toHaveLength(1);
  });

  // ── Python positive cases ──

  it("flags eval(expr) in Python", async () => {
    const detections = await dynamicEval.run(pyCtx("def run_formula(expr):\n    return eval(expr)"));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("Python");
  });

  it("flags exec(code) in Python", async () => {
    const detections = await dynamicEval.run(pyCtx("exec(user_code)"));
    expect(detections).toHaveLength(1);
  });

  // ── Negative cases ──

  it("does NOT flag eval with string literal in JS", async () => {
    const detections = await dynamicEval.run(jsCtx('const result = eval("1 + 2");'));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag eval with string literal in Python", async () => {
    const detections = await dynamicEval.run(pyCtx('config = eval("[1, 2, 3]")'));
    expect(detections).toHaveLength(0);
  });

  it("does NOT run on Rust files", async () => {
    const detections = await dynamicEval.run({
      filePath: "main.rs",
      content: "eval(x)",
      language: "rust",
    });
    expect(detections).toHaveLength(0);
  });
});

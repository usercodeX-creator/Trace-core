import { describe, it, expect } from "vitest";
import { rustPanicMacro } from "../../../src/detectors/rust/panic-macro.js";
import type { DetectorContext } from "../../../src/types.js";

function rustCtx(content: string, filePath = "main.rs"): DetectorContext {
  return { filePath, content, language: "rust" as any };
}

describe("Rust Panic Macro Detector", () => {
  it("1. panic!() in production code produces 1 medium detection", async () => {
    const ctx = rustCtx(`if err { panic!("failed"); }`);
    const d = await rustPanicMacro.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("medium");
    expect(d[0]!.message).toContain("panic!()");
  });

  it("2. panic!() preceded by #[should_panic] within 3 lines produces 0 detections", async () => {
    const ctx = rustCtx([
      `#[test]`,
      `#[should_panic]`,
      `fn test_it() {`,
      `  panic!("expected");`,
      `}`,
    ].join("\n"));
    // The file is not a _test.rs and has no #[cfg(test)], but #[should_panic] skips the match
    const d = await rustPanicMacro.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("3. test file (_test.rs) produces 0 detections", async () => {
    const ctx = rustCtx(`panic!("boom");`, "integration_test.rs");
    const d = await rustPanicMacro.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("4. normal code without panic produces 0 detections", async () => {
    const ctx = rustCtx([
      `fn safe() -> Result<(), String> {`,
      `  Err("something went wrong".to_string())`,
      `}`,
    ].join("\n"));
    const d = await rustPanicMacro.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("5. non-Rust language produces 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "main.py",
      content: `panic!("failed")`,
      language: "python" as any,
    };
    const d = await rustPanicMacro.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("6. multiple panics produce correct count", async () => {
    const ctx = rustCtx([
      `fn bad_one() { panic!("first"); }`,
      `fn bad_two() { panic!("second"); }`,
      `fn bad_three() { panic!("third"); }`,
    ].join("\n"));
    const d = await rustPanicMacro.run(ctx);
    expect(d).toHaveLength(3);
    expect(d.every((det) => det.severity === "medium")).toBe(true);
  });
});

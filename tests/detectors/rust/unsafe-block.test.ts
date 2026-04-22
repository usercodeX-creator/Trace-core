import { describe, it, expect } from "vitest";
import { rustUnsafeBlock } from "../../../src/detectors/rust/unsafe-block.js";
import type { DetectorContext } from "../../../src/types.js";

function rustCtx(content: string, filePath = "main.rs"): DetectorContext {
  return { filePath, content, language: "rust" as any };
}

describe("Rust Unsafe Block Detector", () => {
  it("1. unsafe block produces 1 critical detection with block message", async () => {
    const ctx = rustCtx(`unsafe { *ptr = 5; }`);
    const d = await rustUnsafeBlock.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("unsafe block");
  });

  it("2. unsafe fn produces 1 critical detection with fn message", async () => {
    const ctx = rustCtx(`unsafe fn raw_pointer() { }`);
    const d = await rustUnsafeBlock.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("unsafe function");
  });

  it("3. both unsafe block and unsafe fn in same file produce 2 critical detections", async () => {
    const ctx = rustCtx([
      `unsafe fn do_stuff() {`,
      `  unsafe { *ptr = 10; }`,
      `}`,
    ].join("\n"));
    const d = await rustUnsafeBlock.run(ctx);
    expect(d).toHaveLength(2);
    expect(d.every((det) => det.severity === "critical")).toBe(true);
  });

  it("4. safe code without unsafe produces 0 detections", async () => {
    const ctx = rustCtx([
      `fn safe_function() -> Result<(), Box<dyn Error>> {`,
      `  let x = 42;`,
      `  Ok(())`,
      `}`,
    ].join("\n"));
    const d = await rustUnsafeBlock.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("5. non-Rust language produces 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "main.go",
      content: `unsafe { *ptr = 5; }`,
      language: "go" as any,
    };
    const d = await rustUnsafeBlock.run(ctx);
    expect(d).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import { rustTodoMacro } from "../../../src/detectors/rust/todo-macro.js";
import type { DetectorContext } from "../../../src/types.js";

function rustCtx(content: string, filePath = "main.rs"): DetectorContext {
  return { filePath, content, language: "rust" as any };
}

describe("Rust Todo Macro Detector", () => {
  it("1. todo!() produces 1 medium detection", async () => {
    const ctx = rustCtx(`fn process() { todo!() }`);
    const d = await rustTodoMacro.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("medium");
    expect(d[0]!.message).toContain("todo!()");
  });

  it("2. unimplemented!() produces 1 medium detection", async () => {
    const ctx = rustCtx(`fn handle() { unimplemented!() }`);
    const d = await rustTodoMacro.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("medium");
    expect(d[0]!.message).toContain("unimplemented!()");
  });

  it("3. todo!() inside #[test] function produces 0 detections", async () => {
    const ctx = rustCtx([
      `#[test]`,
      `fn test_something() {`,
      `  todo!()`,
      `}`,
    ].join("\n"));
    const d = await rustTodoMacro.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("4. test file (_test.rs) produces 0 detections", async () => {
    const ctx = rustCtx(`fn process() { todo!() }`, "handler_test.rs");
    const d = await rustTodoMacro.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("5. file with #[cfg(test)] produces 0 detections", async () => {
    const ctx = rustCtx([
      `#[cfg(test)]`,
      `mod tests {`,
      `  fn it_works() { todo!() }`,
      `}`,
    ].join("\n"));
    const d = await rustTodoMacro.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("6. non-Rust language produces 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "main.ts",
      content: `fn process() { todo!() }`,
      language: "typescript" as any,
    };
    const d = await rustTodoMacro.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("7. both todo! and unimplemented! in same file produce 2 detections", async () => {
    const ctx = rustCtx([
      `fn first() { todo!() }`,
      `fn second() { unimplemented!() }`,
    ].join("\n"));
    const d = await rustTodoMacro.run(ctx);
    expect(d).toHaveLength(2);
    expect(d[0]!.message).toContain("todo!()");
    expect(d[1]!.message).toContain("unimplemented!()");
  });
});

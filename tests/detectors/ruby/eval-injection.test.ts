import { describe, it, expect } from "vitest";
import { rubyEvalInjection } from "../../../src/detectors/ruby/eval-injection.js";
import type { DetectorContext } from "../../../src/types.js";

function rubyCtx(content: string, filePath = "app.rb"): DetectorContext {
  return { filePath, content, language: "ruby" as any };
}

describe("Ruby Eval Injection Detector", () => {
  // ─── Positive cases ────────────────────────────────────────────

  it("1. eval(user_input) → 1 critical", async () => {
    const ctx = rubyCtx(`eval(user_input)`);
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.detector).toBe("ruby/eval-injection");
  });

  it("2. instance_eval(code) → 1 critical", async () => {
    const ctx = rubyCtx(`instance_eval(code)`);
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("3. obj.send(params[:method]) → 1 critical", async () => {
    const ctx = rubyCtx(`obj.send(params[:method])`);
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("4. class_eval(variable) → 1 critical", async () => {
    const ctx = rubyCtx(`class_eval(variable)`);
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("5. obj.public_send(params[:action]) → 1 critical", async () => {
    const ctx = rubyCtx(`obj.public_send(params[:action])`);
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  // ─── Negative cases ────────────────────────────────────────────

  it("6. eval('1 + 1') → 0 (string literal)", async () => {
    const ctx = rubyCtx(`eval("1 + 1")`);
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("7. obj.send(:static_method) → 0 (symbol literal)", async () => {
    const ctx = rubyCtx(`obj.send(:static_method)`);
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("8. Non-Ruby language → 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "app.js",
      content: `eval(user_input)`,
      language: "javascript" as any,
    };
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(0);
  });

  // ─── Edge cases ────────────────────────────────────────────────

  it("9. multiple evals on separate lines → multiple detections", async () => {
    const ctx = rubyCtx(`
eval(code_a)
instance_eval(code_b)
`);
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(2);
  });

  it("10. module_eval(dynamic_string) → 1 critical", async () => {
    const ctx = rubyCtx(`module_eval(dynamic_string)`);
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("11. eval with single-quoted string literal → 0", async () => {
    const ctx = rubyCtx(`eval('puts hello')`);
    const d = await rubyEvalInjection.run(ctx);
    expect(d).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import { rubySilentRescue } from "../../../src/detectors/ruby/silent-rescue.js";
import type { DetectorContext } from "../../../src/types.js";

function rubyCtx(content: string, filePath = "app.rb"): DetectorContext {
  return { filePath, content, language: "ruby" as any };
}

describe("Ruby Silent Rescue Detector", () => {
  // ─── Positive cases ────────────────────────────────────────────

  it("1. inline rescue nil → 1 critical", async () => {
    const ctx = rubyCtx(`foo() rescue nil`);
    const d = await rubySilentRescue.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.detector).toBe("ruby/silent-rescue");
  });

  it("2. empty rescue block (rescue/end with nothing) → 1 critical", async () => {
    const ctx = rubyCtx(`
begin
  foo()
rescue
end
`);
    const d = await rubySilentRescue.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("3. rescue => e followed immediately by end → 1 critical", async () => {
    const ctx = rubyCtx(`
begin
  foo()
rescue => e
end
`);
    const d = await rubySilentRescue.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("4. rescue with only blank lines before end → 1 critical", async () => {
    const ctx = rubyCtx(`
begin
  foo()
rescue


end
`);
    const d = await rubySilentRescue.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("5. rescue with only comments before end → 1 critical", async () => {
    const ctx = rubyCtx(`
begin
  foo()
rescue
  # TODO: handle this
end
`);
    const d = await rubySilentRescue.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  // ─── Negative cases ────────────────────────────────────────────

  it("6. rescue with logger.error → 0 (substantive body)", async () => {
    const ctx = rubyCtx(`
begin
  foo()
rescue => e
  logger.error(e)
end
`);
    const d = await rubySilentRescue.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("7. rescue with raise → 0 (re-raise)", async () => {
    const ctx = rubyCtx(`
begin
  foo()
rescue => e
  raise
end
`);
    const d = await rubySilentRescue.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("8. Non-Ruby language → 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "app.py",
      content: `foo() rescue nil`,
      language: "python" as any,
    };
    const d = await rubySilentRescue.run(ctx);
    expect(d).toHaveLength(0);
  });

  // ─── Edge cases ────────────────────────────────────────────────

  it("9. multiple silent rescues → multiple detections", async () => {
    const ctx = rubyCtx(`
a = foo() rescue nil
b = bar() rescue nil
`);
    const d = await rubySilentRescue.run(ctx);
    expect(d).toHaveLength(2);
  });

  it("10. rescue with real recovery logic → 0 detections", async () => {
    const ctx = rubyCtx(`
begin
  foo()
rescue => e
  fallback_value = compute_default()
end
`);
    const d = await rubySilentRescue.run(ctx);
    expect(d).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import { fakeTypeSafety } from "../../src/detectors/fake-type-safety.js";

const ctx = (code: string, language: "python" | "javascript" | "typescript" = "typescript") => ({
  filePath: "test.ts",
  content: code,
  language,
});

describe("fake-type-safety", () => {
  // ── TypeScript positive cases ──

  it("flags : any annotation", async () => {
    const detections = await fakeTypeSafety.run(ctx("function foo(x: any) {}"));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("medium");
    expect(detections[0].message).toContain("`any`");
  });

  it("flags as any cast", async () => {
    const detections = await fakeTypeSafety.run(ctx("const x = y as any;"));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("medium");
  });

  it("flags @ts-ignore without explanation", async () => {
    const detections = await fakeTypeSafety.run(ctx("// @ts-ignore\nfoo();"));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("high");
  });

  it("flags @ts-nocheck", async () => {
    const detections = await fakeTypeSafety.run(ctx("// @ts-nocheck\nconst x = 1;"));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("high");
  });

  it("flags @ts-expect-error without explanation", async () => {
    const detections = await fakeTypeSafety.run(ctx("// @ts-expect-error\nfoo();"));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("medium");
  });

  // ── TypeScript negative cases ──

  it("does NOT flag : any inside a string", async () => {
    const detections = await fakeTypeSafety.run(ctx('const s = "type: any value";'));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag @ts-ignore with explanation", async () => {
    const detections = await fakeTypeSafety.run(ctx("// @ts-ignore — legacy API returns wrong type"));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag @ts-expect-error with explanation", async () => {
    const detections = await fakeTypeSafety.run(ctx("// @ts-expect-error testing invalid input"));
    expect(detections).toHaveLength(0);
  });

  // ── Python positive cases ──

  it("flags # type: ignore without reason in Python", async () => {
    const detections = await fakeTypeSafety.run(ctx("x = foo()  # type: ignore", "python"));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("high");
  });

  it("flags : Any annotation in Python", async () => {
    const detections = await fakeTypeSafety.run(ctx("def foo(x: Any) -> None:", "python"));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("medium");
  });

  it("flags cast(Any, x) in Python", async () => {
    const detections = await fakeTypeSafety.run(ctx("y = cast(Any, x)", "python"));
    expect(detections).toHaveLength(1);
  });

  // ── Python negative cases ──

  it("does NOT flag # type: ignore[assignment] (has error code)", async () => {
    const detections = await fakeTypeSafety.run(ctx("x = foo()  # type: ignore[assignment]", "python"));
    expect(detections).toHaveLength(0);
  });
});

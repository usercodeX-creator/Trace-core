import { describe, it, expect } from "vitest";
import { meaninglessTest } from "../../src/detectors/meaningless-test.js";

const ctx = (code: string, language: "python" | "javascript" | "typescript" = "javascript") => ({
  filePath: "test.spec.ts",
  content: code,
  language,
});

describe("meaningless-test", () => {
  // ── JS/TS positive cases ──

  it("flags expect(true).toBe(true)", async () => {
    const detections = await meaninglessTest.run(ctx('it("works", () => {\n  expect(true).toBe(true);\n});'));
    expect(detections).toHaveLength(1);
    expect(detections[0].severity).toBe("high");
    expect(detections[0].message).toContain("Tautological");
  });

  it("flags expect(false).toBe(false)", async () => {
    const detections = await meaninglessTest.run(ctx("expect(false).toBe(false)"));
    expect(detections).toHaveLength(1);
  });

  it("flags expect(1).toBe(1)", async () => {
    const detections = await meaninglessTest.run(ctx("expect(1).toBe(1)"));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("literal compared to itself");
  });

  it('flags expect("str").toBeDefined()', async () => {
    const detections = await meaninglessTest.run(ctx('expect("hello").toBeDefined()'));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("always defined");
  });

  it("flags it.skip()", async () => {
    const detections = await meaninglessTest.run(ctx('it.skip("todo", () => {})'));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("Skipped");
  });

  it("flags xit()", async () => {
    const detections = await meaninglessTest.run(ctx('xit("disabled", () => {})'));
    expect(detections).toHaveLength(1);
  });

  it("flags test.todo()", async () => {
    const detections = await meaninglessTest.run(ctx('test.todo("implement later")'));
    expect(detections).toHaveLength(1);
  });

  // ── JS/TS negative cases ──

  it("does NOT flag meaningful assertion", async () => {
    const detections = await meaninglessTest.run(ctx("expect(result).toBe(42)"));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag commented-out tautology", async () => {
    const detections = await meaninglessTest.run(ctx("// expect(true).toBe(true)"));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag regular it()", async () => {
    const detections = await meaninglessTest.run(ctx('it("works", () => { expect(x).toBe(1); })'));
    expect(detections).toHaveLength(0);
  });

  // ── Python positive cases ──

  it("flags assert True in Python", async () => {
    const detections = await meaninglessTest.run(ctx("def test_it():\n    assert True", "python"));
    expect(detections).toHaveLength(1);
    expect(detections[0].message).toContain("assert True");
  });

  it("flags assert 1 == 1 in Python", async () => {
    const detections = await meaninglessTest.run(ctx("    assert 1 == 1", "python"));
    expect(detections).toHaveLength(1);
  });

  it('flags assert "string" in Python', async () => {
    const detections = await meaninglessTest.run(ctx('    assert "truthy"', "python"));
    expect(detections).toHaveLength(1);
  });

  it("flags @pytest.mark.skip() without reason", async () => {
    const detections = await meaninglessTest.run(ctx("@pytest.mark.skip()\ndef test_x():", "python"));
    expect(detections).toHaveLength(1);
  });

  // ── Python negative cases ──

  it("does NOT flag assert with comparison", async () => {
    const detections = await meaninglessTest.run(ctx("    assert result == expected", "python"));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag @pytest.mark.skip with reason", async () => {
    const detections = await meaninglessTest.run(ctx('@pytest.mark.skip(reason="broken")\ndef test_x():', "python"));
    expect(detections).toHaveLength(0);
  });

  it("does NOT flag commented assert True", async () => {
    const detections = await meaninglessTest.run(ctx("    # assert True", "python"));
    expect(detections).toHaveLength(0);
  });
});

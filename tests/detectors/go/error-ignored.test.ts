import { describe, it, expect } from "vitest";
import { goErrorIgnored } from "../../../src/detectors/go/error-ignored.js";
import type { DetectorContext } from "../../../src/types.js";

function goCtx(content: string, filePath = "main.go"): DetectorContext {
  return { filePath, content, language: "go" as any };
}

describe("Go Error Ignored Detector", () => {
  it("1. detects both returns discarded '_, _ := json.Unmarshal(...)' — 1 critical", async () => {
    const ctx = goCtx(`  _, _ := json.Unmarshal(data, &obj)`);
    const d = await goErrorIgnored.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("discarded");
  });

  it("2. detects error discarded 'x, _ := strconv.Atoi(s)' — 1 critical", async () => {
    const ctx = goCtx(`  x, _ := strconv.Atoi(s)`);
    const d = await goErrorIgnored.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("3. detects single error discard '_ = file.Close()' — 1 critical", async () => {
    const ctx = goCtx(`  _ = file.Close()`);
    const d = await goErrorIgnored.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("4. allows properly captured error 'err := json.Unmarshal(...)' — 0 detections", async () => {
    const ctx = goCtx(`  err := json.Unmarshal(data, &obj)`);
    const d = await goErrorIgnored.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("5. allows properly captured error 'result, err := fn()' — 0 detections", async () => {
    const ctx = goCtx(`  result, err := fn()`);
    const d = await goErrorIgnored.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("6. skips non-Go language — 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "main.py",
      content: `  _, _ := json.Unmarshal(data, &obj)`,
      language: "python" as any,
    };
    const d = await goErrorIgnored.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("7. detects multiple ignored errors in same file", async () => {
    const ctx = goCtx([
      `  x, _ := strconv.Atoi(a)`,
      `  y, _ := strconv.Atoi(b)`,
      `  _ = file.Close()`,
    ].join("\n"));
    const d = await goErrorIgnored.run(ctx);
    expect(d).toHaveLength(3);
    expect(d[0]!.line).toBe(1);
    expect(d[1]!.line).toBe(2);
    expect(d[2]!.line).toBe(3);
  });
});

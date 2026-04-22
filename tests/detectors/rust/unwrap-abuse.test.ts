import { describe, it, expect } from "vitest";
import { rustUnwrapAbuse } from "../../../src/detectors/rust/unwrap-abuse.js";
import type { DetectorContext } from "../../../src/types.js";

function rustCtx(content: string, filePath = "main.rs"): DetectorContext {
  return { filePath, content, language: "rust" as any };
}

describe("Rust Unwrap Abuse Detector", () => {
  it("1. single .unwrap() produces 1 low-severity detection", async () => {
    const ctx = rustCtx(`let val = result.unwrap();`);
    const d = await rustUnwrapAbuse.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("low");
    expect(d[0]!.message).toContain(".unwrap()");
  });

  it("2. three .unwrap() calls produce 4 detections (1 medium file-level + 3 low)", async () => {
    const ctx = rustCtx([
      `let a = x.unwrap();`,
      `let b = y.unwrap();`,
      `let c = z.unwrap();`,
    ].join("\n"));
    const d = await rustUnwrapAbuse.run(ctx);
    expect(d).toHaveLength(4);
    expect(d[0]!.severity).toBe("medium");
    expect(d[0]!.message).toContain(".unwrap() calls");
    expect(d[1]!.severity).toBe("low");
    expect(d[2]!.severity).toBe("low");
    expect(d[3]!.severity).toBe("low");
  });

  it("3. test file (_test.rs) produces 0 detections", async () => {
    const ctx = rustCtx(`let val = result.unwrap();`, "parser_test.rs");
    const d = await rustUnwrapAbuse.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("4. file with #[cfg(test)] produces 0 detections", async () => {
    const ctx = rustCtx([
      `#[cfg(test)]`,
      `mod tests {`,
      `  let val = result.unwrap();`,
      `}`,
    ].join("\n"));
    const d = await rustUnwrapAbuse.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("5. file without any .unwrap() produces 0 detections", async () => {
    const ctx = rustCtx(`let val = result?;\nlet other = maybe.unwrap_or(0);`);
    const d = await rustUnwrapAbuse.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("6. non-Rust language produces 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "main.py",
      content: `let val = result.unwrap();`,
      language: "python" as any,
    };
    const d = await rustUnwrapAbuse.run(ctx);
    expect(d).toHaveLength(0);
  });
});

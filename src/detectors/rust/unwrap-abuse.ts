/**
 * Detector: Rust Unwrap Abuse
 *
 * Detects excessive `.unwrap()` usage in non-test Rust code. Each call site
 * is flagged at low severity; if 3+ unwraps exist in a file, a file-level
 * medium warning is emitted at the first occurrence.
 */

import type { Detector, DetectorContext, Detection } from "../../types.js";

const UNWRAP_RE = /\.unwrap\s*\(\)/g;
const EXPECT_RE = /\.expect\s*\([^)]*\)/g;

function isTestFile(ctx: DetectorContext): boolean {
  if (ctx.filePath.endsWith("_test.rs")) return true;
  if (ctx.content.includes("#[cfg(test)]")) return true;
  return false;
}

export const rustUnwrapAbuse: Detector = {
  id: "rust/unwrap-abuse" as any,
  name: "Rust Unwrap Abuse",
  description:
    "Detects excessive .unwrap() usage in non-test Rust code that can cause panics at runtime.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if (ctx.language !== ("rust" as any)) return [];
    if (isTestFile(ctx)) return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      UNWRAP_RE.lastIndex = 0;
      EXPECT_RE.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = UNWRAP_RE.exec(line)) !== null) {
        detections.push({
          detector: "rust/unwrap-abuse" as any,
          severity: "low",
          file: ctx.filePath,
          line: i + 1,
          column: match.index + 1,
          message:
            ".unwrap() can panic at runtime — use ? operator or proper error handling",
          rawCode: line.trimStart(),
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }

      while ((match = EXPECT_RE.exec(line)) !== null) {
        detections.push({
          detector: "rust/unwrap-abuse" as any,
          severity: "low",
          file: ctx.filePath,
          line: i + 1,
          column: match.index + 1,
          message:
            ".expect() can panic at runtime — use ? operator or proper error handling",
          rawCode: line.trimStart(),
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    // If 3+ unwraps, emit a file-level medium warning at the first occurrence
    if (detections.length >= 3) {
      const first = detections[0]!;
      detections.unshift({
        detector: "rust/unwrap-abuse" as any,
        severity: "medium",
        file: ctx.filePath,
        line: first.line,
        column: first.column,
        message: `File contains ${detections.length - 1} .unwrap()/.expect() calls — consider systematic error handling with Result<T, E>`,
        rawCode: first.rawCode,
        suggestedFix: null,
        dependencyContext: null,
        auditTrail: null,
      });
    }

    return detections;
  },
};

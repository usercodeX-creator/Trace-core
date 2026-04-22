/**
 * Detector: Rust Panic Macro
 *
 * Detects `panic!()` calls in production Rust code. Panics should be replaced
 * with proper error handling via Result<T, E>.
 */

import type { Detector, DetectorContext, Detection } from "../../types.js";

const PANIC_RE = /\bpanic\s*!\s*\(/g;

function isTestFile(ctx: DetectorContext): boolean {
  if (ctx.filePath.endsWith("_test.rs")) return true;
  if (ctx.content.includes("#[cfg(test)]")) return true;
  return false;
}

export const rustPanicMacro: Detector = {
  id: "rust/panic-macro" as any,
  name: "Rust Panic Macro",
  description:
    "Detects panic!() calls in production code that should use Result<T, E> instead.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if (ctx.language !== ("rust" as any)) return [];
    if (isTestFile(ctx)) return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      PANIC_RE.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = PANIC_RE.exec(line)) !== null) {
        // Skip if #[should_panic] appears within 3 lines before
        const lookbackStart = Math.max(0, i - 3);
        let shouldSkip = false;

        for (let j = lookbackStart; j < i; j++) {
          if (lines[j]!.includes("#[should_panic]")) {
            shouldSkip = true;
            break;
          }
        }

        if (shouldSkip) continue;

        detections.push({
          detector: "rust/panic-macro" as any,
          severity: "medium",
          file: ctx.filePath,
          line: i + 1,
          column: match.index + 1,
          message:
            "panic!() in production code — use Result<T, E> for proper error handling",
          rawCode: line.trimStart(),
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    return detections;
  },
};

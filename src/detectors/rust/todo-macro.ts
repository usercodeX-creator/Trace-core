/**
 * Detector: Rust Todo Macro
 *
 * Detects `todo!()` and `unimplemented!()` macros in non-test Rust code.
 * These macros panic at runtime and indicate incomplete implementation.
 */

import type { Detector, DetectorContext, Detection } from "../../types.js";

const TODO_RE = /\b(?:todo|unimplemented)\s*!\s*\(/g;

function isTestFile(ctx: DetectorContext): boolean {
  if (ctx.filePath.endsWith("_test.rs")) return true;
  if (ctx.content.includes("#[cfg(test)]")) return true;
  return false;
}

export const rustTodoMacro: Detector = {
  id: "rust/todo-macro" as any,
  name: "Rust Todo Macro",
  description:
    "Detects todo!() and unimplemented!() macros that will panic at runtime.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if (ctx.language !== ("rust" as any)) return [];
    if (isTestFile(ctx)) return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    // Track #[test] annotation for function-level skipping.
    // Simple heuristic: if we saw #[test] within the last 3 lines before
    // a `fn` definition, treat everything until the next `fn` as test code.
    let insideTestFn = false;
    let testAnnotationLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();

      // Track #[test] annotations
      if (trimmed === "#[test]" || trimmed.startsWith("#[test]")) {
        testAnnotationLine = i;
      }

      // Track fn boundaries
      if (/\bfn\b/.test(trimmed)) {
        // If #[test] appeared within the last 3 lines, this is a test function
        if (testAnnotationLine >= 0 && i - testAnnotationLine <= 3) {
          insideTestFn = true;
        } else {
          insideTestFn = false;
        }
      }

      if (insideTestFn) continue;

      TODO_RE.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = TODO_RE.exec(line)) !== null) {
        const macroName = line.slice(match.index).startsWith("todo")
          ? "todo"
          : "unimplemented";

        const message =
          macroName === "todo"
            ? "todo!() macro will panic at runtime — replace with proper implementation"
            : "unimplemented!() macro will panic at runtime";

        detections.push({
          detector: "rust/todo-macro" as any,
          severity: "medium",
          file: ctx.filePath,
          line: i + 1,
          column: match.index + 1,
          message,
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

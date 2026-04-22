import type { Detector, DetectorContext, Detection } from "../../types.js";

/**
 * Pattern: error return value blanked with `_`.
 *
 * Matches:
 *   x, _ := fn(...)       — second return (error) discarded
 *   _, _ := fn(...)        — both returns discarded
 *   _ = fn(...)            — single error return discarded
 *   _ := fn(...)           — short-declaration discard
 */
const ERROR_IGNORED_RE = /^\s*(?:\w+\s*,\s*)?_\s*(?::=|=)\s*\w+.*\(/;

export const goErrorIgnored: Detector = {
  id: "go/error-ignored" as any,
  name: "Go Error Ignored",
  description: "Detects patterns where Go error return values are explicitly discarded.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if ((ctx.language as string) !== "go") return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      if (ERROR_IGNORED_RE.test(line)) {
        detections.push({
          detector: "go/error-ignored" as any,
          severity: "critical",
          file: ctx.filePath,
          line: i + 1,
          message: "Error return value explicitly discarded with `_` — errors should be checked",
          rawCode: line.trimEnd(),
          suggestedFix: "Handle the error: check with `if err != nil { ... }`",
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    return detections;
  },
};

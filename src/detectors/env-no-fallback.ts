/**
 * Detector: env-no-fallback
 *
 * Flags environment variable access without a fallback — crashes at runtime
 * if the variable is missing. Single-line regex, no AST.
 */

import type { Detector, DetectorContext, Detection } from "../types.js";

const PY_ENV_RE = /\bos\.environ\s*\[\s*['"][\w_]+['"]\s*\]/;
const JS_ENV_RE = /\b(const|let|var)\s+\w+\s*=\s*process\.env\.[A-Z_][A-Z0-9_]*\s*;?\s*$/;

export const envNoFallback: Detector = {
  id: "env-no-fallback",
  name: "Env No Fallback",
  description:
    "Detects environment variable access without a fallback — crashes on startup if the var is missing.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if (
      ctx.language !== "javascript" &&
      ctx.language !== "typescript" &&
      ctx.language !== "python"
    )
      return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      let match: RegExpExecArray | null = null;

      if (ctx.language === "python") {
        match = PY_ENV_RE.exec(line);
      } else {
        // JS/TS: skip lines with || or ?? (fallback present)
        if (/\|\||(\?\?)/.test(line)) continue;
        match = JS_ENV_RE.exec(line);
      }

      if (!match) continue;

      const langHint =
        ctx.language === "python"
          ? "Use `os.environ.get()` with a default value."
          : "Add a fallback with `||` or `??`.";

      detections.push({
        detector: "env-no-fallback",
        severity: "medium",
        file: ctx.filePath,
        line: i + 1,
        column: match.index + 1,
        message: `Environment variable access without fallback — crashes if unset. ${langHint}`,
        rawCode: line.trim(),
        suggestedFix: null,
        dependencyContext: null,
        auditTrail: null,
      });
    }

    return detections;
  },
};

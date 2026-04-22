/**
 * Detector: dynamic-eval
 *
 * Flags eval/new Function/exec called with a non-string-literal argument
 * (i.e., a variable) — code injection vector. Single-line regex, no AST.
 *
 * Distinct from ruby/eval-injection which covers Ruby's eval.
 */

import type { Detector, DetectorContext, Detection } from "../types.js";

const JS_DYNAMIC_EVAL_RE = /\b(eval|Function)\s*\(\s*(?!['"`])[\w$]/;
const PY_DYNAMIC_EVAL_RE = /\b(eval|exec)\s*\(\s*(?!['"])(\w)/;

export const dynamicEval: Detector = {
  id: "dynamic-eval",
  name: "Dynamic Eval",
  description:
    "Detects eval/Function/exec called with variable arguments — code injection vector.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if (
      ctx.language !== "javascript" &&
      ctx.language !== "typescript" &&
      ctx.language !== "python"
    )
      return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];
    const re = ctx.language === "python" ? PY_DYNAMIC_EVAL_RE : JS_DYNAMIC_EVAL_RE;
    const langLabel = ctx.language === "python" ? "Python" : "JavaScript";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = re.exec(line);
      if (!match) continue;

      detections.push({
        detector: "dynamic-eval",
        severity: "critical",
        file: ctx.filePath,
        line: i + 1,
        column: match.index + 1,
        message: `${langLabel} \`${match[1]}\` called with dynamic argument — code injection risk.`,
        rawCode: line.trim(),
        suggestedFix: null,
        dependencyContext: null,
        auditTrail: null,
      });
    }

    return detections;
  },
};

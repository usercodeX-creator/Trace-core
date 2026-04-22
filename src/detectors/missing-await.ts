/**
 * Detector: missing-await
 *
 * Flags assignment of known-async calls without `await`, where the result
 * is a Promise instead of the resolved value. Single-line regex, no AST.
 */

import type { Detector, DetectorContext, Detection } from "../types.js";

const ASYNC_CALL_RE =
  /\b(const|let|var)\s+(\w+)\s*=\s*(fetch|axios(?:\.(?:get|post|put|delete|patch|request))?|supabase\.(?:\w+\.)?\w+|prisma\.\w+\.\w+|openai\.\w+\.\w+|anthropic\.\w+\.\w+|db\.\w+)\s*\(/;

export const missingAwait: Detector = {
  id: "missing-await",
  name: "Missing Await",
  description:
    "Detects assignment of known-async calls without await — result is a Promise, not the resolved value.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if (ctx.language !== "javascript" && ctx.language !== "typescript") return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Guard: skip if line already has await or .then(
      if (/\bawait\b/.test(line) || /\.then\s*\(/.test(line)) continue;

      const match = ASYNC_CALL_RE.exec(line);
      if (!match) continue;

      detections.push({
        detector: "missing-await",
        severity: "high",
        file: ctx.filePath,
        line: i + 1,
        column: match.index + 1,
        message: `Missing \`await\` on async call \`${match[3]}\` — variable holds a Promise, not the resolved value.`,
        rawCode: line.trim(),
        suggestedFix: null,
        dependencyContext: null,
        auditTrail: null,
      });
    }

    return detections;
  },
};

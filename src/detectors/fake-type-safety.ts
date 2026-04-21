/**
 * Detector: fake-type-safety
 *
 * Catches patterns that defeat type checking: `: any`, `as any`,
 * `@ts-ignore`/`@ts-nocheck`/`@ts-expect-error` without explanation,
 * and Python equivalents (`# type: ignore`, `Any`).
 */

import type { Detector, DetectorContext, Detection, Severity } from "../types.js";

interface TypePattern {
  pattern: RegExp;
  severity: Severity;
  message: string;
}

const TS_PATTERNS: TypePattern[] = [
  {
    pattern: /:\s*any\b/g,
    severity: "medium",
    message: "Type annotation `any` defeats TypeScript checks. Use a specific type or `unknown`.",
  },
  {
    pattern: /\bas\s+any\b/g,
    severity: "medium",
    message: "Cast to `any` defeats TypeScript checks. Narrow with a specific type.",
  },
  {
    pattern: /\/\/\s*@ts-ignore\s*$/gm,
    severity: "high",
    message: "`@ts-ignore` without an explanation comment. Why is this safe?",
  },
  {
    pattern: /\/\/\s*@ts-nocheck\b/g,
    severity: "high",
    message: "`@ts-nocheck` disables type checking for the entire file.",
  },
  {
    pattern: /\/\/\s*@ts-expect-error\s*$/gm,
    severity: "medium",
    message: "`@ts-expect-error` without an explanation comment.",
  },
];

const PY_PATTERNS: TypePattern[] = [
  {
    pattern: /#\s*type:\s*ignore\s*$/gm,
    severity: "high",
    message: "`# type: ignore` without a specific error code or reason.",
  },
  {
    pattern: /:\s*Any\b/g,
    severity: "medium",
    message: "Type annotation `Any` defeats type checking. Use a specific type.",
  },
  {
    pattern: /\bcast\s*\(\s*Any\b/g,
    severity: "medium",
    message: "Cast to `Any` defeats type checking.",
  },
];

/**
 * Strip string literals to avoid false positives. Keep comments for
 * detectors that specifically look inside comments (@ts-ignore etc).
 */
function stripStrings(line: string): string {
  return line.replace(/(["'])(?:(?!\1|\\).|\\.)*\1/g, '""');
}

export const fakeTypeSafety: Detector = {
  id: "fake-type-safety",
  name: "Fake Type Safety",
  description:
    "Catches patterns that defeat type checking: `: any`, `as any`, `@ts-ignore` without explanation, and Python equivalents.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];
    const patterns = ctx.language === "python" ? PY_PATTERNS : TS_PATTERNS;

    for (let i = 0; i < lines.length; i++) {
      const stripped = stripStrings(lines[i] ?? "");

      for (const pat of patterns) {
        pat.pattern.lastIndex = 0;
        const match = pat.pattern.exec(stripped);
        if (match) {
          detections.push({
            detector: "fake-type-safety",
            severity: pat.severity,
            file: ctx.filePath,
            line: i + 1,
            column: match.index + 1,
            message: pat.message,
            suggestedFix: null,
            dependencyContext: null,
            auditTrail: null,
          });
        }
      }
    }

    return detections;
  },
};

/**
 * Detector: meaningless-test (tautological-test)
 *
 * Catches tests that always pass, tests with no real assertion,
 * skipped tests without reason. High severity — this is dishonest
 * code that lies about test coverage.
 */

import type { Detector, DetectorContext, Detection } from "../types.js";

interface TestPattern {
  pattern: RegExp;
  message: string;
}

const JS_TEST_PATTERNS: TestPattern[] = [
  {
    pattern: /expect\s*\(\s*true\s*\)\s*\.\s*toBe\s*\(\s*true\s*\)/g,
    message: "Tautological test: `expect(true).toBe(true)` always passes.",
  },
  {
    pattern: /expect\s*\(\s*false\s*\)\s*\.\s*toBe\s*\(\s*false\s*\)/g,
    message: "Tautological test: `expect(false).toBe(false)` always passes.",
  },
  {
    pattern: /expect\s*\(\s*(\d+)\s*\)\s*\.\s*toBe\s*\(\s*\1\s*\)/g,
    message: "Tautological test: literal compared to itself.",
  },
  {
    pattern: /expect\s*\(\s*['"`][^'"`]*['"`]\s*\)\s*\.\s*toBeDefined\s*\(\s*\)/g,
    message: "Tautological test: string literals are always defined.",
  },
  {
    pattern: /\b(it|test|describe)\.(skip|todo)\s*\(/g,
    message: "Skipped/todo test contributes no coverage.",
  },
  {
    pattern: /\bx(it|describe)\s*\(/g,
    message: "Skipped test (xit/xdescribe) contributes no coverage.",
  },
];

const PY_TEST_PATTERNS: TestPattern[] = [
  {
    pattern: /^\s*assert\s+True\s*$/gm,
    message: "Tautological assertion: `assert True` always passes.",
  },
  {
    pattern: /^\s*assert\s+(\d+)\s*==\s*\1\s*$/gm,
    message: "Tautological assertion: literal compared to itself.",
  },
  {
    pattern: /^\s*assert\s+['"`][^'"`\n]+['"`]\s*$/gm,
    message: "Tautological assertion: non-empty string literal is always truthy.",
  },
  {
    pattern: /@pytest\.mark\.skip\s*\(\s*\)/g,
    message: "Test skipped without reason.",
  },
  {
    pattern: /@unittest\.skip\s*\(\s*\)/g,
    message: "Test skipped without reason.",
  },
  {
    pattern: /raise\s+unittest\.SkipTest\s*\(\s*\)/g,
    message: "Test skipped without reason.",
  },
];

/**
 * Strip line comments to avoid false positives on commented-out assertions.
 */
function stripLineComments(line: string, lang: string): string {
  if (lang === "python") {
    return line.replace(/#.*$/, "");
  }
  return line.replace(/\/\/.*$/, "");
}

export const meaninglessTest: Detector = {
  id: "tautological-test",
  name: "Meaningless Test",
  description:
    "Catches tautological assertions, tests that always pass, and skipped tests without reason.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    const detections: Detection[] = [];
    const patterns = ctx.language === "python" ? PY_TEST_PATTERNS : JS_TEST_PATTERNS;

    // For multiline patterns, operate on the full content with comments stripped per line
    const lines = ctx.content.split("\n");
    const strippedLines = lines.map((l) => stripLineComments(l, ctx.language));
    const strippedContent = strippedLines.join("\n");

    for (const pat of patterns) {
      pat.pattern.lastIndex = 0;
      let match;
      while ((match = pat.pattern.exec(strippedContent)) !== null) {
        // Compute line number from match index
        const beforeMatch = strippedContent.slice(0, match.index);
        const line = beforeMatch.split("\n").length;

        detections.push({
          detector: "tautological-test",
          severity: "high",
          file: ctx.filePath,
          line,
          column: match.index - beforeMatch.lastIndexOf("\n"),
          message: pat.message,
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    // Sort by line
    detections.sort((a, b) => a.line - b.line);

    return detections;
  },
};

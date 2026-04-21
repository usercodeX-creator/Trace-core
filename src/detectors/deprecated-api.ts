/**
 * Detector: deprecated-api
 *
 * Catches misuse of non-existent or deprecated stdlib/framework APIs.
 * Regex-based, no AST, no network calls.
 */

import type { Detector, DetectorContext, Detection } from "../types.js";

interface DeprecatedPattern {
  pattern: RegExp;
  suggestion: string;
}

const PY_DEPRECATED: DeprecatedPattern[] = [
  { pattern: /\bos\.exists\s*\(/g, suggestion: "os.path.exists()" },
  { pattern: /\bos\.makedir\s*\(/g, suggestion: "os.makedirs() or os.mkdir()" },
  { pattern: /\bsys\.argvs\b/g, suggestion: "sys.argv" },
  { pattern: /\.has_key\s*\(/g, suggestion: "use `in` operator" },
  { pattern: /\.replaceall\s*\(/g, suggestion: ".replace() (replaces all by default)" },
  { pattern: /\bimport\s+urllib2\b/g, suggestion: "urllib.request (Python 3)" },
];

const JS_DEPRECATED: DeprecatedPattern[] = [
  { pattern: /\.contains\s*\([^)]*\)/g, suggestion: ".includes() for arrays/strings" },
  { pattern: /\.replaceall\s*\(/g, suggestion: ".replaceAll() (note camelCase)" },
  { pattern: /\bdocument\.layers\b/g, suggestion: "document.querySelectorAll()" },
  { pattern: /\bescape\s*\(/g, suggestion: "encodeURIComponent()" },
  { pattern: /\bunescape\s*\(/g, suggestion: "decodeURIComponent()" },
];

/**
 * Strip line comments and basic string literals to avoid false positives.
 */
function stripCommentsAndStrings(line: string, lang: string): string {
  // Remove string literals (simple: single/double quoted, not multi-line)
  let stripped = line.replace(/(["'])(?:(?!\1|\\).|\\.)*\1/g, '""');
  // Remove line comments
  if (lang === "python") {
    stripped = stripped.replace(/#.*$/, "");
  } else {
    stripped = stripped.replace(/\/\/.*$/, "");
  }
  return stripped;
}

export const deprecatedApi: Detector = {
  id: "deprecated-api",
  name: "Deprecated API Misuse",
  description:
    "Catches misuse of non-existent or deprecated stdlib/framework APIs in Python and JS/TS.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];
    const patterns = ctx.language === "python" ? PY_DEPRECATED : JS_DEPRECATED;

    for (let i = 0; i < lines.length; i++) {
      const stripped = stripCommentsAndStrings(lines[i] ?? "", ctx.language);

      for (const dep of patterns) {
        // Reset regex lastIndex for each line
        dep.pattern.lastIndex = 0;
        const match = dep.pattern.exec(stripped);
        if (match) {
          detections.push({
            detector: "deprecated-api",
            severity: "medium",
            file: ctx.filePath,
            line: i + 1,
            column: match.index + 1,
            message: `Deprecated/non-existent API: \`${match[0].trim()}\`. Use \`${dep.suggestion}\` instead.`,
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

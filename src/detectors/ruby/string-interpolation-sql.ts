/**
 * Ruby Detector: String Interpolation in SQL
 *
 * Detects string interpolation (`#{...}`) inside ActiveRecord / raw SQL
 * query methods. This is the Ruby equivalent of SQL injection via string
 * concatenation — parameterized queries should be used instead.
 *
 * Heuristic, regex-based — flags interpolation inside common query
 * methods but does not perform full AST analysis.
 */

import type { Detector, DetectorContext, Detection } from "../../types.js";

const SQL_INTERPOLATION_RE =
  /\.(?:where|find_by_sql|execute|select|joins|having|order|group|from)\s*\(\s*["'].*#\{/g;

export const rubyStringInterpolationSql: Detector = {
  id: "ruby/string-interpolation-sql" as any,
  name: "Ruby SQL String Interpolation",
  description:
    "Detects string interpolation inside SQL queries — use parameterized queries instead.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if ((ctx.language as string) !== "ruby") return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      SQL_INTERPOLATION_RE.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = SQL_INTERPOLATION_RE.exec(line)) !== null) {
        detections.push({
          detector: "ruby/string-interpolation-sql" as any,
          severity: "critical",
          file: ctx.filePath,
          line: i + 1,
          column: match.index + 1,
          message:
            "SQL query with string interpolation \u2014 use parameterized queries instead",
          rawCode: line.trim(),
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    return detections;
  },
};

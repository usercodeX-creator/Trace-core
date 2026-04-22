import type { Detector, DetectorContext, Detection } from "../../types.js";

/**
 * Pattern 1: SQL keywords inside fmt.Sprintf call.
 * e.g. fmt.Sprintf("SELECT * FROM users WHERE id = %d", id)
 */
const SPRINTF_SQL_RE = /fmt\.Sprintf\s*\([^)]*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/i;

/**
 * Pattern 2: String concatenation building SQL queries.
 * e.g. "SELECT * FROM users WHERE name = '" + userName + "'"
 */
const CONCAT_SQL_RE = /"[^"]*(?:SELECT|INSERT|UPDATE|DELETE|DROP)[^"]*"\s*\+/i;

export const goSprintfSql: Detector = {
  id: "go/sprintf-sql" as any,
  name: "Go Sprintf SQL Injection",
  description: "Detects SQL queries built with fmt.Sprintf or string concatenation, which may be vulnerable to SQL injection.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if ((ctx.language as string) !== "go") return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      if (SPRINTF_SQL_RE.test(line)) {
        detections.push({
          detector: "go/sprintf-sql" as any,
          severity: "critical",
          file: ctx.filePath,
          line: i + 1,
          message: "SQL query built with fmt.Sprintf — use parameterized queries to prevent SQL injection",
          rawCode: line.trimEnd(),
          suggestedFix: "Use db.Query/db.Exec with parameter placeholders: db.Query(\"SELECT * FROM users WHERE id = $1\", id)",
          dependencyContext: null,
          auditTrail: null,
        });
      } else if (CONCAT_SQL_RE.test(line)) {
        detections.push({
          detector: "go/sprintf-sql" as any,
          severity: "critical",
          file: ctx.filePath,
          line: i + 1,
          message: "SQL query built with string concatenation — use parameterized queries to prevent SQL injection",
          rawCode: line.trimEnd(),
          suggestedFix: "Use db.Query/db.Exec with parameter placeholders instead of string concatenation",
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    return detections;
  },
};

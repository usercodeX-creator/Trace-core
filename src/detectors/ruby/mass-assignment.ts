/**
 * Ruby Detector: Mass Assignment
 *
 * Detects ActiveRecord mass assignment using raw params without strong
 * parameters. Passing unsanitized `params` to model constructors or update
 * methods allows attackers to set arbitrary attributes.
 *
 * Heuristic, regex-based — flags `params` as the argument but not
 * `params.permit(...)`, `safe_params`, or other derived variables.
 */

import type { Detector, DetectorContext, Detection } from "../../types.js";

const CLASS_METHOD_RE =
  /\b[A-Z]\w*\.(?:new|create|create!|update|update!|update_attributes)\s*\(\s*params\b(?!\s*\.permit)/g;

const INSTANCE_METHOD_RE =
  /\b\w+\.update\s*\(\s*params\b(?!\s*\.permit)/g;

export const rubyMassAssignment: Detector = {
  id: "ruby/mass-assignment" as any,
  name: "Ruby Mass Assignment",
  description:
    "Detects ActiveRecord mass assignment with raw params — use strong parameters (params.permit(...)) instead.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if ((ctx.language as string) !== "ruby") return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      for (const re of [CLASS_METHOD_RE, INSTANCE_METHOD_RE]) {
        re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(line)) !== null) {
          detections.push({
            detector: "ruby/mass-assignment" as any,
            severity: "critical",
            file: ctx.filePath,
            line: i + 1,
            column: match.index + 1,
            message:
              "Mass assignment with raw params \u2014 use strong parameters (params.permit(...))",
            rawCode: line.trim(),
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

/**
 * Ruby Detector: Silent Rescue
 *
 * Detects rescue blocks that silently swallow exceptions:
 *   - Inline `rescue nil`
 *   - Empty rescue blocks (rescue ... end with no meaningful body)
 *   - rescue => e followed immediately by end
 *
 * These hide real errors and make debugging extremely difficult.
 * Heuristic, regex-based.
 */

import type { Detector, DetectorContext, Detection } from "../../types.js";

const INLINE_RESCUE_NIL_RE = /\brescue\s+nil\b/g;

export const rubySilentRescue: Detector = {
  id: "ruby/silent-rescue" as any,
  name: "Ruby Silent Rescue",
  description:
    "Detects rescue blocks that silently swallow all exceptions \u2014 handle or re-raise the error.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if ((ctx.language as string) !== "ruby") return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Pattern 1: inline rescue nil
      INLINE_RESCUE_NIL_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = INLINE_RESCUE_NIL_RE.exec(line)) !== null) {
        detections.push({
          detector: "ruby/silent-rescue" as any,
          severity: "critical",
          file: ctx.filePath,
          line: i + 1,
          column: match.index + 1,
          message:
            "Silent rescue swallows all exceptions \u2014 handle or re-raise the error",
          rawCode: line.trim(),
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }

      // Pattern 2 & 3: rescue block followed by end with no meaningful body
      const rescueMatch = line.match(/^\s*rescue\b/);
      if (rescueMatch) {
        let isEmpty = true;
        for (let j = i + 1; j < lines.length; j++) {
          const subsequent = lines[j]!.trim();

          // Reached end — check if body was empty
          if (/^\bend\b/.test(subsequent)) {
            if (isEmpty) {
              detections.push({
                detector: "ruby/silent-rescue" as any,
                severity: "critical",
                file: ctx.filePath,
                line: i + 1,
                column: 1,
                message:
                  "Silent rescue swallows all exceptions \u2014 handle or re-raise the error",
                rawCode: line.trim(),
                suggestedFix: null,
                dependencyContext: null,
                auditTrail: null,
              });
            }
            break;
          }

          // Skip blank lines and comment-only lines
          if (subsequent === "" || /^#/.test(subsequent)) continue;

          // Any other content means the rescue body is not empty
          isEmpty = false;
          break;
        }
      }
    }

    return detections;
  },
};

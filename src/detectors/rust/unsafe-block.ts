/**
 * Detector: Rust Unsafe Block
 *
 * Detects `unsafe { ... }` blocks and `unsafe fn` declarations. Every
 * occurrence is flagged critical — AI-generated code using unsafe to silence
 * the borrow checker deserves human review.
 */

import type { Detector, DetectorContext, Detection } from "../../types.js";

const UNSAFE_BLOCK_RE = /\bunsafe\s*\{/g;
const UNSAFE_FN_RE = /\bunsafe\s+fn\b/g;

export const rustUnsafeBlock: Detector = {
  id: "rust/unsafe-block" as any,
  name: "Rust Unsafe Block",
  description:
    "Detects unsafe blocks and unsafe fn declarations that bypass Rust's safety guarantees.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if (ctx.language !== ("rust" as any)) return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      UNSAFE_BLOCK_RE.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = UNSAFE_BLOCK_RE.exec(line)) !== null) {
        detections.push({
          detector: "rust/unsafe-block" as any,
          severity: "critical",
          file: ctx.filePath,
          line: i + 1,
          column: match.index + 1,
          message:
            "unsafe block bypasses Rust's safety guarantees",
          rawCode: line.trimStart(),
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }

      UNSAFE_FN_RE.lastIndex = 0;

      while ((match = UNSAFE_FN_RE.exec(line)) !== null) {
        detections.push({
          detector: "rust/unsafe-block" as any,
          severity: "critical",
          file: ctx.filePath,
          line: i + 1,
          column: match.index + 1,
          message:
            "unsafe function declaration requires manual memory safety verification",
          rawCode: line.trimStart(),
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    return detections;
  },
};

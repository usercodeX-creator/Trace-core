/**
 * Detector 06: Unsafe Sanitization
 *
 * Detects code where untrusted input reaches a dangerous sink without
 * sanitization. Uses a source + sink co-presence heuristic — not full
 * dataflow analysis.
 *
 * Detection logic:
 * 1. Find tainted sources in file (user input entry points)
 * 2. Find dangerous sinks in file (risky operations)
 * 3. Apply false positive filters (test paths, parameterized queries,
 *    sanitizer presence, hardcoded strings)
 * 4. Score based on co-presence: taint + interpolated sink = high/critical,
 *    "always dangerous" sinks flagged unconditionally
 *
 * Follows ARCHITECTURE.md:
 * - Principle 1: pluggable, standalone module
 * - Principle 3: pure function, no process.argv/stdout
 * - Principle 5: no silent empty returns on parse failure
 */

import type { Detector, DetectorContext, Detection, Severity } from "../types.js";
import { isTestOrExamplePath } from "../lib/secret-patterns.js";
import { hasTaintedSource } from "../lib/taint-sources.js";
import {
  findDangerousSinks,
  hasInterpolation,
  isParameterized,
  hasSanitizer,
  isHardcodedStringSink,
} from "../lib/dangerous-sinks.js";

export const unsafeSanitization: Detector = {
  id: "unsafe-sanitize",
  name: "Unsafe Sanitization",
  description:
    "Detects untrusted input reaching dangerous sinks without sanitization — SQL injection, XSS, command injection, path traversal, deserialization RCE.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    // False positive filter #1: skip test/spec/mock files
    if (isTestOrExamplePath(ctx.filePath)) return [];

    const lines = ctx.content.split("\n");
    const taintPresent = hasTaintedSource(ctx.content, ctx.language);

    // Step 2 from spec: if zero tainted sources AND no always-dangerous sinks,
    // we still need to scan for always-dangerous sinks. So we always scan sinks.
    const sinkMatches = findDangerousSinks(ctx.content, ctx.language);

    if (sinkMatches.length === 0) return [];

    // False positive filter #3: check for sanitizer presence in file
    const sanitizerPresent = hasSanitizer(ctx.content);

    const detections: Detection[] = [];
    const detectedLines = new Set<number>(); // prevent duplicates per line

    // JSX dangerouslySetInnerHTML bypass: flag {{ __html: variable }} unconditionally
    if (ctx.language === "javascript" || ctx.language === "typescript") {
      const jsxDangerousRe = /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:\s*([^"'\s}][^}]*?)\s*\}\s*\}/;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const m = jsxDangerousRe.exec(line);
        if (m) {
          detections.push({
            detector: "unsafe-sanitize",
            severity: "high",
            file: ctx.filePath,
            line: i + 1,
            column: m.index + 1,
            message: "XSS: dangerouslySetInnerHTML with dynamic value — sanitize with DOMPurify or equivalent",
            rawCode: line.trim().length > 100 ? line.trim().slice(0, 100) + "..." : line.trim(),
            suggestedFix: null,
            dependencyContext: null,
            auditTrail: null,
          });
          detectedLines.add(i + 1);
        }
      }
    }

    for (const sink of sinkMatches) {
      // Avoid duplicate detections on the same line
      if (detectedLines.has(sink.line)) continue;

      // dangerouslySetInnerHTML is handled exclusively by the JSX bypass above
      if (sink.label === "dangerouslySetInnerHTML") continue;

      const sinkLine = lines[sink.line - 1] ?? "";

      // False positive filter #4: hardcoded string sink with no interpolation
      if (isHardcodedStringSink(sinkLine, ctx.language, sink.isAssignment)) continue;

      // False positive filter #2: parameterized query
      if (isParameterized(sinkLine)) continue;

      // False positive filter #3: sanitizer present + not always-dangerous
      if (sanitizerPresent && !sink.alwaysDangerous) continue;

      // Determine final severity based on co-presence heuristic
      let severity: Severity;
      let message: string;

      const interpolated = hasInterpolation(sinkLine, ctx.language);
      // Assignment sinks (innerHTML = x) always have data flowing to the sink
      const dataFlows = interpolated || sink.isAssignment;

      if (sink.alwaysDangerous) {
        // Always dangerous (eval, pickle.loads, yaml.load, etc.) — flag unconditionally
        severity = sink.severity;
        message = `${sink.category}: ${sink.label} with untrusted input`;
      } else if (dataFlows && taintPresent) {
        // Data flows to sink + tainted source in file → full severity
        severity = sink.severity;
        message = sink.isAssignment
          ? `${sink.category}: ${sink.label} with tainted source present in file`
          : `${sink.category}: ${sink.label} with ${
              ctx.language === "python" ? "f-string" : "template literal"
            } interpolation`;
      } else if (dataFlows && !taintPresent) {
        // Data flows but no tainted source → lower severity (medium)
        severity = "medium";
        message = `${sink.category}: ${sink.label} (no tainted source detected in file)`;
      } else if (taintPresent) {
        // Non-interpolated, non-assignment sink but taint present → medium
        severity = "medium";
        message = `${sink.category}: ${sink.label} with tainted source present in file`;
      } else {
        // No data flow, no taint → skip for non-always-dangerous
        continue;
      }

      detectedLines.add(sink.line);

      detections.push({
        detector: "unsafe-sanitize",
        severity,
        file: ctx.filePath,
        line: sink.line,
        column: sink.column,
        message,
        rawCode: sink.rawCode,
        suggestedFix: null,
        dependencyContext: null,
        auditTrail: null,
      });
    }

    // Sort by line number, then severity
    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    detections.sort((a, b) => {
      if (a.line !== b.line) return a.line - b.line;
      return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    });

    return detections;
  },
};

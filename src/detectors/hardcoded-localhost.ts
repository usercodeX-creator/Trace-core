/**
 * Detector: hardcoded-localhost
 *
 * Flags string literals containing http://localhost, http://127.0.0.1,
 * http://0.0.0.0 or ws://localhost in non-test code. Single-line regex, no AST.
 */

import type { Detector, DetectorContext, Detection } from "../types.js";

const LOCALHOST_RE =
  /['"`](?:https?|wss?):\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?/;

const TEST_PATH_RE = /(?:(?:^|\/|\\)tests?\/|\.test\.|\.spec\.|__tests__)/;

export const hardcodedLocalhost: Detector = {
  id: "hardcoded-localhost",
  name: "Hardcoded Localhost",
  description:
    "Detects hardcoded localhost/127.0.0.1/0.0.0.0 URLs in non-test code — dev URLs that leak into production.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    // Guard: skip test files
    if (TEST_PATH_RE.test(ctx.filePath)) return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = LOCALHOST_RE.exec(line);
      if (!match) continue;

      detections.push({
        detector: "hardcoded-localhost",
        severity: "medium",
        file: ctx.filePath,
        line: i + 1,
        column: match.index + 1,
        message: "Hardcoded localhost/loopback URL — will not work in production.",
        rawCode: line.trim(),
        suggestedFix: null,
        dependencyContext: null,
        auditTrail: null,
      });
    }

    return detections;
  },
};

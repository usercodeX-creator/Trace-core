import type { Detection } from "../types.js";

/**
 * Format detections as machine-readable JSON.
 *
 * TODO: Extension point — when SARIF output is needed (Phase 2 GitHub integration),
 * add sarif.ts alongside this file.
 */
export function formatJson(detections: Detection[], version: string): string {
  return JSON.stringify(
    {
      version,
      detections,
      summary: {
        total: detections.length,
        bySeverity: {
          critical: detections.filter((d) => d.severity === "critical").length,
          high: detections.filter((d) => d.severity === "high").length,
          medium: detections.filter((d) => d.severity === "medium").length,
          low: detections.filter((d) => d.severity === "low").length,
        },
      },
    },
    null,
    2
  );
}

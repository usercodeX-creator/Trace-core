import chalk from "chalk";
import type { Detection } from "../types.js";

const severityColors: Record<string, (text: string) => string> = {
  critical: chalk.red,
  high: chalk.yellow,
  medium: chalk.yellow,
  low: chalk.gray,
};

/**
 * Format detections as human-readable terminal output with color.
 */
export function formatHuman(detections: Detection[], version: string): string {
  const lines: string[] = [];

  lines.push(`trace-check v${version}`);
  lines.push("");

  if (detections.length === 0) {
    lines.push(chalk.green("No issues found."));
    return lines.join("\n");
  }

  // Group detections by file
  const byFile = new Map<string, Detection[]>();
  for (const d of detections) {
    const list = byFile.get(d.file) ?? [];
    list.push(d);
    byFile.set(d.file, list);
  }

  for (const [file, fileDetections] of byFile) {
    lines.push(file);

    for (const d of fileDetections) {
      const colorFn = severityColors[d.severity] ?? chalk.white;
      const sevLabel = colorFn(`${d.severity}`);
      const lineLabel = `line ${d.line}`;
      lines.push(`  \u2717 ${sevLabel}  ${lineLabel}    ${d.message}`);
      if (d.rawCode) {
        lines.push(`               >  ${chalk.gray(d.rawCode)}`);
      }
    }

    lines.push("");
  }

  const fileCount = byFile.size;
  lines.push(
    `Summary: ${detections.length} issue${detections.length === 1 ? "" : "s"} found across ${fileCount} file${fileCount === 1 ? "" : "s"}.`
  );

  return lines.join("\n");
}

#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import type { Language, Severity } from "./types.js";
import { runDetectors } from "./engine.js";
import { formatHuman } from "./output/human.js";
import { formatJson } from "./output/json.js";

const VERSION = "0.1.0";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const EXTENSION_MAP: Record<string, Language> = {
  ".py": "python",
  ".js": "javascript",
  ".ts": "typescript",
  ".jsx": "javascript",
  ".tsx": "typescript",
};

function detectLanguage(filePath: string): Language | null {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  return EXTENSION_MAP[ext] ?? null;
}

const program = new Command();

program
  .name("trace-check")
  .description("Security checker for AI-generated code")
  .version(VERSION)
  .argument("<file...>", "files to check")
  .option("--json", "output as JSON")
  .option("--fail-on <severity>", "exit 1 if any detection >= severity", "low")
  .action(async (files: string[], opts: { json?: boolean; failOn: string }) => {
    const failOnSeverity = opts.failOn as Severity;
    if (!(failOnSeverity in SEVERITY_ORDER)) {
      console.error(`Error: invalid severity "${opts.failOn}". Must be one of: critical, high, medium, low`);
      process.exit(2);
    }

    const allDetections = [];

    for (const file of files) {
      const filePath = resolve(file);
      const language = detectLanguage(filePath);

      if (!language) {
        console.error(`Error: unsupported file extension for "${file}". Supported: .py, .js, .ts, .jsx, .tsx`);
        process.exit(2);
      }

      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: could not read file "${file}": ${message}`);
        process.exit(2);
      }

      try {
        const detections = await runDetectors({ filePath: file, content, language });
        allDetections.push(...detections);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: detection failed for "${file}": ${message}`);
        process.exit(2);
      }
    }

    // Output
    if (opts.json) {
      console.log(formatJson(allDetections, VERSION));
    } else {
      console.log(formatHuman(allDetections, VERSION));
    }

    // Exit code based on severity threshold
    const hasFailure = allDetections.some(
      (d) => SEVERITY_ORDER[d.severity] >= SEVERITY_ORDER[failOnSeverity]
    );

    process.exit(hasFailure ? 1 : 0);
  });

program.parse();

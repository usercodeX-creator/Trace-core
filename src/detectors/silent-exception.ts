/**
 * Detector 05: Silent Exception Handling
 *
 * Detects exception handlers that silently swallow errors — `except: pass`,
 * empty `catch {}` blocks, and their variants. These are among the most
 * damaging AI-generated bugs because they hide symptoms of real problems.
 *
 * Heuristic, regex-based — may miss deeply nested cases. Follows
 * ARCHITECTURE.md Principle 5: on parse ambiguity, emits a `low` severity
 * detection rather than silently skipping.
 */

import type { Detector, DetectorContext, Detection, Severity } from "../types.js";
import { isTestOrExamplePath } from "../lib/secret-patterns.js";
import {
  extractPythonExceptBlocks,
  extractJsCatchBlocks,
  extractPromiseCatchBlocks,
  hasIntentComment,
  hasReRaise,
  classifyHandlerBody,
} from "../parsers/exception-patterns.js";

export const silentException: Detector = {
  id: "silent-exception",
  name: "Silent Exception Handling",
  description:
    "Detects exception handlers that silently swallow errors — empty catch blocks, bare except:pass, and promise .catch(() => {}).",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    // False positive filter #1: skip test files
    if (isTestOrExamplePath(ctx.filePath)) return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    if (ctx.language === "python") {
      detectPython(ctx, lines, detections);
    } else {
      detectJavaScript(ctx, lines, detections);
    }

    // Sort by line, then severity
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

function detectPython(
  ctx: DetectorContext,
  lines: string[],
  detections: Detection[]
): void {
  const blocks = extractPythonExceptBlocks(ctx.content);

  for (const block of blocks) {
    // False positive filter #2: intent comment within 3 lines before handler
    const lookbackStart = Math.max(0, block.handlerLine - 4); // 3 lines before (0-indexed)
    const lookbackLines = lines.slice(lookbackStart, block.handlerLine - 1);
    if (hasIntentComment(lookbackLines)) continue;

    // False positive filter #3: re-raise present
    if (hasReRaise(block.body, "python")) continue;

    const classification = classifyHandlerBody(block.body, "python");

    // False positive filter #4: substantive body
    if (classification === "substantive") continue;

    const severity = determinePythonSeverity(block.isBare, classification);
    const message = buildPythonMessage(block.isBare, classification);

    detections.push({
      detector: "silent-exception",
      severity,
      file: ctx.filePath,
      line: block.handlerLine,
      message,
      rawCode: block.rawSnippet,
      suggestedFix: null,
      dependencyContext: null,
      auditTrail: null,
    });
  }
}

function detectJavaScript(
  ctx: DetectorContext,
  lines: string[],
  detections: Detection[]
): void {
  // 1. try/catch blocks
  const catchBlocks = extractJsCatchBlocks(ctx.content);

  for (const block of catchBlocks) {
    // False positive filter #2: intent comment
    const lookbackStart = Math.max(0, block.handlerLine - 4);
    const lookbackLines = lines.slice(lookbackStart, block.handlerLine - 1);
    if (hasIntentComment(lookbackLines)) continue;

    // False positive filter #3: re-raise
    if (hasReRaise(block.body, "javascript")) continue;

    const classification = classifyHandlerBody(block.body, "javascript");

    // False positive filter #4: substantive body
    if (classification === "substantive") continue;

    const severity = determineJsSeverity(classification);
    const message = buildJsMessage(classification);

    detections.push({
      detector: "silent-exception",
      severity,
      file: ctx.filePath,
      line: block.handlerLine,
      message,
      rawCode: block.rawSnippet,
      suggestedFix: null,
      dependencyContext: null,
      auditTrail: null,
    });
  }

  // 2. Promise .catch() swallowing
  const promiseCatches = extractPromiseCatchBlocks(ctx.content);

  for (const pc of promiseCatches) {
    // Intent comment check
    const lookbackStart = Math.max(0, pc.line - 4);
    const lookbackLines = lines.slice(lookbackStart, pc.line - 1);
    if (hasIntentComment(lookbackLines)) continue;

    detections.push({
      detector: "silent-exception",
      severity: "high",
      file: ctx.filePath,
      line: pc.line,
      message: "Promise .catch() discards all errors",
      rawCode: pc.rawSnippet,
      suggestedFix: null,
      dependencyContext: null,
      auditTrail: null,
    });
  }
}

// ─── Severity mapping ───────────────────────────────────────────────

function determinePythonSeverity(
  isBare: boolean,
  classification: "empty" | "comment-only" | "log-only" | "substantive"
): Severity {
  if (isBare && classification === "empty") return "critical";
  if (classification === "empty") return "high";
  if (classification === "comment-only") return "high";
  if (classification === "log-only") return "medium";
  return "low";
}

function determineJsSeverity(
  classification: "empty" | "comment-only" | "log-only" | "substantive"
): Severity {
  if (classification === "empty") return "critical";
  if (classification === "comment-only") return "high";
  if (classification === "log-only") return "medium";
  return "low";
}

// ─── Message builders ───────────────────────────────────────────────

function buildPythonMessage(
  isBare: boolean,
  classification: "empty" | "comment-only" | "log-only" | "substantive"
): string {
  if (isBare && classification === "empty") {
    return "Empty except handler silently swallows all exceptions";
  }
  if (classification === "empty") {
    return "except handler with no recovery (pass/... only)";
  }
  if (classification === "comment-only") {
    return "except handler body contains only comments";
  }
  if (classification === "log-only") {
    return "except handler only logs without re-raising or recovery";
  }
  return "Unparseable exception handler";
}

function buildJsMessage(
  classification: "empty" | "comment-only" | "log-only" | "substantive"
): string {
  if (classification === "empty") {
    return "Empty catch block silently swallows all errors";
  }
  if (classification === "comment-only") {
    return "catch block body contains only comments";
  }
  if (classification === "log-only") {
    return "catch block only logs without re-throwing or recovery";
  }
  return "Unparseable catch handler";
}

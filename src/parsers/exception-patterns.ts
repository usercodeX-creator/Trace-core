/**
 * Shared helpers for try/catch and try/except scanning.
 *
 * Heuristic, regex-based — no AST. Follows ARCHITECTURE.md Principle 1
 * (lightweight parsers) and Principle 5 (fail loudly on ambiguity).
 */

import type { Severity } from "../types.js";

export interface ExceptionBlock {
  /** Line number (1-based) of the except/catch keyword */
  handlerLine: number;
  /** The handler body text (everything inside the catch/except) */
  body: string;
  /** The raw source snippet (try + handler, truncated) */
  rawSnippet: string;
  /** Whether this is a bare except (no exception type) */
  isBare: boolean;
  /** Language of the block */
  language: "python" | "javascript";
}

// ─── Intent comment markers (case-insensitive) ─────────────────────
const INTENT_MARKERS = /\b(intentional(?:ly)?|deliberate(?:ly)?|expected|best[\s-]effort|fire[\s-]and[\s-]forget|noqa|suppress)\b/i;

/**
 * Returns true if any of the `lookbackLines` contain an explicit intent marker.
 */
export function hasIntentComment(lookbackLines: string[]): boolean {
  return lookbackLines.some((line) => INTENT_MARKERS.test(line));
}

/**
 * Returns true if the handler body contains a re-raise (Python `raise` / JS `throw`).
 */
export function hasReRaise(body: string, language: "python" | "javascript"): boolean {
  if (language === "python") {
    return /\braise\b/.test(body);
  }
  return /\bthrow\b/.test(body);
}

/**
 * Returns true if the handler has a substantive body (more than 2 non-logging statements).
 * A "substantive" body contains real recovery logic — not just logging or comments.
 */
export function hasSubstantiveBody(body: string, language: "python" | "javascript"): boolean {
  const lines = body.split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !isComment(l, language))
    .filter((l) => !isLogging(l, language))
    .filter((l) => l !== "..." && l !== "pass");

  return lines.length > 2;
}

function isComment(line: string, language: "python" | "javascript"): boolean {
  if (language === "python") return line.startsWith("#");
  return line.startsWith("//") || line.startsWith("/*") || line.startsWith("*");
}

function isLogging(line: string, language: "python" | "javascript"): boolean {
  if (language === "python") {
    return /^\s*(print|logging\.\w+|logger\.\w+)\s*\(/.test(line);
  }
  return /^\s*console\.\w+\s*\(/.test(line);
}

// ─── Python try/except extraction ───────────────────────────────────

/**
 * Extract Python try/except blocks from source.
 * Uses indentation-based body extraction.
 */
export function extractPythonExceptBlocks(source: string): ExceptionBlock[] {
  const lines = source.split("\n");
  const blocks: ExceptionBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trimStart();

    // Match except clause: `except:`, `except Exception:`, `except SomeError as e:`
    if (!/^except\b/.test(trimmed)) continue;

    const exceptLine = i + 1; // 1-based
    const isBare = /^except\s*:/.test(trimmed);

    // Determine the indentation of this except line
    const exceptIndent = line.length - line.trimStart().length;

    // Extract handler body: lines below with greater indentation
    const bodyLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const bodyLine = lines[j]!;
      if (bodyLine.trim().length === 0) {
        bodyLines.push("");
        continue;
      }
      const bodyIndent = bodyLine.length - bodyLine.trimStart().length;
      if (bodyIndent <= exceptIndent) break;
      bodyLines.push(bodyLine);
    }

    const body = bodyLines.map((l) => l.trim()).join("\n").trim();

    // Find the try line (walk backwards to find `try:`)
    let tryLine = "";
    for (let k = i - 1; k >= 0; k--) {
      if (lines[k]!.trimStart().startsWith("try")) {
        tryLine = lines[k]!.trim();
        break;
      }
    }

    const rawSnippet = buildSnippet(tryLine, trimmed, bodyLines);

    blocks.push({
      handlerLine: exceptLine,
      body,
      rawSnippet,
      isBare,
      language: "python",
    });
  }

  return blocks;
}

// ─── JavaScript try/catch extraction ────────────────────────────────

/**
 * Extract JS/TS try/catch blocks from source.
 * Uses brace-counting for body extraction.
 */
export function extractJsCatchBlocks(source: string): ExceptionBlock[] {
  const lines = source.split("\n");
  const blocks: ExceptionBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Match catch clause: `} catch (e) {`, `} catch {`, `catch (e) {`, etc.
    const catchMatch = /\bcatch\s*(\([^)]*\))?\s*\{/.exec(line);
    if (!catchMatch) continue;

    const catchLine = i + 1; // 1-based

    // Brace-count to find the body
    // Start counting from the opening brace of catch
    const catchBraceStart = line.indexOf("{", catchMatch.index + 5); // after "catch"
    let braceDepth = 0;
    const bodyLines: string[] = [];
    let foundClose = false;

    // Count braces from the catch line onward
    for (let j = i; j < lines.length && !foundClose; j++) {
      const currentLine = lines[j]!;
      const startCol = j === i ? catchBraceStart : 0;

      for (let c = startCol; c < currentLine.length; c++) {
        const ch = currentLine[c];
        if (ch === "{") {
          braceDepth++;
        } else if (ch === "}") {
          braceDepth--;
          if (braceDepth === 0) {
            // This is the closing brace of our catch block
            // Capture body from line after catch opening to this line (exclusive)
            if (j === i) {
              // Single-line catch: `catch (e) { ... }`
              const innerStart = catchBraceStart + 1;
              const inner = currentLine.slice(innerStart, c).trim();
              if (inner.length > 0) bodyLines.push(inner);
            }
            foundClose = true;
            break;
          }
        }
      }

      // Capture lines between opening and closing brace
      if (!foundClose && j > i) {
        bodyLines.push(currentLine);
      }
    }

    const body = bodyLines.map((l) => l.trim()).join("\n").trim();

    // Find the try line (walk backwards)
    let tryLine = "";
    for (let k = i - 1; k >= 0; k--) {
      if (/\btry\s*\{/.test(lines[k]!)) {
        tryLine = lines[k]!.trim();
        break;
      }
      // try on same line as catch? (unlikely but possible)
      if (/\btry\b/.test(lines[k]!)) {
        tryLine = lines[k]!.trim();
        break;
      }
    }

    const rawSnippet = buildSnippet(tryLine, line.trim(), bodyLines);

    blocks.push({
      handlerLine: catchLine,
      body,
      rawSnippet,
      isBare: false, // JS catch is always "catch", no bare equivalent
      language: "javascript",
    });
  }

  return blocks;
}

// ─── Promise .catch() extraction ────────────────────────────────────

export interface PromiseCatchBlock {
  line: number;
  rawSnippet: string;
  callbackBody: string;
}

/**
 * Extract `.catch(() => {})` and `.catch(() => null)` patterns.
 */
export function extractPromiseCatchBlocks(source: string): PromiseCatchBlock[] {
  const lines = source.split("\n");
  const results: PromiseCatchBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Skip comment-only lines
    if (/^\s*\/\//.test(line) || /^\s*#/.test(line)) continue;

    // Match .catch(() => { ... }) or .catch(() => null) or .catch(() => undefined)
    const catchMatch = /\.catch\s*\(\s*\(.*?\)\s*=>\s*({[^}]*}|null|undefined)\s*\)/.exec(line);
    if (!catchMatch) continue;

    const callbackBody = catchMatch[1]!.trim();
    // Normalize empty braces
    const normalized = callbackBody.replace(/\s+/g, "");
    const isEmpty = normalized === "{}" || callbackBody === "null" || callbackBody === "undefined";

    if (isEmpty) {
      results.push({
        line: i + 1,
        rawSnippet: line.trim(),
        callbackBody,
      });
    }
  }

  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────

function buildSnippet(tryLine: string, handlerLine: string, bodyLines: string[]): string {
  const parts: string[] = [];
  if (tryLine) parts.push(tryLine);
  parts.push(handlerLine);
  for (const bl of bodyLines.slice(0, 3)) {
    if (bl.trim().length > 0) parts.push("    " + bl.trim());
  }
  const raw = parts.join("\n");
  return raw.length > 120 ? raw.slice(0, 117) + "..." : raw;
}

/**
 * Classify the "emptiness" of a handler body.
 */
export function classifyHandlerBody(
  body: string,
  language: "python" | "javascript"
): "empty" | "comment-only" | "log-only" | "substantive" {
  if (body.length === 0) return "empty";

  const lines = body.split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return "empty";

  // Python: `pass` or `...` alone counts as empty
  if (language === "python") {
    const nonPassLines = lines.filter((l) => l !== "pass" && l !== "...");
    if (nonPassLines.length === 0) return "empty";
  }

  // All remaining lines are comments?
  const nonCommentLines = lines.filter((l) => !isComment(l, language));
  if (nonCommentLines.length === 0) return "comment-only";

  // Filter out pass/ellipsis for Python before checking log-only
  const meaningfulLines = language === "python"
    ? nonCommentLines.filter((l) => l !== "pass" && l !== "...")
    : nonCommentLines;

  if (meaningfulLines.length === 0) return "empty";

  // All meaningful lines are just logging?
  const nonLogLines = meaningfulLines.filter((l) => !isLogging(l, language));
  if (nonLogLines.length === 0) return "log-only";

  // Has real recovery logic
  if (hasSubstantiveBody(body, language)) return "substantive";

  // Some code but not enough for substantive — still counts as log-only
  // if all non-comment lines are logging, otherwise it's light recovery
  return "substantive";
}

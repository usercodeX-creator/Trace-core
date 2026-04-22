import type { Detector, DetectorContext, Detection, Severity } from "../types.js";
import { shannonEntropy } from "../lib/entropy.js";
import {
  SECRET_PATTERNS,
  CREDENTIAL_VAR_PATTERN,
  isPlaceholder,
  isTestOrExamplePath,
  isSchemaContext,
} from "../lib/secret-patterns.js";

/**
 * Redact a secret value: show first 4 + "..." + last 4.
 * For short secrets (< 10 chars), return "****".
 */
export function redact(secret: string): string {
  if (secret.length < 10) return "****";
  return secret.slice(0, 4) + "..." + secret.slice(-4);
}

/**
 * Redact a secret within a full source line.
 * Replaces the secret with its redacted form.
 */
function redactInLine(line: string, secret: string): string {
  return line.replace(secret, redact(secret));
}

/** Extract all string literals from a line (double-quoted, single-quoted, backtick). */
function extractStringLiterals(line: string): string[] {
  const literals: string[] = [];
  const regex = /(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    if (value.length > 0) literals.push(value);
  }
  return literals;
}

export const credentialLeak: Detector = {
  id: "credential-leak",
  name: "Credential Leak",
  description: "Detects hardcoded API keys, tokens, and other credentials.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    // 1. Skip file by path filter (False Positive Filter #1)
    if (isTestOrExamplePath(ctx.filePath)) return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];
    const matchedRanges: Array<{ line: number; start: number; end: number }> = [];

    // 2. Run each vendor pattern against each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      for (const pattern of SECRET_PATTERNS) {
        const match = pattern.regex.exec(line);
        if (!match) continue;

        const matchedText = match[0];
        const column = match.index + 1;

        // Apply schema context filter
        if (isSchemaContext(line)) continue;

        // Track this range to avoid duplicate entropy hits
        matchedRanges.push({
          line: lineNum,
          start: match.index,
          end: match.index + matchedText.length,
        });

        detections.push({
          detector: "credential-leak",
          severity: pattern.severity,
          file: ctx.filePath,
          line: lineNum,
          column,
          message: `Hardcoded ${pattern.label}`,
          rawCode: redactInLine(line, matchedText),
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    // 3. Run entropy scan on string literals
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      // Skip schema lines
      if (isSchemaContext(line)) continue;

      const literals = extractStringLiterals(line);
      for (const literal of literals) {
        // Only scan strings >= 20 chars
        if (literal.length < 20) continue;

        // Skip placeholders
        if (isPlaceholder(literal)) continue;

        // Skip if already matched by a vendor pattern on this line
        const literalIndex = line.indexOf(literal);
        const alreadyMatched = matchedRanges.some(
          (r) =>
            r.line === lineNum &&
            literalIndex >= r.start &&
            literalIndex < r.end
        );
        if (alreadyMatched) continue;

        // Compute entropy
        const entropy = shannonEntropy(literal);
        if (entropy < 4.5) continue;

        // Determine severity based on context
        let severity: Severity = "medium";
        const hasCredentialVar = CREDENTIAL_VAR_PATTERN.test(line);

        // Check surrounding lines for credential-related comments
        const prevLine = i > 0 ? lines[i - 1]! : "";
        const nextLine = i < lines.length - 1 ? lines[i + 1]! : "";
        const hasCredentialComment =
          CREDENTIAL_VAR_PATTERN.test(prevLine) ||
          CREDENTIAL_VAR_PATTERN.test(nextLine);

        if (hasCredentialVar || hasCredentialComment) {
          severity = "high";
        }

        const varContext = hasCredentialVar
          ? ` assigned to credential variable`
          : "";

        detections.push({
          detector: "credential-leak",
          severity,
          file: ctx.filePath,
          line: lineNum,
          column: literalIndex + 1,
          message: `High-entropy string${varContext}`,
          rawCode: redactInLine(line, literal),
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    // 4. Credential-in-log-call sub-rule
    const LOG_CALL_RE = /\b(console\.(?:log|info|warn|error|debug)|print|logger\.(?:info|debug|warn|error))\s*\(/;
    const CRED_VAR_IN_ARGS_RE = /\b\w*(secret|password|passwd|token|api[_-]?key|apikey|auth[_-]?token|jwt|session[_-]?id|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key)\w*\b/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      // Skip if already detected on this line
      if (detections.some((d) => d.line === lineNum)) continue;

      if (!LOG_CALL_RE.test(line)) continue;

      // Strip string literals to isolate variable references
      // Handle f-strings: preserve {expr} interpolation by extracting them first
      const fstringExprs: string[] = [];
      line.replace(/\{([^}]+)\}/g, (_m, expr) => { fstringExprs.push(expr); return ""; });

      // Strip all string literals from the line
      const stripped = line.replace(/["'`][^"'`]*["'`]/g, '""');

      // Combine: check stripped line + f-string expressions for credential variable names
      const combined = stripped + " " + fstringExprs.join(" ");

      // The credential keyword must appear as part of an identifier outside strings
      if (CRED_VAR_IN_ARGS_RE.test(combined)) {
        // Verify it's not just the keyword inside a remaining string literal
        const credMatch = combined.match(CRED_VAR_IN_ARGS_RE);
        if (credMatch) {
          const token = credMatch[0];
          // Ensure token is not inside a string in the stripped version
          // (it should be a bare identifier, not e.g. in a remaining "" pair)
          if (!/["'`]/.test(token)) {
            detections.push({
              detector: "credential-leak",
              severity: "medium",
              file: ctx.filePath,
              line: lineNum,
              column: LOG_CALL_RE.exec(line)!.index + 1,
              message: "Credential variable referenced in log/print call",
              rawCode: line.trim().length > 100 ? line.trim().slice(0, 100) + "..." : line.trim(),
              suggestedFix: null,
              dependencyContext: null,
              auditTrail: null,
            });
          }
        }
      }
    }

    // 5. Sort by line number, then severity
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

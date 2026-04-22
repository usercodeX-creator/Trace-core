import type { Detector, DetectorContext, Detection } from "../../types.js";

/**
 * Secret patterns to detect in Go string literals.
 * Derived from the project's existing secret-patterns.ts library.
 */
const SECRET_PATTERNS: Array<{ id: string; label: string; regex: RegExp }> = [
  { id: "stripe-live",     label: "Stripe live secret key",               regex: /sk_live_[0-9a-zA-Z]{24,}/ },
  { id: "stripe-test",     label: "Stripe test secret key",               regex: /sk_test_[0-9a-zA-Z]{24,}/ },
  { id: "openai-key",      label: "OpenAI API key",                       regex: /sk-[0-9a-zA-Z]{48}/ },
  { id: "openai-proj",     label: "OpenAI project-scoped API key",        regex: /sk-proj-[0-9a-zA-Z_-]{40,}/ },
  { id: "aws-access-key",  label: "AWS Access Key ID",                    regex: /AKIA[0-9A-Z]{16}/ },
  { id: "github-pat",      label: "GitHub Personal Access Token",         regex: /ghp_[0-9a-zA-Z]{36}/ },
  { id: "slack-bot",       label: "Slack Bot Token",                      regex: /xoxb-[0-9]{10,}-[0-9]{10,}-[0-9a-zA-Z]{24}/ },
  { id: "slack-user",      label: "Slack User Token",                     regex: /xoxp-[0-9]{10,}-[0-9]{10,}-[0-9]{10,}-[0-9a-f]{32}/ },
  { id: "anthropic-key",   label: "Anthropic API key",                    regex: /sk-ant-[0-9a-zA-Z_-]{95,}/ },
  { id: "google-api",      label: "Google API key",                       regex: /AIza[0-9A-Za-z_-]{35}/ },
  { id: "pem-private-key", label: "PEM private key",                      regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: "generic-hex-32",  label: "Generic long hex secret (32+ chars)",  regex: /[0-9a-f]{32,}/i },
];

/** File path patterns indicating test/example context — skip these. */
const SKIP_PATH_PATTERNS = [
  /\btest[s]?\b/i,
  /\bexample[s]?\b/i,
  /\bspec\b/i,
  /\b__tests__\b/,
  /\.test\./,
  /\.spec\./,
  /\bmock\b/i,
  /\bfixture[s]?\b/i,
  /\bsample[s]?\b/i,
  /\bdemo\b/i,
];

function isTestOrExamplePath(filePath: string): boolean {
  return SKIP_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

/** Extract string literals from a Go source line (double-quoted and backtick). */
function extractGoStringLiterals(line: string): string[] {
  const literals: string[] = [];
  const regex = /(?:"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`]*)`)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const value = match[1] ?? match[2] ?? "";
    if (value.length > 0) literals.push(value);
  }
  return literals;
}

/**
 * Redact a secret value: show first 4 + "..." + last 4.
 */
function redact(secret: string): string {
  if (secret.length < 10) return "****";
  return secret.slice(0, 4) + "..." + secret.slice(-4);
}

function redactInLine(line: string, secret: string): string {
  return line.replace(secret, redact(secret));
}

export const goHardcodedSecret: Detector = {
  id: "go/hardcoded-secret" as any,
  name: "Go Hardcoded Secret",
  description: "Detects hardcoded API keys, tokens, and credentials in Go source files.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if ((ctx.language as string) !== "go") return [];

    // Skip test/example files
    if (isTestOrExamplePath(ctx.filePath)) return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      // Only scan inside string literals to reduce false positives
      const literals = extractGoStringLiterals(line);

      for (const literal of literals) {
        for (const pattern of SECRET_PATTERNS) {
          const match = pattern.regex.exec(literal);
          if (match) {
            const matchedText = match[0];
            detections.push({
              detector: "go/hardcoded-secret" as any,
              severity: "critical",
              file: ctx.filePath,
              line: lineNum,
              message: `Hardcoded ${pattern.label} in Go source`,
              rawCode: redactInLine(line.trimEnd(), matchedText),
              suggestedFix: "Use environment variables or a secrets manager instead of hardcoding credentials",
              dependencyContext: null,
              auditTrail: null,
            });
            // One detection per pattern per line is enough — avoid duplicate noise
            break;
          }
        }
      }
    }

    return detections;
  },
};

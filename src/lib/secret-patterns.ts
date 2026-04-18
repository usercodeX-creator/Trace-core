/**
 * Vendor-specific secret patterns for credential-leak detection.
 *
 * Each entry defines a named rule with a regex, severity, and human-readable label.
 * Patterns are ordered by vendor for readability.
 */

import type { Severity } from "../types.js";

export interface SecretPattern {
  id: string;
  label: string;
  regex: RegExp;
  severity: Severity;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  // --- AWS ---
  {
    id: "aws-access-key-id",
    label: "AWS Access Key ID",
    regex: /AKIA[0-9A-Z]{16}/,
    severity: "critical",
  },
  {
    id: "aws-secret-access-key",
    label: "AWS Secret Access Key",
    regex: /(?:aws_secret|AWS_SECRET|secret_access_key).{0,100}?([A-Za-z0-9/+=]{40})/i,
    severity: "critical",
  },

  // --- Stripe ---
  {
    id: "stripe-live-secret",
    label: "Stripe live secret key",
    regex: /sk_live_[0-9a-zA-Z]{24,}/,
    severity: "critical",
  },
  {
    id: "stripe-test-secret",
    label: "Stripe test secret key",
    regex: /sk_test_[0-9a-zA-Z]{24,}/,
    severity: "critical",
  },
  {
    id: "stripe-live-publishable",
    label: "Stripe live publishable key",
    regex: /pk_live_[0-9a-zA-Z]{24,}/,
    severity: "critical",
  },
  {
    id: "stripe-restricted-live",
    label: "Stripe restricted key (live)",
    regex: /rk_live_[0-9a-zA-Z]{24,}/,
    severity: "critical",
  },
  {
    id: "stripe-restricted-test",
    label: "Stripe restricted key (test)",
    regex: /rk_test_[0-9a-zA-Z]{24,}/,
    severity: "critical",
  },

  // --- GitHub ---
  {
    id: "github-pat-classic",
    label: "GitHub Personal Access Token (classic)",
    regex: /ghp_[0-9a-zA-Z]{36}/,
    severity: "critical",
  },
  {
    id: "github-pat-fine-grained",
    label: "GitHub Fine-grained PAT",
    regex: /github_pat_[0-9a-zA-Z_]{82}/,
    severity: "critical",
  },
  {
    id: "github-oauth",
    label: "GitHub OAuth Access Token",
    regex: /gho_[0-9a-zA-Z]{36}/,
    severity: "critical",
  },
  {
    id: "github-user-to-server",
    label: "GitHub User-to-server Token",
    regex: /ghu_[0-9a-zA-Z]{36}/,
    severity: "critical",
  },
  {
    id: "github-server-to-server",
    label: "GitHub Server-to-server Token",
    regex: /ghs_[0-9a-zA-Z]{36}/,
    severity: "critical",
  },
  {
    id: "github-refresh",
    label: "GitHub Refresh Token",
    regex: /ghr_[0-9a-zA-Z]{36}/,
    severity: "critical",
  },

  // --- OpenAI ---
  {
    id: "openai-api-key",
    label: "OpenAI API key",
    regex: /sk-[0-9a-zA-Z]{48}/,
    severity: "critical",
  },
  {
    id: "openai-project-key",
    label: "OpenAI project-scoped API key",
    regex: /sk-proj-[0-9a-zA-Z_-]{40,}/,
    severity: "critical",
  },
  {
    id: "openai-org-id",
    label: "OpenAI Organization ID",
    regex: /org-[0-9a-zA-Z]{24}/,
    severity: "low",
  },

  // --- Anthropic ---
  {
    id: "anthropic-api-key",
    label: "Anthropic API key",
    regex: /sk-ant-[0-9a-zA-Z_-]{95,}/,
    severity: "critical",
  },

  // --- Google ---
  {
    id: "google-api-key",
    label: "Google API key",
    regex: /AIza[0-9A-Za-z_-]{35}/,
    severity: "critical",
  },
  {
    id: "google-oauth-refresh",
    label: "Google OAuth Refresh Token",
    regex: /1\/\/[0-9A-Za-z_-]{43,64}/,
    severity: "critical",
  },

  // --- Slack ---
  {
    id: "slack-bot-token",
    label: "Slack Bot Token",
    regex: /xoxb-[0-9]{10,}-[0-9]{10,}-[0-9a-zA-Z]{24}/,
    severity: "critical",
  },
  {
    id: "slack-user-token",
    label: "Slack User Token",
    regex: /xoxp-[0-9]{10,}-[0-9]{10,}-[0-9]{10,}-[0-9a-f]{32}/,
    severity: "critical",
  },
  {
    id: "slack-webhook",
    label: "Slack Webhook URL",
    regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{10}\/B[0-9A-Z]{10}\/[0-9a-zA-Z]{24}/,
    severity: "critical",
  },

  // --- JWT ---
  {
    id: "jwt",
    label: "JSON Web Token",
    regex: /eyJ[0-9a-zA-Z_=-]+\.eyJ[0-9a-zA-Z_=-]+\.[0-9a-zA-Z_=-]+/,
    severity: "medium",
  },

  // --- Private Keys ---
  {
    id: "pem-private-key",
    label: "PEM private key",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    severity: "critical",
  },

  // --- Connection Strings ---
  {
    id: "postgres-connection-string",
    label: "PostgreSQL connection string with password",
    regex: /(postgres|postgresql):\/\/[^:]+:[^@\s]+@[^\s"']+/,
    severity: "critical",
  },
  {
    id: "mysql-connection-string",
    label: "MySQL connection string with password",
    regex: /mysql:\/\/[^:]+:[^@\s]+@[^\s"']+/,
    severity: "critical",
  },
  {
    id: "mongodb-connection-string",
    label: "MongoDB connection string with password",
    regex: /mongodb(\+srv)?:\/\/[^:]+:[^@\s]+@[^\s"']+/,
    severity: "critical",
  },
  {
    id: "redis-connection-string",
    label: "Redis connection string with password",
    regex: /redis:\/\/[^:]*:[^@\s]+@[^\s"']+/,
    severity: "critical",
  },
];

/** Variable name patterns that suggest a credential context. */
export const CREDENTIAL_VAR_PATTERN =
  /\b(key|secret|token|password|passwd|pwd|auth|credential|api_?key|access_?key)\b/i;

/** Known placeholder values that should not trigger detections. */
const PLACEHOLDER_LITERALS = [
  "YOUR_API_KEY",
  "YOUR_SECRET",
  "REPLACE_ME",
  "INSERT_HERE",
  "TODO",
  "FIXME",
  "XXX",
];

const PLACEHOLDER_SUBSTRINGS = [
  "example",
  "sample",
  "dummy",
  "fake",
  "test",
];

/**
 * Returns true if the string is a known placeholder or obvious dummy value.
 */
export function isPlaceholder(value: string): boolean {
  const upper = value.toUpperCase();

  // Exact placeholder matches
  for (const p of PLACEHOLDER_LITERALS) {
    if (upper.includes(p)) return true;
  }

  // Substring matches (case-insensitive)
  const lower = value.toLowerCase();
  for (const sub of PLACEHOLDER_SUBSTRINGS) {
    if (lower.includes(sub)) return true;
  }

  // All-same-character strings ("aaaaaaa...")
  if (value.length >= 2 && new Set(value).size === 1) return true;

  // Sequential digits ("1234567890...")
  if (/^[0-9]+$/.test(value) && isSequential(value)) return true;

  // Sequential letters ("abcdefg...")
  if (/^[a-zA-Z]+$/.test(value) && isSequential(value.toLowerCase())) return true;

  return false;
}

function isSequential(s: string): boolean {
  for (let i = 1; i < s.length; i++) {
    const diff = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (diff !== 1 && diff !== 0) return false;
  }
  return true;
}

/** File path patterns indicating test/example context. */
const SKIP_PATH_PATTERNS = [
  /\btest[s]?\b/i,
  /\bspec\b/i,
  /\b__tests__\b/,
  /\.test\./,
  /\.spec\./,
  /\bmock\b/i,
  /\bfixture[s]?\b/i,
  /\bsample[s]?\b/i,
  /\bdemo\b/i,
];

/**
 * Returns true if the file path suggests test/example context.
 */
export function isTestOrExamplePath(filePath: string): boolean {
  return SKIP_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Returns true if the line is within a schema definition (Zod, Joi, Yup)
 * or a YAML type/example annotation.
 */
export function isSchemaContext(line: string): boolean {
  // Zod/Joi/Yup schema patterns
  if (/\b(z|zod|joi|yup)\b.*\.(string|number|object|array)\s*\(/i.test(line)) return true;

  // YAML-like "type:" or "example:" prefix
  if (/^\s*(type|example)\s*:/i.test(line)) return true;

  return false;
}

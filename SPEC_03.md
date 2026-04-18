# SPEC_03 — Detector 03: Credential Leak Detection

> **For Claude Code**: Read this file completely before starting. Follow `ARCHITECTURE.md` principles. This is an addition to `src/detectors/`, not a rewrite.

---

## Purpose

Detect hardcoded credentials in source code — API keys, tokens, passwords, and connection strings that AI assistants eagerly write in plain text.

This is Pattern #03 of the 7-pattern system. Pattern #01 (hallucinated dependencies) already ships. This is the second OSS pattern.

---

## Why This Matters

**Moltbook incident, February 2026**: Wiz discovered 1.5M API keys exposed because the founder deployed AI-generated code without reviewing what credentials were hardcoded. This is the single most damaging class of AI-generated defect.

AI coding assistants are especially prone to this failure mode:
- When prompted to "connect to the database", they often inline the credentials instead of using environment variables
- Example prompts that produce leaks: "build a Stripe payment flow", "add OpenAI to this app", "set up AWS S3 upload"

---

## Detection Strategy

Hybrid approach:

1. **Vendor-specific patterns** — high-confidence regex matches for known token formats
2. **Generic high-entropy strings** — lower-confidence detection of suspicious literals
3. **Context-aware filtering** — skip test files, example files, and obvious placeholders

---

## Vendor Patterns (High Confidence — `critical` severity)

Each pattern below is a distinct named rule. Implement them as named entries in a lookup table.

### AWS

- **Access Key ID**: `AKIA[0-9A-Z]{16}`
- **Secret Access Key** (heuristic): 40-character base64-like string within 100 chars of `aws_secret` / `AWS_SECRET` / `secret_access_key` (case-insensitive)

### Stripe

- **Live Secret**: `sk_live_[0-9a-zA-Z]{24,}`
- **Test Secret**: `sk_test_[0-9a-zA-Z]{24,}`
- **Live Publishable**: `pk_live_[0-9a-zA-Z]{24,}`
- **Restricted**: `rk_live_[0-9a-zA-Z]{24,}` / `rk_test_...`

### GitHub

- **Personal Access Token (classic)**: `ghp_[0-9a-zA-Z]{36}`
- **Fine-grained PAT**: `github_pat_[0-9a-zA-Z_]{82}`
- **OAuth Access Token**: `gho_[0-9a-zA-Z]{36}`
- **User-to-server token**: `ghu_[0-9a-zA-Z]{36}`
- **Server-to-server token**: `ghs_[0-9a-zA-Z]{36}`
- **Refresh token**: `ghr_[0-9a-zA-Z]{36}`

### OpenAI

- **API Key (classic)**: `sk-[0-9a-zA-Z]{48}`
- **API Key (project-scoped, 2024+)**: `sk-proj-[0-9a-zA-Z_-]{40,}`
- **Organization ID** (informational only, `low` severity): `org-[0-9a-zA-Z]{24}`

### Anthropic

- **API Key**: `sk-ant-[0-9a-zA-Z_-]{95,}`

### Google

- **API Key**: `AIza[0-9A-Za-z_-]{35}`
- **OAuth Refresh Token**: `1//[0-9A-Za-z_-]{43}` or `1//[0-9A-Za-z_-]{64}`

### Slack

- **Bot Token**: `xoxb-[0-9]{10,}-[0-9]{10,}-[0-9a-zA-Z]{24}`
- **User Token**: `xoxp-[0-9]{10,}-[0-9]{10,}-[0-9]{10,}-[0-9a-f]{32}`
- **Webhook URL**: `https://hooks.slack.com/services/T[0-9A-Z]{10}/B[0-9A-Z]{10}/[0-9a-zA-Z]{24}`

### JWT

- **JSON Web Token**: `eyJ[0-9a-zA-Z_=-]+\.eyJ[0-9a-zA-Z_=-]+\.[0-9a-zA-Z_=-]+` (informational, `medium` — JWTs aren't always secret but frequently leak session data)

### Private Keys (any)

- **PEM private key header**: `-----BEGIN [A-Z ]*PRIVATE KEY-----` — always `critical`

### Connection Strings

- **Postgres / MySQL with password**: `(postgres|mysql|postgresql)://[^:]+:[^@\s]+@[^\s"']+` — `critical`
- **MongoDB with password**: `mongodb(\+srv)?://[^:]+:[^@\s]+@[^\s"']+` — `critical`
- **Redis with password**: `redis://[^:]*:[^@\s]+@[^\s"']+` — `critical`

---

## Generic High-Entropy Detection (`medium` severity)

For strings that don't match a known vendor pattern but look suspicious:

1. Scan all string literals in the file (between `"..."`, `'...'`, or `` `...` ``)
2. For each literal of length >= 20 characters:
   - Compute Shannon entropy
   - If entropy >= 4.5 bits/char, flag as suspicious
3. Additional signals that raise severity:
   - Assignment to a variable whose name contains: `key`, `secret`, `token`, `password`, `passwd`, `pwd`, `auth`, `credential`, `api_?key`, `access_?key`
   - Comment nearby contains the same suspicious words

When a high-entropy string is found in an assignment like `api_key = "abc123..."`, the severity is `high`. Bare high-entropy strings without context are `medium`.

---

## False Positive Filters

Skip a detection when:

1. **File path** contains `test`, `tests`, `spec`, `__tests__`, `.test.`, `.spec.`, `mock`, `fixture`, `example`, `examples`, `sample`, `demo`
2. **The matched string** is a known placeholder:
   - `YOUR_API_KEY`, `YOUR_SECRET`, `REPLACE_ME`, `INSERT_HERE`, `TODO`, `FIXME`, `XXX`
   - All-same-character (`"aaaaaaaa..."`)
   - Obvious dummy: `"1234567890..."`, `"abcdefg..."`
   - Contains `example`, `sample`, `dummy`, `fake`, `test` as a substring (case-insensitive)
3. **The context** shows it's a schema, not a real value:
   - String appears inside a Zod/Joi/Yup schema definition
   - String is preceded by `type:` or `example:` in YAML-like contexts

When in doubt, prefer emitting a `low` severity detection over silent skip. Fail loud (Principle 5).

---

## Architecture Integration

### File layout

Add these files to the existing structure:

```
src/
├── detectors/
│   ├── index.ts                   ← ADD: register credential-leak here
│   ├── hallucinated-deps.ts       (existing)
│   └── credential-leak.ts         ← NEW
└── lib/
    ├── anonymizer.ts              (existing stub)
    ├── cache.ts                   (existing)
    ├── entropy.ts                 ← NEW: Shannon entropy helper
    └── secret-patterns.ts         ← NEW: the vendor pattern table
```

### Types

No changes to `src/types.ts`. Use the existing `Detection` schema. Populate:

- `detector: "credential-leak"` (add to the `DetectorId` union in types.ts)
- `severity`: per the rules above
- `line` / `column`: exact position of the match
- `message`: human-readable like `"Hardcoded Stripe secret key"` or `"Possible AWS access key"`
- `rawCode`: the source line containing the match, with the secret **redacted** — show first 4 chars + `...` + last 4 chars. Never log a full secret.

### Interface

Export a single `Detector` object:

```typescript
export const credentialLeak: Detector = {
  id: "credential-leak",
  name: "Credential Leak",
  description: "Detects hardcoded API keys, tokens, and other credentials.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    // 1. Skip file by path filter (see False Positive Filters #1)
    // 2. Run each vendor pattern against ctx.content
    // 3. Run entropy scan
    // 4. Apply placeholder/schema filters
    // 5. Return sorted by line number
  }
};
```

---

## Redaction

**Never include the full secret in any output.**

Redaction rule: show the first 4 characters and the last 4 characters, replace the middle with `...`.

- `sk_live_abcdef123456789012345xyz` → `sk_l...5xyz`
- Short matches (< 10 chars) → `****` (fully masked)

Apply this in:
- `Detection.rawCode` (the line shown)
- `Detection.message` (if it quotes the value)
- CLI output
- JSON output

A secret **must not** appear in logs, stdout, or stderr in its full form.

---

## Tests

Add these test files under `tests/detectors/`:

### `tests/detectors/credential-leak.test.ts`

**Vendor pattern tests** — at least one per vendor:
1. AWS Access Key ID found → 1 detection, critical, redacted
2. Stripe sk_live_ found → 1 detection, critical, redacted
3. GitHub ghp_ found → 1 detection, critical, redacted
4. OpenAI sk- found → 1 detection, critical, redacted
5. Anthropic sk-ant- found → 1 detection, critical, redacted
6. Postgres connection string with password → 1 detection, critical, redacted
7. PEM private key block → 1 detection, critical

**High-entropy tests**:
8. Random 32-char base64 assigned to `api_key` → 1 detection, high severity
9. Random 32-char base64 without context → 1 detection, medium severity
10. Random 32-char string in a comment with "TODO api key" → 1 detection, high severity

**False positive tests — must produce 0 detections**:
11. File at path `tests/fixtures/secrets.ts` → 0 detections (path filter)
12. String `"YOUR_API_KEY"` assigned to `apiKey` → 0 detections (placeholder)
13. String `"example_secret_do_not_use"` → 0 detections (placeholder word)
14. Schema `z.string().min(32)` → 0 detections (not a real value)
15. URL without credentials (`"https://api.stripe.com"`) → 0 detections

**Redaction tests**:
16. Full AWS secret `AKIAIOSFODNN7EXAMPLE` in input → output contains `AKIA...MPLE` but NOT the full string
17. Short secret (< 10 chars) → output contains `****`

---

## CLI Integration

No CLI flag changes required. The detector runs automatically alongside #01.

Expected output for a file with both patterns:

```
$ npx trace-check leaky.js

trace-check v0.2.0

leaky.js
  ✗ critical  line 3    Hardcoded Stripe live secret key
               >  const stripe = "sk_l...5xyz";
  ✗ critical  line 5    Package "fake-lib-xyz" not found on npm
               >  import x from "fake-lib-xyz";
  ✗ high      line 8    High-entropy string assigned to 'api_key'
               >  api_key = "aBcD...9XyZ"

Summary: 3 issues found across 1 file.
```

Order detections by line number, then by severity (critical → high → medium → low).

---

## Acceptance Criteria

1. `npm test` — all previous tests still pass, plus at least 17 new tests for credential-leak
2. `npx trace-check examples/leaky-secrets.js` (create this example file) — produces expected detections
3. No full secret appears anywhere in any output
4. `CHANGELOG.md` updated with a v0.2.0 section
5. `package.json` version bumped to `0.2.0`
6. README updated: change Pattern #03 status from `🚧 next` to `✅ v0.2.0`

---

## Example File to Create

`examples/leaky-secrets.js`:

```javascript
// Intentional credential leak demo — DO NOT use these values
// All keys below are fake but match the format of real credentials

const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
const stripe_secret = "sk_live_51HxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
const github_token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";

// Database connection with inline password
const db_url = "postgres://admin:SuperSecret123@prod-db.example.com:5432/users";

// High-entropy value assigned to api_key
const api_key = "aBcD3fGh1JkLmN0pQrStUvWxYz9876543210";

export { AWS_KEY, stripe_secret, github_token, db_url, api_key };
```

Expected: 5 critical + 1 high = 6 detections.

---

## What You're NOT Building

- No actual secret validation (we don't call AWS/Stripe APIs to verify the key is active — that's Trace Cloud)
- No git history scanning (that's Phase 4 Supply Chain)
- No auto-remediation (that's Phase 3 Auto Fix)
- No telemetry back to the author — detection is local-only

---

## Reporting

When done, report:

1. `npm test` output (all tests passing including new ones)
2. `npx trace-check examples/leaky-secrets.js` output (6 detections, all properly redacted)
3. Diff summary: what files were added/modified
4. Any architectural decisions not explicitly in this spec

Do not push. I'll review, then push.

import { describe, it, expect } from "vitest";
import { credentialLeak, redact } from "../../src/detectors/credential-leak.js";
import type { DetectorContext } from "../../src/types.js";

function makeCtx(content: string, filePath = "app.js"): DetectorContext {
  return { filePath, content, language: "javascript" };
}

describe("Credential Leak Detector", () => {
  // ─── Vendor pattern tests ───────────────────────────────────────

  it("1. detects AWS Access Key ID — critical, redacted", async () => {
    const ctx = makeCtx(`const key = "AKIAIOSFODNN7EXAMPLE";`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("AWS Access Key ID");
    expect(d[0]!.rawCode).toContain("AKIA...MPLE");
    expect(d[0]!.rawCode).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("2. detects Stripe sk_live_ — critical, redacted", async () => {
    const secret = "sk_live_51HxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    const ctx = makeCtx(`const s = "${secret}";`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("Stripe live secret key");
    expect(d[0]!.rawCode).not.toContain(secret);
  });

  it("3. detects GitHub ghp_ — critical, redacted", async () => {
    const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
    const ctx = makeCtx(`const t = "${token}";`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("GitHub Personal Access Token");
    expect(d[0]!.rawCode).not.toContain(token);
  });

  it("4. detects OpenAI sk- — critical, redacted", async () => {
    const key = "sk-" + "a".repeat(48);
    const ctx = makeCtx(`const k = "${key}";`);
    const d = await credentialLeak.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const openaiDetection = d.find((x) => x.message.includes("OpenAI"));
    expect(openaiDetection).toBeDefined();
    expect(openaiDetection!.severity).toBe("critical");
  });

  it("5. detects Anthropic sk-ant- — critical, redacted", async () => {
    const key = "sk-ant-" + "a".repeat(95);
    const ctx = makeCtx(`const k = "${key}";`);
    const d = await credentialLeak.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const antDetection = d.find((x) => x.message.includes("Anthropic"));
    expect(antDetection).toBeDefined();
    expect(antDetection!.severity).toBe("critical");
  });

  it("6. detects Postgres connection string with password — critical, redacted", async () => {
    const connStr = "postgres://admin:SuperSecret123@prod-db.example.com:5432/users";
    const ctx = makeCtx(`const db = "${connStr}";`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("PostgreSQL connection string");
    expect(d[0]!.rawCode).not.toContain("SuperSecret123");
  });

  it("7. detects PEM private key block — critical", async () => {
    const ctx = makeCtx(`-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("PEM private key");
  });

  // ─── High-entropy tests ────────────────────────────────────────

  it("8. flags high-entropy string assigned to api_key — high severity", async () => {
    // Use a genuinely high-entropy string (mixed case, digits, symbols)
    const highEntropy = "aB3dE5gH7jK9mN1pQ3sT5vW7yZ0bC2f";
    const ctx = makeCtx(`const api_key = "${highEntropy}";`);
    const d = await credentialLeak.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const entropyDetection = d.find((x) => x.message.includes("High-entropy"));
    expect(entropyDetection).toBeDefined();
    expect(entropyDetection!.severity).toBe("high");
  });

  it("9. flags high-entropy string without context — medium severity", async () => {
    const highEntropy = "aB3dE5gH7jK9mN1pQ3sT5vW7yZ0bC2f";
    const ctx = makeCtx(`const data = "${highEntropy}";`);
    const d = await credentialLeak.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const entropyDetection = d.find((x) => x.message.includes("High-entropy"));
    expect(entropyDetection).toBeDefined();
    expect(entropyDetection!.severity).toBe("medium");
  });

  it("10. flags high-entropy string near a comment with credential keyword — high severity", async () => {
    const highEntropy = "aB3dE5gH7jK9mN1pQ3sT5vW7yZ0bC2f";
    const ctx = makeCtx(`// TODO api key for production\nconst x = "${highEntropy}";`);
    const d = await credentialLeak.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const entropyDetection = d.find((x) => x.message.includes("High-entropy"));
    expect(entropyDetection).toBeDefined();
    expect(entropyDetection!.severity).toBe("high");
  });

  // ─── False positive tests — must produce 0 detections ──────────

  it("11. skips files in test paths — 0 detections", async () => {
    const ctx = makeCtx(
      `const key = "AKIAIOSFODNN7EXAMPLE";`,
      "tests/fixtures/secrets.ts"
    );
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("12. skips placeholder YOUR_API_KEY — 0 detections", async () => {
    const ctx = makeCtx(`const apiKey = "YOUR_API_KEY";`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("13. skips string containing 'example' — 0 detections", async () => {
    const ctx = makeCtx(`const secret = "example_secret_do_not_use";`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("14. skips Zod schema definition — 0 detections", async () => {
    const ctx = makeCtx(`const schema = z.string().min(32);`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("15. skips URL without credentials — 0 detections", async () => {
    const ctx = makeCtx(`const url = "https://api.stripe.com";`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(0);
  });

  // ─── Redaction tests ───────────────────────────────────────────

  it("16. redacts AWS key — shows AKIA...MPLE, not full key", async () => {
    const ctx = makeCtx(`const key = "AKIAIOSFODNN7EXAMPLE";`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.rawCode).toContain("AKIA...MPLE");
    expect(d[0]!.rawCode).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("17. fully masks short secrets (< 10 chars) — shows ****", () => {
    expect(redact("short")).toBe("****");
    expect(redact("ab")).toBe("****");
    expect(redact("123456789")).toBe("****");
    // 10+ chars get partial redaction
    expect(redact("AKIAIOSFODNN7EXAMPLE")).toBe("AKIA...MPLE");
  });

  // ─── Additional tests ──────────────────────────────────────────

  it("18. detects multiple vendor patterns in same file", async () => {
    const ctx = makeCtx([
      `const aws = "AKIAIOSFODNN7EXAMPLE";`,
      `const gh = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";`,
    ].join("\n"));
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(2);
    expect(d[0]!.line).toBe(1);
    expect(d[1]!.line).toBe(2);
  });

  it("19. returns correct line and column numbers", async () => {
    const ctx = makeCtx(`\n\n  const k = "AKIAIOSFODNN7EXAMPLE";`);
    const d = await credentialLeak.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.line).toBe(3);
    expect(d[0]!.column).toBeGreaterThan(1);
  });

  // ─── Credential-in-log-call sub-rule ────────────────────────────

  it("20. console.log with apiKey variable → medium", async () => {
    const ctx = makeCtx(`console.log("User logged in with token:", apiKey);`);
    const d = await credentialLeak.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d.some((x) => x.message.includes("log/print call"))).toBe(true);
    expect(d.some((x) => x.severity === "medium")).toBe(true);
  });

  it("21. Python print with secret in f-string → medium", async () => {
    const ctx: DetectorContext = {
      filePath: "app.py",
      content: `print(f"Authenticating with {secret}")`,
      language: "python",
    };
    const d = await credentialLeak.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d.some((x) => x.message.includes("log/print call"))).toBe(true);
  });

  it("22. logger.info with jwtToken → medium", async () => {
    const ctx: DetectorContext = {
      filePath: "auth.ts",
      content: `logger.info("JWT:", jwtToken);`,
      language: "typescript",
    };
    const d = await credentialLeak.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d.some((x) => x.message.includes("log/print call"))).toBe(true);
  });

  it("23. console.log with string-only content → does NOT fire", async () => {
    const ctx = makeCtx(`console.log("No API key provided. Please set API_KEY env var.");`);
    const d = await credentialLeak.run(ctx);
    const logHits = d.filter((x) => x.message.includes("log/print call"));
    expect(logHits).toHaveLength(0);
  });

  it("24. Python print with string-only content → does NOT fire", async () => {
    const ctx: DetectorContext = {
      filePath: "app.py",
      content: `print("password reset successful")`,
      language: "python",
    };
    const d = await credentialLeak.run(ctx);
    const logHits = d.filter((x) => x.message.includes("log/print call"));
    expect(logHits).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import { goHardcodedSecret } from "../../../src/detectors/go/hardcoded-secret.js";
import type { DetectorContext } from "../../../src/types.js";

function goCtx(content: string, filePath = "main.go"): DetectorContext {
  return { filePath, content, language: "go" as any };
}

describe("Go Hardcoded Secret Detector", () => {
  it("1. detects Stripe test key — 1 critical", async () => {
    const ctx = goCtx(`const StripeKey = "sk_test_51HxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"`);
    const d = await goHardcodedSecret.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("Stripe");
  });

  it("2. detects AWS Access Key ID — 1 critical", async () => {
    const ctx = goCtx(`const Key = "AKIAIOSFODNN7EXAMPLE"`);
    const d = await goHardcodedSecret.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("AWS Access Key ID");
  });

  it("3. detects GitHub PAT — 1 critical", async () => {
    const ctx = goCtx(`token := "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"`);
    const d = await goHardcodedSecret.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("GitHub Personal Access Token");
  });

  it("4. allows env var lookup — 0 detections", async () => {
    const ctx = goCtx(`key := os.Getenv("STRIPE_KEY")`);
    const d = await goHardcodedSecret.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("5. skips test file paths — 0 detections", async () => {
    const ctx = goCtx(
      `const Key = "AKIAIOSFODNN7EXAMPLE"`,
      "tests/fixtures/secrets.go"
    );
    const d = await goHardcodedSecret.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("6. skips non-Go language — 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "main.py",
      content: `KEY = "AKIAIOSFODNN7EXAMPLE"`,
      language: "python" as any,
    };
    const d = await goHardcodedSecret.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("7. detects PEM private key block — 1 critical", async () => {
    const ctx = goCtx("const cert = `-----BEGIN RSA PRIVATE KEY-----`");
    const d = await goHardcodedSecret.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("PEM private key");
  });
});

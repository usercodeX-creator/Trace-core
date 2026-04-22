import { describe, it, expect } from "vitest";
import { goSlopsquatting } from "../../../src/detectors/go/slopsquatting.js";
import type { DetectorContext } from "../../../src/types.js";

function goCtx(content: string, filePath = "main.go"): DetectorContext {
  return { filePath, content, language: "go" as any };
}

describe("Go Slopsquatting Detector", () => {
  it("1. detects suspicious prefix 'super-' — 1 critical", async () => {
    const ctx = goCtx(`import "super-validator"`);
    const d = await goSlopsquatting.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain('suspicious prefix "super-"');
  });

  it("2. detects suspicious prefix 'easy-' — 1 critical", async () => {
    const ctx = goCtx(`import "easy-http"`);
    const d = await goSlopsquatting.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain('suspicious prefix "easy-"');
  });

  it("3. allows Go stdlib package 'fmt' — 0 detections", async () => {
    const ctx = goCtx(`import "fmt"`);
    const d = await goSlopsquatting.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("4. allows trusted host 'github.com/gin-gonic/gin' — 0 detections", async () => {
    const ctx = goCtx(`import "github.com/gin-gonic/gin"`);
    const d = await goSlopsquatting.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("5. detects single-word non-stdlib package — 1 critical", async () => {
    const ctx = goCtx(`import "coolpkg"`);
    const d = await goSlopsquatting.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("not in the Go standard library");
  });

  it("6. handles multi-line import block with mix of safe and suspicious", async () => {
    const ctx = goCtx([
      `import (`,
      `  "fmt"`,
      `  "github.com/gin-gonic/gin"`,
      `  "super-logger"`,
      `  "easy-cache"`,
      `  "os"`,
      `)`,
    ].join("\n"));
    const d = await goSlopsquatting.run(ctx);
    expect(d).toHaveLength(2);
    expect(d[0]!.message).toContain("super-");
    expect(d[1]!.message).toContain("easy-");
  });

  it("7. allows trusted host 'golang.org/x/crypto' — 0 detections", async () => {
    const ctx = goCtx(`import "golang.org/x/crypto"`);
    const d = await goSlopsquatting.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("8. skips non-Go language — 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "main.py",
      content: `import "super-validator"`,
      language: "python" as any,
    };
    const d = await goSlopsquatting.run(ctx);
    expect(d).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// v0.6.1 regression — local/relative/internal Go imports must NOT trigger
// ---------------------------------------------------------------------------

describe("Go Slopsquatting: local and internal imports must NOT trigger", () => {
  const safeCases: [string, string][] = [
    ['import "./localpackage"', "relative ./"],
    ['import "../sibling/pkg"', "relative ../"],
    ['import "internal/auth"', "internal/ prefix"],
    ['import "mymodule/internal/secret"', "internal/ segment"],
  ];

  for (const [code, label] of safeCases) {
    it(`does not flag: ${label}`, async () => {
      const ctx = goCtx(code);
      const d = await goSlopsquatting.run(ctx);
      expect(d).toHaveLength(0);
    });
  }

  it("multi-line block with relative + internal — 0 detections", async () => {
    const ctx = goCtx([
      `import (`,
      `  "fmt"`,
      `  "./local"`,
      `  "../parent/pkg"`,
      `  "internal/auth"`,
      `  "mymod/internal/db"`,
      `)`,
    ].join("\n"));
    const d = await goSlopsquatting.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("still flags suspicious prefix even with internal imports present", async () => {
    const ctx = goCtx([
      `import (`,
      `  "internal/auth"`,
      `  "super-logger"`,
      `)`,
    ].join("\n"));
    const d = await goSlopsquatting.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.message).toContain("super-");
  });
});

import { describe, it, expect } from "vitest";
import { goSprintfSql } from "../../../src/detectors/go/sprintf-sql.js";
import type { DetectorContext } from "../../../src/types.js";

function goCtx(content: string, filePath = "main.go"): DetectorContext {
  return { filePath, content, language: "go" as any };
}

describe("Go Sprintf SQL Injection Detector", () => {
  it("1. detects fmt.Sprintf with SELECT — 1 critical", async () => {
    const ctx = goCtx(`  query := fmt.Sprintf("SELECT * FROM users WHERE id = %s", userInput)`);
    const d = await goSprintfSql.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("fmt.Sprintf");
  });

  it("2. detects fmt.Sprintf with INSERT — 1 critical", async () => {
    const ctx = goCtx(`  query := fmt.Sprintf("INSERT INTO logs VALUES ('%s')", msg)`);
    const d = await goSprintfSql.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("3. allows parameterized query — 0 detections", async () => {
    const ctx = goCtx(`  db.Query("SELECT * FROM users WHERE id = ?", id)`);
    const d = await goSprintfSql.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("4. detects string concatenation building SQL — 1 critical", async () => {
    const ctx = goCtx(`  query := "SELECT * FROM users WHERE name = '" + userName + "'"`);
    const d = await goSprintfSql.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("concatenation");
  });

  it("5. allows fmt.Sprintf without SQL keywords — 0 detections", async () => {
    const ctx = goCtx(`  msg := fmt.Sprintf("Hello %s", name)`);
    const d = await goSprintfSql.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("6. skips non-Go language — 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "main.py",
      content: `query = fmt.Sprintf("SELECT * FROM users WHERE id = %s", userInput)`,
      language: "python" as any,
    };
    const d = await goSprintfSql.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("7. detects DELETE in fmt.Sprintf — 1 critical", async () => {
    const ctx = goCtx(`  q := fmt.Sprintf("DELETE FROM sessions WHERE token = '%s'", tok)`);
    const d = await goSprintfSql.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });
});

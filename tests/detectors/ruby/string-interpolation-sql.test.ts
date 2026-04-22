import { describe, it, expect } from "vitest";
import { rubyStringInterpolationSql } from "../../../src/detectors/ruby/string-interpolation-sql.js";
import type { DetectorContext } from "../../../src/types.js";

function rubyCtx(content: string, filePath = "app.rb"): DetectorContext {
  return { filePath, content, language: "ruby" as any };
}

describe("Ruby SQL String Interpolation Detector", () => {
  // ─── Positive cases ────────────────────────────────────────────

  it("1. User.where with interpolation → 1 critical", async () => {
    const ctx = rubyCtx(`User.where("name = '#{name}'")`);
    const d = await rubyStringInterpolationSql.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.detector).toBe("ruby/string-interpolation-sql");
  });

  it("2. find_by_sql with interpolation → 1 critical", async () => {
    const ctx = rubyCtx(`User.find_by_sql("SELECT * FROM users WHERE id = #{id}")`);
    const d = await rubyStringInterpolationSql.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("3. connection.execute with interpolation → 1 critical", async () => {
    const ctx = rubyCtx(`connection.execute("DELETE FROM users WHERE id = #{id}")`);
    const d = await rubyStringInterpolationSql.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("4. .select with interpolation → 1 critical", async () => {
    const ctx = rubyCtx(`User.select("#{column_name}")`);
    const d = await rubyStringInterpolationSql.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("5. .order with interpolation → 1 critical", async () => {
    const ctx = rubyCtx(`User.order("#{sort_col} ASC")`);
    const d = await rubyStringInterpolationSql.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  // ─── Negative cases ────────────────────────────────────────────

  it("6. User.where with placeholder → 0 (parameterized)", async () => {
    const ctx = rubyCtx(`User.where("name = ?", name)`);
    const d = await rubyStringInterpolationSql.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("7. User.where with hash syntax → 0", async () => {
    const ctx = rubyCtx(`User.where(name: name)`);
    const d = await rubyStringInterpolationSql.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("8. Non-Ruby language → 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "app.py",
      content: `User.where("name = '#{name}'")`,
      language: "python" as any,
    };
    const d = await rubyStringInterpolationSql.run(ctx);
    expect(d).toHaveLength(0);
  });

  // ─── Edge cases ────────────────────────────────────────────────

  it("9. Plain string without interpolation → 0", async () => {
    const ctx = rubyCtx(`User.where("name = 'literal'")`);
    const d = await rubyStringInterpolationSql.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("10. Multiple SQL injections on separate lines → multiple detections", async () => {
    const ctx = rubyCtx(`
User.where("name = '#{name}'")
Post.find_by_sql("SELECT * FROM posts WHERE id = #{id}")
`);
    const d = await rubyStringInterpolationSql.run(ctx);
    expect(d).toHaveLength(2);
  });
});

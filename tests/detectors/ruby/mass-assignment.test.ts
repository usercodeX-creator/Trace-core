import { describe, it, expect } from "vitest";
import { rubyMassAssignment } from "../../../src/detectors/ruby/mass-assignment.js";
import type { DetectorContext } from "../../../src/types.js";

function rubyCtx(content: string, filePath = "app.rb"): DetectorContext {
  return { filePath, content, language: "ruby" as any };
}

describe("Ruby Mass Assignment Detector", () => {
  // ─── Positive cases ────────────────────────────────────────────

  it("1. User.create(params) → 1 critical", async () => {
    const ctx = rubyCtx(`User.create(params)`);
    const d = await rubyMassAssignment.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.detector).toBe("ruby/mass-assignment");
  });

  it("2. User.new(params) → 1 critical", async () => {
    const ctx = rubyCtx(`User.new(params)`);
    const d = await rubyMassAssignment.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("3. record.update(params) → 1 critical", async () => {
    const ctx = rubyCtx(`record.update(params)`);
    const d = await rubyMassAssignment.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("4. User.create!(params) → 1 critical (bang variant)", async () => {
    const ctx = rubyCtx(`User.create!(params)`);
    const d = await rubyMassAssignment.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("5. User.update_attributes(params) → 1 critical", async () => {
    const ctx = rubyCtx(`User.update_attributes(params)`);
    const d = await rubyMassAssignment.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  // ─── Negative cases ────────────────────────────────────────────

  it("6. User.create(params.permit(:name, :email)) → 0 (strong params)", async () => {
    const ctx = rubyCtx(`User.create(params.permit(:name, :email))`);
    const d = await rubyMassAssignment.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("7. User.create(safe_params) → 0 (not raw params)", async () => {
    const ctx = rubyCtx(`User.create(safe_params)`);
    const d = await rubyMassAssignment.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("8. Non-Ruby language → 0 detections", async () => {
    const ctx: DetectorContext = {
      filePath: "app.py",
      content: `User.create(params)`,
      language: "python" as any,
    };
    const d = await rubyMassAssignment.run(ctx);
    expect(d).toHaveLength(0);
  });

  // ─── Edge cases ────────────────────────────────────────────────

  it("9. Multiple mass assignments on separate lines → multiple detections", async () => {
    const ctx = rubyCtx(`
User.create(params)
Post.new(params)
`);
    const d = await rubyMassAssignment.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(2);
  });

  it("10. User.where(params) → 0 (not a mass assignment method)", async () => {
    const ctx = rubyCtx(`User.where(params)`);
    const d = await rubyMassAssignment.run(ctx);
    expect(d).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import { silentException } from "../../src/detectors/silent-exception.js";
import type { DetectorContext } from "../../src/types.js";

function pyCtx(content: string, filePath = "app.py"): DetectorContext {
  return { filePath, content, language: "python" };
}

function jsCtx(content: string, filePath = "app.js"): DetectorContext {
  return { filePath, content, language: "javascript" };
}

describe("Silent Exception Detector", () => {
  // ─── Python positive cases ─────────────────────────────────────

  it("1. bare except:pass → 1 critical", async () => {
    const ctx = pyCtx(`
try:
    f()
except:
    pass
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.detector).toBe("silent-exception");
    expect(d[0]!.message).toContain("Empty except handler");
  });

  it("2. except Exception: pass → 1 high", async () => {
    const ctx = pyCtx(`
try:
    f()
except Exception:
    pass
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("high");
  });

  it("3. except SomeError: ... → 1 high", async () => {
    const ctx = pyCtx(`
try:
    f()
except SomeError:
    ...
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("high");
  });

  it("4. except Exception as e: print(e) → 1 medium", async () => {
    const ctx = pyCtx(`
try:
    f()
except Exception as e:
    print(e)
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("medium");
  });

  // ─── JavaScript positive cases ─────────────────────────────────

  it("5. try { f(); } catch (e) {} → 1 critical", async () => {
    const ctx = jsCtx(`
try {
  f();
} catch (e) {}
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.message).toContain("Empty catch block");
  });

  it("6. try { f(); } catch {} → 1 critical", async () => {
    const ctx = jsCtx(`
try {
  f();
} catch {}
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("7. catch with only a comment → 1 high", async () => {
    const ctx = jsCtx(`
try {
  f();
} catch (e) {
  // ignore
}
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("high");
    expect(d[0]!.message).toContain("comments");
  });

  it("8. .catch(() => {}) on promise → 1 high", async () => {
    const ctx = jsCtx(`fetchData().catch(() => {});`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("high");
    expect(d[0]!.message).toContain("Promise .catch()");
  });

  it("9. catch with only console.log → 1 medium", async () => {
    const ctx = jsCtx(`
try {
  f();
} catch (e) {
  console.log(e);
}
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("medium");
  });

  // ─── Negative cases (should NOT detect) ────────────────────────

  it("10. except with raise → 0 detections (re-raise)", async () => {
    const ctx = pyCtx(`
try:
    f()
except:
    raise
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("11. except with logger.error + raise → 0 detections", async () => {
    const ctx = pyCtx(`
try:
    f()
except:
    logger.error("failed")
    raise
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("12. intent comment before try → 0 detections", async () => {
    const ctx = pyCtx(`
# intentionally ignore this error
try:
    f()
except:
    pass
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("13. file under tests/ path → 0 detections", async () => {
    const ctx = pyCtx(
      `
try:
    f()
except:
    pass
`,
      "tests/test_app.py"
    );
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("14. except with real recovery (fallback return) → 0 detections", async () => {
    const ctx = pyCtx(`
try:
    f()
except SomeError:
    result = use_fallback()
    log_warning("used fallback")
    return result
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("15. catch with retry logic → 0 detections", async () => {
    const ctx = jsCtx(`
try {
  f();
} catch (e) {
  retry();
  log(e);
  notifyAdmin();
}
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(0);
  });

  // ─── Edge cases ────────────────────────────────────────────────

  it("16. nested try/catch, inner is empty → 1 detection on inner", async () => {
    const ctx = jsCtx(`
try {
  try {
    f();
  } catch (e) {}
} catch (outer) {
  handleError(outer);
  logToService(outer);
  notifyUser();
}
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("17. multi-line empty catch body → 1 critical", async () => {
    const ctx = jsCtx(`
try {
  f();
} catch (e) {


}
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
  });

  it("18. .catch(() => null) on promise → 1 high", async () => {
    const ctx = jsCtx(`fetchData().catch(() => null);`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("high");
  });

  it("19. catch with throw → 0 detections (re-throw)", async () => {
    const ctx = jsCtx(`
try {
  f();
} catch (e) {
  console.error(e);
  throw e;
}
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("20. fire-and-forget intent marker → 0 detections", async () => {
    const ctx = jsCtx(`
// fire-and-forget
try {
  f();
} catch (e) {}
`);
    const d = await silentException.run(ctx);
    expect(d).toHaveLength(0);
  });
});

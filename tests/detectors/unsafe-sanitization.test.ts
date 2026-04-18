import { describe, it, expect } from "vitest";
import { unsafeSanitization } from "../../src/detectors/unsafe-sanitization.js";
import type { DetectorContext } from "../../src/types.js";

function pyCtx(content: string, filePath = "app.py"): DetectorContext {
  return { filePath, content, language: "python" };
}

function jsCtx(content: string, filePath = "app.js"): DetectorContext {
  return { filePath, content, language: "javascript" };
}

describe("Unsafe Sanitization Detector", () => {
  // ─── Python positive cases ─────────────────────────────────────

  it("1. cursor.execute with f-string + request.args → 1 critical", async () => {
    const ctx = pyCtx(`
from flask import Flask, request
import sqlite3

app = Flask(__name__)
conn = sqlite3.connect(":memory:")

@app.route("/user")
def get_user():
    user_id = request.args.get("id")
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
    return cursor.fetchone()
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d).toHaveLength(1);
    expect(d[0]!.severity).toBe("critical");
    expect(d[0]!.detector).toBe("unsafe-sanitize");
    expect(d[0]!.message).toContain("SQL injection");
  });

  it("2. eval(request.args.get('x')) → 1 critical (eval always dangerous)", async () => {
    const ctx = pyCtx(`
from flask import request

def calc():
    expr = request.args.get("expr")
    return str(eval(expr))
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const evalDetection = d.find((x) => x.message.includes("eval"));
    expect(evalDetection).toBeDefined();
    expect(evalDetection!.severity).toBe("critical");
  });

  it("3. subprocess.run with f-string + shell=True + sys.argv → 1 critical", async () => {
    const ctx = pyCtx(`
import subprocess
import sys

path = sys.argv[1]
subprocess.run(f"ls {path}", shell=True)
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const cmdDetection = d.find((x) => x.message.includes("Command injection"));
    expect(cmdDetection).toBeDefined();
    expect(cmdDetection!.severity).toBe("critical");
  });

  it("4. pickle.loads(request.body) → 1 critical (pickle always dangerous)", async () => {
    const ctx = pyCtx(`
import pickle
from flask import request

data = pickle.loads(request.body)
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const pickleDetection = d.find((x) => x.message.includes("pickle"));
    expect(pickleDetection).toBeDefined();
    expect(pickleDetection!.severity).toBe("critical");
  });

  it("5. yaml.load without SafeLoader → 1 critical", async () => {
    const ctx = pyCtx(`
import yaml

with open("config.yml") as f:
    data = yaml.load(f.read())
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const yamlDetection = d.find((x) => x.message.includes("yaml"));
    expect(yamlDetection).toBeDefined();
    expect(yamlDetection!.severity).toBe("critical");
  });

  it("6. os.system with string concat + sys.argv → 1 critical", async () => {
    const ctx = pyCtx(`
import os
import sys

path = sys.argv[1]
os.system("rm -rf " + path)
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const cmdDetection = d.find((x) => x.message.includes("Command injection"));
    expect(cmdDetection).toBeDefined();
    expect(cmdDetection!.severity).toBe("critical");
  });

  it("7. render_template_string with f-string + request.args → 1 high", async () => {
    const ctx = pyCtx(`
from flask import Flask, request, render_template_string

app = Flask(__name__)

@app.route("/hello")
def hello():
    name = request.args.get("name")
    return render_template_string(f"Hello {name}")
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const sstiDetection = d.find((x) => x.message.includes("SSTI"));
    expect(sstiDetection).toBeDefined();
    expect(sstiDetection!.severity).toBe("high");
  });

  // ─── JavaScript positive cases ─────────────────────────────────

  it("8. innerHTML = req.body.html → 1 high", async () => {
    const ctx = jsCtx(`
import express from "express";
const app = express();

app.get("/render", (req, res) => {
  const html = req.body.html;
  document.querySelector("#out").innerHTML = html;
  res.send("done");
});
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const xssDetection = d.find((x) => x.message.includes("XSS"));
    expect(xssDetection).toBeDefined();
  });

  it("9. eval(document.location.hash) → 1 critical", async () => {
    const ctx = jsCtx(`
const hash = document.location.hash;
eval(hash);
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const evalDetection = d.find((x) => x.message.includes("eval"));
    expect(evalDetection).toBeDefined();
    expect(evalDetection!.severity).toBe("critical");
  });

  it("10. exec with template literal + req.query → 1 critical", async () => {
    const ctx = jsCtx(`
import { exec } from "child_process";
import express from "express";
const app = express();

app.get("/exec", (req, res) => {
  exec(\`ls \${req.query.path}\`, (err, stdout) => {
    res.send(stdout);
  });
});
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const cmdDetection = d.find((x) => x.message.includes("Command injection"));
    expect(cmdDetection).toBeDefined();
    expect(cmdDetection!.severity).toBe("critical");
  });

  it("11. db.query with template literal + req.params → 1 critical", async () => {
    const ctx = jsCtx(`
import express from "express";
const app = express();

app.get("/search", (req, res) => {
  const q = req.params.q;
  db.query(\`SELECT * FROM items WHERE name = '\${q}'\`, (err, rows) => {
    res.send(rows);
  });
});
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const sqlDetection = d.find((x) => x.message.includes("SQL injection"));
    expect(sqlDetection).toBeDefined();
    expect(sqlDetection!.severity).toBe("critical");
  });

  it("12. document.write(window.location.search) → 1 high", async () => {
    const ctx = jsCtx(`
const search = window.location.search;
document.write(search);
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const xssDetection = d.find((x) => x.message.includes("XSS"));
    expect(xssDetection).toBeDefined();
  });

  it("13. new Function(req.body.code)() → 1 critical", async () => {
    const ctx = jsCtx(`
import express from "express";
const app = express();

app.post("/run", (req, res) => {
  const code = req.body.code;
  new Function(code)();
  res.send("done");
});
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d.length).toBeGreaterThanOrEqual(1);
    const funcDetection = d.find((x) => x.message.includes("Function"));
    expect(funcDetection).toBeDefined();
    expect(funcDetection!.severity).toBe("critical");
  });

  // ─── Negative cases ────────────────────────────────────────────

  it("14. parameterized Python query → 0 detections", async () => {
    const ctx = pyCtx(`
from flask import request

user_id = request.args.get("id")
cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
`);
    const d = await unsafeSanitization.run(ctx);
    const sqlDetections = d.filter((x) => x.message.includes("SQL injection"));
    expect(sqlDetections).toHaveLength(0);
  });

  it("15. parameterized JS query → 0 detections", async () => {
    const ctx = jsCtx(`
const id = req.params.id;
db.query("SELECT * WHERE id = $1", [id]);
`);
    const d = await unsafeSanitization.run(ctx);
    const sqlDetections = d.filter((x) => x.message.includes("SQL injection"));
    expect(sqlDetections).toHaveLength(0);
  });

  it("16. hardcoded string cursor.execute → 0 detections", async () => {
    const ctx = pyCtx(`
cursor.execute("SELECT version()")
`);
    const d = await unsafeSanitization.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("17. file under tests/ path with eval → 0 detections", async () => {
    const ctx = pyCtx(
      `
eval(request.args.get("expr"))
`,
      "tests/test_security.py",
    );
    const d = await unsafeSanitization.run(ctx);
    expect(d).toHaveLength(0);
  });

  it("18. innerHTML with NO tainted source → flag medium (defensive)", async () => {
    const ctx = jsCtx(`
const html = someLocalFunction();
document.querySelector("#out").innerHTML = html;
`);
    const d = await unsafeSanitization.run(ctx);
    // No tainted source, but innerHTML is still flagged at medium per spec step 4d
    // Actually per spec: "If sink is interpolated but no tainted source → flag at LOWER severity"
    // innerHTML without interpolation and without taint → no flag for non-always-dangerous
    // But spec test 18 says: "still flag medium (defensive)"
    // The sink is non-interpolated, non-always-dangerous, no taint → should not flag
    // Wait — spec says innerHTML = ... with no taint source "should still flag medium"
    // This means for sinks that are assignments (innerHTML =), the assignment itself
    // is treated like "interpolation" because the value flows directly.
    // Let me re-read... the spec test 18 says it SHOULD flag medium.
    // This means we need to handle assignment sinks differently.
    // For now, let's check what actually happens.
    // If innerHTML = html (no template literal, no string concat), it's not "interpolated"
    // in the traditional sense, but it's still flowing data to a dangerous sink.
    // The spec says "still flag medium (defensive)" — so we need to ensure this works.
    expect(d.length).toBeGreaterThanOrEqual(1);
    if (d.length > 0) {
      expect(d[0]!.severity).toBe("medium");
    }
  });

  it("19. sanitizer present (escape) → 0 detections for non-always-dangerous", async () => {
    const ctx = jsCtx(`
import express from "express";
const app = express();

app.get("/render", (req, res) => {
  const html = escape(req.body.html);
  document.querySelector("#out").innerHTML = html;
  res.send("done");
});
`);
    const d = await unsafeSanitization.run(ctx);
    const xssDetections = d.filter((x) => x.message.includes("XSS"));
    expect(xssDetections).toHaveLength(0);
  });

  // ─── Edge cases ────────────────────────────────────────────────

  it("20. two tainted sinks in same file → 2 detections", async () => {
    const ctx = pyCtx(`
from flask import request
import os

user_input = request.args.get("cmd")
os.system("echo " + user_input)
os.popen("cat " + user_input)
`);
    const d = await unsafeSanitization.run(ctx);
    const cmdDetections = d.filter((x) => x.message.includes("Command injection"));
    expect(cmdDetections).toHaveLength(2);
  });

  it("21. sink with both string concat AND f-string → single detection (not double)", async () => {
    const ctx = pyCtx(`
from flask import request

user_id = request.args.get("id")
cursor.execute(f"SELECT * FROM users WHERE id = " + user_id)
`);
    const d = await unsafeSanitization.run(ctx);
    const sqlDetections = d.filter((x) => x.message.includes("SQL injection"));
    expect(sqlDetections).toHaveLength(1);
  });
});

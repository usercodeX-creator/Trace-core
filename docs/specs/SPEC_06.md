# SPEC_06 — Detector 06: Unsafe Sanitization

> **For Claude Code**: Read this completely. Follow `ARCHITECTURE.md` Principle 1 (pluggable) and Principle 5 (fail loudly). This adds the fourth detector.

---

## Purpose

Detect code where **untrusted input reaches a dangerous sink without sanitization**. This covers the classic injection attack surface — SQL injection, XSS, command injection, path traversal, prototype pollution.

AI-generated code fails this constantly. When prompted "build an API endpoint that searches users by name", the model happily writes `cursor.execute(f"SELECT * WHERE name = '{name}'")` because it reads as natural code that works in the happy path.

---

## Detection Strategy: Source + Sink Co-presence

**Heuristic, not full dataflow analysis**. We do NOT track variable propagation. We detect:

1. A **tainted source** appears in the file (user input enters)
2. A **dangerous sink** appears in the file (untrusted data reaches a risky operation)
3. Both are present → emit `medium` severity warning

If the sink contains a **string-interpolation pattern** (f-string, template literal, `%` formatting, `+` concatenation) directly, escalate to `high`.

If the sink is a **hardcoded dangerous function** with no sanitization in sight (e.g. `eval(x)`, `shell=True`), emit `critical`.

This heuristic will miss some cases (low recall) but rarely false-positive on clean code (high precision when source is absent).

---

## Tainted Sources (Python)

Detect these patterns as "taint enters":

```python
# HTTP frameworks
request.GET[...]            # Django
request.POST[...]
request.args[...]           # Flask
request.form[...]
request.json[...]
request.params[...]
request.query[...]
request.body[...]
flask.request.*
django.http.HttpRequest.*

# CLI / env
sys.argv[...]
os.environ[...]             # sometimes sensitive, but treat as untrusted
argparse.Namespace.*        # harder to detect statically, skip for now
input(...)                  # user keyboard input
raw_input(...)              # python 2 legacy

# Deserialization (already dangerous but also taint)
json.loads(request.body)
pickle.loads(...)
yaml.load(...)              # separate flag below
```

## Tainted Sources (JavaScript/TypeScript)

```javascript
// Express / Node
req.body
req.params
req.query
req.headers
req.cookies

// Browser
document.location.*         // URL fragments, query strings
window.location.*
URLSearchParams.get(...)
localStorage.getItem(...)
sessionStorage.getItem(...)
document.cookie
window.name

// Messaging
window.addEventListener("message", e => e.data.*)
postMessage recipient

// CLI / env
process.argv[...]
process.env.*               // treat as untrusted
```

Implementation: a list of regex snippets in `src/lib/taint-sources.ts`.

---

## Dangerous Sinks (Python)

| Sink | Why dangerous | Severity if interpolated |
|------|---------------|--------------------------|
| `cursor.execute(...)` | SQL injection | `critical` |
| `conn.execute(...)` | SQL injection | `critical` |
| `db.query(...)` | SQL injection | `critical` |
| `session.execute(text(...))` | SQLAlchemy raw SQL | `critical` |
| `eval(...)` | Arbitrary code exec | `critical` always |
| `exec(...)` | Arbitrary code exec | `critical` always |
| `compile(...)` | Code compilation | `high` |
| `os.system(...)` | Command injection | `critical` |
| `os.popen(...)` | Command injection | `critical` |
| `subprocess.call(..., shell=True)` | Command injection | `critical` |
| `subprocess.run(..., shell=True)` | Command injection | `critical` |
| `subprocess.Popen(..., shell=True)` | Command injection | `critical` |
| `open(..., "r")` with path from taint | Path traversal | `high` |
| `pickle.loads(...)` | Deserialization RCE | `critical` always |
| `yaml.load(...)` without SafeLoader | Deserialization RCE | `critical` always |
| `Template(...).render(...)` | SSTI (Jinja2) | `high` |
| `render_template_string(...)` | SSTI (Flask) | `high` |

## Dangerous Sinks (JavaScript/TypeScript)

| Sink | Why dangerous | Severity if interpolated |
|------|---------------|--------------------------|
| `eval(...)` | Arbitrary code exec | `critical` always |
| `Function(...)` (constructor call) | Dynamic code | `critical` always |
| `new Function(...)` | Same | `critical` always |
| `setTimeout(string, ...)` | Code string eval | `high` |
| `setInterval(string, ...)` | Code string eval | `high` |
| `innerHTML = ...` | XSS | `high` |
| `outerHTML = ...` | XSS | `high` |
| `document.write(...)` | XSS | `high` |
| `insertAdjacentHTML(...)` | XSS | `high` |
| `.html(...)` (jQuery) | XSS | `high` |
| `dangerouslySetInnerHTML` (React) | XSS | `high` |
| `exec(...)` from `child_process` | Command injection | `critical` |
| `execSync(...)` | Command injection | `critical` |
| `spawn(..., { shell: true })` | Command injection | `critical` |
| `db.query(...)` with interpolation | SQL injection | `critical` |
| `connection.query(...)` | SQL injection | `critical` |
| `fs.readFile(path)` where path has taint | Path traversal | `high` |

Implementation: a lookup table in `src/lib/dangerous-sinks.ts`.

---

## Interpolation Detection

For sinks that are conditional on interpolation (SQL injection, XSS), detect:

**Python**:
- f-string: `f"...{var}..."`
- `%` formatting: `"...%s..." % var` or `"..." % (var,)`
- `.format()`: `"...{}...".format(var)`
- string concat: `"SELECT ... " + var + " ..."`

**JavaScript/TypeScript**:
- Template literal: `` `...${var}...` ``
- String concat: `"SELECT ..." + var + "..."`

Presence of interpolation inside a sink argument → the sink is a candidate for unsafe use.

---

## Detection Logic (per file)

```
1. Scan file, find all tainted-source matches → record line numbers
2. If zero tainted sources found → return [] (nothing to warn about)
3. Scan file, find all dangerous-sink matches → record line, severity hint
4. For each sink:
   a. Check if the sink argument contains interpolation
   b. If sink is in "always dangerous" list (eval, pickle.loads) → flag unconditionally
   c. If sink is interpolated AND tainted source exists in file → flag at sink's severity
   d. If sink is interpolated but no tainted source in file → flag at LOWER severity (medium)
5. Sort by line number, return
```

Key point: **The co-presence rule** — sink severity is tied to whether a tainted source exists elsewhere in the file. This is the cheap heuristic that replaces real dataflow.

---

## False Positive Filters

Skip detection when:

1. **File path** contains `test`, `tests`, `spec`, `__tests__`, `.test.`, `.spec.`, `mock`, `fixture`
2. **Sink call uses a parameterized form** — detected by presence of:
   - Python: second argument is a tuple/dict (e.g. `cursor.execute(sql, (id,))`)
   - JavaScript: second argument is an array (e.g. `db.query(sql, [id])`)
   - Prepared statement patterns: `?` placeholders, `$1/$2` numbered params, `:name` named params
3. **Sanitizer is called in the file** — if these functions appear in the file, trust the developer used them:
   - `escape()`, `htmlentities()`, `html.escape()` (Python)
   - `DOMPurify.sanitize(...)`, `escape-html`, `sanitize-html` (JS)
   - `shlex.quote(...)` (Python shell)
   - Pre-existing parameterized query builders

   Note: this is imperfect — a sanitizer call doesn't prove *this specific* value is sanitized. But it's a reasonable heuristic to reduce noise.
4. **Hardcoded string sink** — if the sink's argument is a literal with no interpolation, no taint flag:
   ```python
   cursor.execute("SELECT version()")  # safe, no interpolation
   ```

---

## Output Format

```
$ npx trace-check examples/unsafe-sinks.py

trace-check v0.4.0

examples/unsafe-sinks.py
  ✗ critical  line 8   SQL injection: cursor.execute with f-string interpolation
               >  cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
  ✗ critical  line 12  Arbitrary code execution: eval() with untrusted input
               >  eval(request.args.get("expr"))
  ✗ critical  line 17  Command injection: subprocess.run with shell=True and interpolation
               >  subprocess.run(f"ls {path}", shell=True)
  ✗ high      line 22  Possible SSTI: render_template_string with interpolation
               >  render_template_string(f"Hello {name}")

Summary: 4 issues found across 1 file.
```

Show the actual source line. Do not truncate mid-identifier. Up to 100 chars, then `...`.

---

## Architecture Integration

### File layout

```
src/
├── detectors/
│   ├── index.ts                   ← UPDATE: register unsafeSanitization
│   ├── hallucinated-deps.ts       (existing)
│   ├── credential-leak.ts         (existing)
│   ├── silent-exception.ts        (existing)
│   └── unsafe-sanitization.ts     ← NEW
└── lib/
    ├── entropy.ts                 (existing)
    ├── secret-patterns.ts         (existing)
    ├── taint-sources.ts           ← NEW: source regex table
    └── dangerous-sinks.ts         ← NEW: sink regex table + severity
```

### Types

No structural changes. Add `"unsafe-sanitization"` to `DetectorId` union in `src/types.ts`.

---

## Tests

Add `tests/detectors/unsafe-sanitization.test.ts` with **at least 18 tests**:

### Python positive cases (should detect):
1. `cursor.execute(f"SELECT ... {id}")` + `request.args` in file → 1 critical
2. `eval(request.args.get("x"))` → 1 critical (eval always)
3. `subprocess.run(f"ls {p}", shell=True)` + `sys.argv` → 1 critical
4. `pickle.loads(request.body)` → 1 critical (pickle always)
5. `yaml.load(f.read())` (without SafeLoader) → 1 critical
6. `os.system("rm -rf " + path)` + `sys.argv` → 1 critical
7. `render_template_string(f"hi {name}")` + `request.args` → 1 high

### JavaScript positive cases (should detect):
8. `el.innerHTML = req.body.html` + `req.body` → 1 high
9. `eval(document.location.hash)` → 1 critical
10. `exec(\`ls ${req.query.path}\`)` from `child_process` → 1 critical
11. `db.query(\`SELECT * WHERE id = ${req.params.id}\`)` → 1 critical
12. `document.write(window.location.search)` → 1 high
13. `new Function(req.body.code)()` → 1 critical

### Negative cases (should NOT detect):
14. `cursor.execute("SELECT * FROM users WHERE id = ?", (id,))` → 0 (parameterized)
15. `db.query("SELECT * WHERE id = $1", [id])` → 0 (parameterized)
16. `cursor.execute("SELECT version()")` → 0 (hardcoded, no interpolation)
17. File under `tests/` path containing `eval(...)` → 0 (path filter)
18. File with `innerHTML = ...` but NO tainted source anywhere → still flag medium (defensive)
19. File uses `escape()` before interpolation:
    ```js
    el.innerHTML = escape(req.body.html)
    ```
    → 0 (sanitizer present heuristic — imperfect but expected behavior)

### Edge cases:
20. Two tainted sinks in same file → 2 detections
21. Sink with both string concat AND f-string → single detection (not double)

---

## Example File to Create

### `examples/unsafe-sinks.py`

```python
# Intentional demo of unsafe sanitization
# DO NOT use these patterns in production

from flask import Flask, request
import subprocess
import os
import sqlite3

app = Flask(__name__)
conn = sqlite3.connect(":memory:")

@app.route("/user")
def get_user():
    user_id = request.args.get("id")
    cursor = conn.cursor()
    # Critical: SQL injection via f-string
    cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
    return cursor.fetchone()

@app.route("/calc")
def calculate():
    expr = request.args.get("expr")
    # Critical: arbitrary code execution
    return str(eval(expr))

@app.route("/list")
def list_files():
    path = request.args.get("path", ".")
    # Critical: command injection
    subprocess.run(f"ls {path}", shell=True)
    return "done"

@app.route("/hello")
def hello():
    name = request.args.get("name")
    from flask import render_template_string
    # High: SSTI
    return render_template_string(f"Hello {name}")
```

Expected: 4 detections (3 critical + 1 high).

### `examples/unsafe-sinks.js`

```javascript
// Intentional demo of unsafe sanitization
// DO NOT use these patterns in production

import express from "express";
import { exec } from "child_process";

const app = express();

app.get("/render", (req, res) => {
  const html = req.body.html;
  // High: XSS via innerHTML
  document.querySelector("#out").innerHTML = html;
  res.send("done");
});

app.get("/eval", (req, res) => {
  const code = req.body.code;
  // Critical: arbitrary code execution
  eval(code);
  res.send("done");
});

app.get("/exec", (req, res) => {
  const path = req.query.path;
  // Critical: command injection
  exec(`ls ${path}`, (err, stdout) => {
    res.send(stdout);
  });
});

app.get("/search", (req, res) => {
  const q = req.params.q;
  // Critical: SQL injection (pseudo-code)
  db.query(`SELECT * FROM items WHERE name = '${q}'`, (err, rows) => {
    res.send(rows);
  });
});
```

Expected: 4 detections (3 critical + 1 high).

---

## Acceptance Criteria

1. `npm test` — all existing 53 tests still green, plus 18+ new tests (71+ total)
2. `npm run build` — zero errors
3. `npx trace-check examples/unsafe-sinks.py` — 4 detections
4. `npx trace-check examples/unsafe-sinks.js` — 4 detections
5. No regression in other detectors
6. `package.json` → v0.4.0
7. `CHANGELOG.md` → v0.4.0 entry
8. `README.md`:
   - Pattern #06 status from `Cloud` to `✅ v0.4.0`
   - Detection table shows 4 OSS patterns, 3 Cloud patterns

---

## What You're NOT Building

- Full dataflow analysis (variable propagation, function-level taint tracking) — that's Trace Cloud
- Language support beyond Python/JS/TS
- Auto-fix suggestions
- Context-sensitive DOM XSS (e.g. attribute vs. element injection) — coarse detection only

---

## Reporting

After Phase H:

1. `npm test` output (71+ tests green)
2. `npm run build` confirmation
3. `npx trace-check examples/unsafe-sinks.py` output
4. `npx trace-check examples/unsafe-sinks.js` output
5. File diff summary
6. Any architectural decisions not in spec

Do not push.

---

## Implementation Phases

Recommended order:

- **Phase A**: Build `src/lib/taint-sources.ts` with regex table + `hasTaintedSource(content, language)` helper
- **Phase B**: Build `src/lib/dangerous-sinks.ts` with sink definitions, severity tiers, "always dangerous" flag
- **Phase C**: Implement `src/detectors/unsafe-sanitization.ts` using the co-presence heuristic
- **Phase D**: Register in `src/detectors/index.ts`, update `DetectorId` in `src/types.ts`
- **Phase E**: Write 18+ tests
- **Phase F**: Create `examples/unsafe-sinks.{py,js}`
- **Phase G**: Update version (0.4.0), CHANGELOG, README pattern status
- **Phase H**: Run `npm test` AND `npm run build` AND both CLI examples

# SPEC_05 — Detector 05: Silent Exception Handling

> **For Claude Code**: Read this completely. Follow `ARCHITECTURE.md` Principle 1 (pluggable) and Principle 5 (fail loudly). This adds a new detector alongside existing `hallucinated-deps` and `credential-leak`.

---

## Purpose

Detect exception handlers that silently swallow errors — `except: pass`, empty `catch {}` blocks, and their variants. These are among the most damaging AI-generated bugs because they **hide symptoms of real problems** while making tests pass.

---

## Why This Matters

When an AI coding assistant is asked "make this error go away", it frequently wraps the problematic code in an empty try/catch rather than fixing the underlying issue. This is the digital equivalent of putting tape over a check-engine light.

Real-world consequences:
- Authentication failures swallowed silently → users appear logged in but aren't
- Database write errors ignored → data loss without warning
- API errors caught and discarded → downstream systems receive stale data
- Security validation errors suppressed → attack paths left open

Existing linters (ESLint, Pylint) have some rules for this, but they're off by default, underpowered, or don't distinguish intentional from dangerous patterns.

---

## Detection Scope

### Python patterns to detect

**Pattern A — Bare `except: pass`**:
```python
try:
    risky_operation()
except:
    pass
```

**Pattern B — `except Exception: pass`** (slightly less bad, still a leak):
```python
try:
    risky_operation()
except Exception:
    pass
```

**Pattern C — Empty handler body with only `...` or a docstring**:
```python
try:
    risky_operation()
except SomeError:
    ...  # "TODO" or docstring-only body
```

**Pattern D — `except` that only logs but uses `print` without re-raise** (warn, lower severity):
```python
try:
    risky_operation()
except Exception as e:
    print(e)  # printed but not handled, not re-raised
```

### JavaScript/TypeScript patterns to detect

**Pattern E — Empty `catch` block**:
```javascript
try {
  riskyOperation();
} catch (e) {
  // empty
}

try {
  riskyOperation();
} catch {}
```

**Pattern F — `catch` with only a comment**:
```javascript
try {
  riskyOperation();
} catch (e) {
  // ignore
}
```

**Pattern G — `.catch(() => {})` or `.catch(() => null)` on promises**:
```javascript
fetchData().catch(() => {});
fetchData().catch(() => null);
```

**Pattern H — `catch` that only uses `console.log` without re-throw** (warn, lower severity):
```javascript
try {
  riskyOperation();
} catch (e) {
  console.log(e);
}
```

---

## Severity Assignment

| Pattern | Severity | Reason |
|---------|----------|--------|
| A, E (bare empty) | `critical` | Maximum suppression, zero visibility |
| B, C, F (near-empty) | `high` | Still hides errors |
| G (promise swallow) | `high` | Often hides network/API failures |
| D, H (log-only) | `medium` | Some visibility, but no recovery or re-raise |

---

## False Positive Filters

Skip detection when:

1. **File path filter**:
   - `test`, `tests`, `spec`, `__tests__`, `.test.`, `.spec.`
   - Test files legitimately catch exceptions to assert on them

2. **Explicit intent comment within 3 lines before the try block**:
   ```python
   # intentionally ignore — this error is expected
   try:
       ...
   except:
       pass
   ```
   Intent markers (case-insensitive): `intentional`, `deliberately`, `expected`, `best-effort`, `fire-and-forget`, `noqa`, `suppress`

3. **Re-raise is present** (handler contains `raise` / `throw`):
   ```python
   except Exception:
       logger.error(...)
       raise  # re-raises, NOT silent
   ```
   This is proper error handling, don't flag.

4. **Handler has substantive body** (more than 2 statements that aren't just logging):
   If the catch block has real recovery logic (retry, fallback value, cleanup), it's not a silent handler.

---

## Architecture Integration

### File layout

```
src/
├── detectors/
│   ├── index.ts                 ← UPDATE: register silentException
│   ├── hallucinated-deps.ts     (existing)
│   ├── credential-leak.ts       (existing)
│   └── silent-exception.ts      ← NEW
└── parsers/
    ├── python.ts                (existing — reuse regex approach OR extend)
    ├── javascript.ts            (existing)
    └── exception-patterns.ts    ← NEW: shared helpers for try/catch scanning
```

### Implementation approach

**Do NOT use heavyweight AST parsers** (tree-sitter, TypeScript compiler, ast module). The existing parsers are regex-based by design (see ARCHITECTURE.md — keep the stack small).

Use **regex + minimal state tracking** to find try/catch blocks and inspect their bodies:

1. Find `try` keyword → locate matching `except` / `catch` clause
2. Extract the handler body (between braces for JS, by indentation for Python)
3. Check body contents against patterns above
4. Apply filters

This is heuristic, not perfect. That's acceptable for v0.3.0. Note in the detector's description that it's heuristic and may miss deeply nested cases. **Fail loudly on parse ambiguity** — if the handler body can't be parsed cleanly, emit a `low` severity "unparseable handler" detection rather than silently skipping.

### Types

No changes to `src/types.ts` structure. Add `"silent-exception"` to the `DetectorId` union.

Populate `Detection`:
- `detector: "silent-exception"`
- `line`: line of the `except:` or `catch` keyword
- `message`: describe which pattern, e.g.
  - `"Empty except handler silently swallows all exceptions"`
  - `"Bare except: pass with no error handling"`
  - `"Promise .catch() discards all errors"`
- `rawCode`: the try/except structure (abbreviated, up to ~80 chars)

---

## Tests

Add `tests/detectors/silent-exception.test.ts` with **at least 15 tests**:

### Python positive cases (should detect):
1. `try: f()\nexcept: pass` → 1 critical
2. `try: f()\nexcept Exception: pass` → 1 high
3. `try: f()\nexcept: ...` → 1 high
4. `try: f()\nexcept Exception as e: print(e)` → 1 medium

### JavaScript positive cases (should detect):
5. `try { f(); } catch (e) {}` → 1 critical
6. `try { f(); } catch {}` → 1 critical
7. `try { f(); } catch (e) { /* ignore */ }` → 1 high
8. `fetchData().catch(() => {});` → 1 high
9. `try { f(); } catch (e) { console.log(e); }` → 1 medium

### Negative cases (should NOT detect):
10. `try: f()\nexcept: raise` → 0 detections (re-raise)
11. `try: f()\nexcept: logger.error(); raise` → 0 detections (log + re-raise)
12. `# intentional\ntry: f()\nexcept: pass` → 0 detections (intent comment)
13. File under `tests/` path → 0 detections (path filter)
14. `try: f()\nexcept SomeError: use_fallback(); return fallback` → 0 detections (real recovery)
15. `try { f(); } catch (e) { retry(); }` → 0 detections (real recovery)

### Edge cases:
16. Nested try/catch, inner is empty → 1 detection on inner
17. Multi-line empty body: `catch (e) {\n\n\n}` → 1 critical (still empty)

---

## Output Format

Expected CLI output:

```
$ npx trace-check examples/silent-exceptions.py

trace-check v0.3.0

examples/silent-exceptions.py
  ✗ critical  line 5   Empty except handler silently swallows all exceptions
               >  try:
                      risky()
                  except:
                      pass
  ✗ high      line 12  except Exception with no recovery
               >  except Exception:
                      ...

Summary: 2 issues found across 1 file.
```

Keep the multiline preview readable, indent with 2 spaces.

---

## Example Files to Create

### `examples/silent-exceptions.py`

```python
# Intentional demo of silent exception anti-patterns
# DO NOT copy these patterns into real code

import requests

def fetch_user(user_id):
    # Pattern A: bare except with pass — critical
    try:
        response = requests.get(f"/users/{user_id}")
        return response.json()
    except:
        pass


def validate_payment(amount):
    # Pattern B: except Exception: pass — high
    try:
        check_fraud_signals(amount)
    except Exception:
        pass


def log_event(event):
    # Pattern D: print-only — medium
    try:
        send_to_analytics(event)
    except Exception as e:
        print(e)
```

Expected: 1 critical + 1 high + 1 medium = 3 detections.

### `examples/silent-exceptions.js`

```javascript
// Intentional demo of silent exception anti-patterns

function loadConfig() {
  // Pattern E: empty catch — critical
  try {
    return JSON.parse(localStorage.getItem("config"));
  } catch (e) {}
}

function submitForm(data) {
  // Pattern G: .catch(() => {}) — high
  fetch("/api/submit", { method: "POST", body: data }).catch(() => {});
}

async function loadUser(id) {
  // Pattern H: console.log only — medium
  try {
    return await api.get(`/user/${id}`);
  } catch (e) {
    console.log(e);
  }
}
```

Expected: 1 critical + 1 high + 1 medium = 3 detections.

---

## Acceptance Criteria

1. `npm test` — all previous 33 tests pass, plus 15+ new tests
2. `npx trace-check examples/silent-exceptions.py` → 3 detections
3. `npx trace-check examples/silent-exceptions.js` → 3 detections
4. No regression in existing detections
5. `package.json` → v0.3.0
6. `CHANGELOG.md` → v0.3.0 entry
7. `README.md` → Pattern #05 status from `Cloud` to `✅ v0.3.0`

---

## What You're NOT Building

- Full AST parser (regex + state tracking only)
- Language support beyond Python/JS/TS
- Auto-fix suggestions (Phase 3)
- Cross-file analysis (detecting swallowed errors that propagate from another file)

---

## Reporting

When done, report:

1. `npm test` output showing all tests green
2. `npx trace-check examples/silent-exceptions.py` output
3. `npx trace-check examples/silent-exceptions.js` output
4. File diff summary
5. Any architectural decisions not in this spec

Do not push. I'll review.

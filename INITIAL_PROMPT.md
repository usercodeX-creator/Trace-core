# INITIAL_PROMPT — Trace Core Bootstrap Instructions

> **For Claude Code**: Read this file completely, then read `SPEC.md` and `ARCHITECTURE.md`. After that, execute the bootstrap tasks in order. Ask me before skipping any step.

---

## Project Context

You are bootstrapping **trace-core**, the open-source engine of the **Trace** platform.

**What Trace is**: A security and quality layer for AI-generated ("vibe-coded") code. It detects defects that existing tools (Snyk, Semgrep, SonarQube) miss because those tools target human-written vulnerabilities, not LLM-specific failure modes.

**What trace-core is**: The MIT-licensed OSS detection engine. It ships 2 of 7 detection patterns (the full 7 are reserved for the paid `Trace Cloud` SaaS). Users install it via `npx trace-check <file>` or as a GitHub Action.

**Target users**: Individual developers using Cursor, Claude Code, Copilot, Lovable, Replit Agent. They want a free way to catch AI-generated defects before committing.

**Strategic goal**: Reach 3,000+ GitHub stars in 3 months. The OSS presence becomes marketing for the paid SaaS.

---

## Current State

Nothing exists. This is commit #1. The repo is empty except for:
- `INITIAL_PROMPT.md` (this file)
- `SPEC.md` (what to build)
- `ARCHITECTURE.md` (how to build it, with 5-extension future-proofing)

---

## Bootstrap Tasks (Execute in Order)

### Phase 0: Verify Environment

1. Confirm Node.js >= 18 is installed (`node --version`)
2. Confirm git is initialized (`git status`). If not, `git init`
3. Confirm you have network access (you'll need to hit npm and PyPI registries)

### Phase 1: Project Scaffold

Create the directory structure exactly as specified in `ARCHITECTURE.md` section "Directory Structure". Do NOT deviate — the structure is designed for 5 future extensions.

Create these files with minimal valid content:
- `package.json` (use the template in `SPEC.md` section "Package Manifest")
- `tsconfig.json` (use the template in `SPEC.md`)
- `.gitignore` (standard Node.js gitignore)
- `LICENSE` (MIT, copyright 2026 Trace)
- `README.md` (minimal placeholder, we'll write the real one later)

### Phase 2: First Detector — Hallucinated Dependencies (Pattern #01)

This is the MVP. The one thing that must work before anything else.

**What it does**: Given a source file (Python or JS/TS), extract all `import` statements, query the appropriate registry (PyPI or npm), report imports that don't exist.

**Why this pattern first**:
- Most viral — "Claude imported a package that doesn't exist!" is tweetable
- Simplest to implement — no AST needed, regex + HTTP
- Highest precision — either the package exists or it doesn't, no false positives from LLM judgment
- Directly addresses the "slopsquatting" attack vector

**Implementation**: Follow the spec in `SPEC.md` section "Detector 01: Hallucinated Dependencies" exactly. Don't invent features.

### Phase 3: CLI

Build `src/cli.ts` that:
- Accepts a file path as argument
- Auto-detects language from extension (.py, .js, .ts, .jsx, .tsx)
- Runs the hallucinated-deps detector
- Prints results with color (chalk)
- Exits with code 0 if no issues, 1 if issues found (so CI can use it)

### Phase 4: Tests

Write Vitest tests for:
- The Python parser with 3 sample inputs (valid, has hallucination, empty)
- The JS parser with 3 sample inputs
- The detector end-to-end with mocked registry responses

**Do not** write tests that hit the real npm/PyPI registry. Mock them.

### Phase 5: Build and Verify

1. `npm install`
2. `npm run build` — must succeed with zero errors
3. `npm test` — all tests must pass
4. Create a test file `test-input.py` with a deliberately hallucinated import:
   ```python
   import numpy
   import fake_library_that_does_not_exist_9999
   from totally_real_package import something
   ```
5. Run `npx trace-check test-input.py` — must detect the 2 hallucinated packages

### Phase 6: First Commit

Once Phase 5 verification passes:

```bash
git add .
git commit -m "feat: initial commit — trace-core v0.1.0 with hallucinated dependency detection

Ships Pattern #01 of 7: detects npm/PyPI imports that don't exist.
Covers the 'slopsquatting' attack vector made famous by AI coding assistants.

Architecture: plugin-based detectors, designed for 5 future extensions.
See ARCHITECTURE.md for the full vision."
```

**Do NOT push yet**. I want to review before it goes public.

---

## Rules of Engagement

1. **Ask before deviating**. If `SPEC.md` says X but you think Y is better, stop and ask.

2. **No scope creep**. Do NOT add patterns #02-#07 yet. Do NOT add Auto Fix. Do NOT add a web UI. Just #01.

3. **Production quality from day 1**. Even though this is MVP, the code style must be clean. Use strict TypeScript. No `any`. No silent catches.

4. **Performance targets**:
   - Single file check: < 3 seconds including network calls
   - Batch check 100 files: < 30 seconds (parallel registry queries)

5. **Fail visibly**. If the registry is down, say so. Don't silently pass with no detections.

6. **Leave TODO comments for future extensions** where `ARCHITECTURE.md` says "extension point here". Don't implement them, just mark them.

---

## What You're NOT Building Right Now

- No SaaS backend (that's a separate project)
- No GitHub App (comes in Phase 3 of the roadmap)
- No Auto Fix (comes in Month 6)
- No UI beyond CLI
- No authentication
- No telemetry (NOT YET — we'll add privacy-respecting telemetry later)

---

## When You're Done with Phase 6

Report back with:
1. Output of `npm test` (all green)
2. Output of `npx trace-check test-input.py`
3. The file tree (`tree -I node_modules`)
4. Any architectural decisions you made that weren't explicitly in the spec

Then we plan Phase 7: README polish, GitHub Actions CI, and the first detector for JavaScript ecosystem.

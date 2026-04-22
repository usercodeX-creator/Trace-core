
# trace-core

### AI can write. Trace can read.

**Open-source security checker for AI-generated code.**
Catches what Snyk, Semgrep, and SonarQube miss — because they target human bugs, not LLM bugs.

[![npm version](https://img.shields.io/npm/v/trace-core.svg?color=c8533f)](https://www.npmjs.com/package/trace-core)
[![license](https://img.shields.io/badge/license-MIT-c8533f.svg)](./LICENSE)
[![Tests](https://github.com/usercodeX-creator/Trace-core/actions/workflows/test.yml/badge.svg)](https://github.com/usercodeX-creator/Trace-core/actions/workflows/test.yml)

---

## The problem

In 2026, nearly half of all code shipped to production is written by AI assistants — Cursor, Claude Code, Copilot, Lovable, Replit Agent. The speed is real. The risks are equally real.

- **Moltbook (Feb 2026)**: Wiz exposed 1.5M API keys and 35K emails — founder wrote zero lines of code, deployed AI output as-is.
- **Axios (Mar 2026)**: Maintainer account hijacked, malware slipped into the official package, thousands of downstream apps affected in hours.
- **Georgia Tech Vibe Security Radar**: CVEs attributed to AI coding tools went from 6 in January to 35 in March 2026. Real number estimated 5–10× higher.

Veracode reports **45% of AI-generated code contains security flaws**. Cloud Security Alliance puts it at **62%**. SonarSource says **42% of committed code is now AI-written or AI-assisted**.

Existing security tools don't catch these defects. They were built for human bugs — SQL injection, buffer overflows, known CVEs. AI makes different mistakes, in different places, for different reasons.

**trace-core is built from day one for the failure modes of LLMs.**

---

## What it detects

trace-core ships **all 19** detection patterns across **6 languages** — fully open source, no paid tier required.

### Python / JavaScript / TypeScript (7 patterns)

| # | Pattern | Status | What it catches |
|---|---|---|---|
| 01 | **Hallucinated dependencies** | ✅ v0.1.0 | Imports of packages that don't exist on npm or PyPI — the "slopsquatting" attack vector |
| 02 | **Deprecated API misuse** | ✅ v0.5.0 | Using removed or deprecated library functions the model confidently misremembered |
| 03 | **Credential leaks** | ✅ v0.2.0 | Hardcoded API keys, tokens, and secrets that AI eagerly writes in plain text |
| 04 | **Fake type safety** | ✅ v0.5.0 | `any` abuse, `@ts-ignore`/`@ts-nocheck`, type assertions that defeat the type system |
| 05 | **Silent exception handling** | ✅ v0.3.0 | `except: pass`, swallowed errors, catch blocks with empty bodies |
| 06 | **Broken sanitization** | ✅ v0.4.0 | Unsafe user input reaching sinks through SQL, shell, HTML |
| 07 | **Tautological tests** | ✅ v0.5.0 | `expect(x).toBe(x)` — AI writes tests that can never fail |

### Go (4 patterns — new in v0.6.0)

| # | Pattern | What it catches |
|---|---|---|
| 08 | **Slopsquatting** | Suspicious import paths that may be AI-hallucinated packages |
| 09 | **Error ignored** | Error return values explicitly discarded with `_` |
| 10 | **Sprintf SQL** | SQL queries built with `fmt.Sprintf` or string concatenation |
| 11 | **Hardcoded secret** | API keys, tokens, and credentials in Go source |

### Rust (4 patterns — new in v0.6.0)

| # | Pattern | What it catches |
|---|---|---|
| 12 | **Unwrap abuse** | Excessive `.unwrap()` usage that can panic at runtime |
| 13 | **Unsafe block** | `unsafe` blocks and functions that bypass safety guarantees |
| 14 | **Todo macro** | `todo!()` / `unimplemented!()` placeholders that panic at runtime |
| 15 | **Panic macro** | `panic!()` calls where `Result<T, E>` should be used |

### Ruby (4 patterns — new in v0.6.0)

| # | Pattern | What it catches |
|---|---|---|
| 16 | **Mass assignment** | ActiveRecord mass assignment without strong parameters |
| 17 | **SQL interpolation** | String interpolation inside SQL queries |
| 18 | **Silent rescue** | `rescue` blocks that silently swallow exceptions |
| 19 | **Eval injection** | `eval` / `send` called with dynamic input |

---

## Demo

```bash
$ cat test.py
import numpy
import pandas as pd
import fake_library_that_does_not_exist_9999
from totally_real_package_xyz import something

$ npx trace-check test.py

trace-check v0.6.0

test.py
  ✗ critical  line 3    Package "fake_library_that_does_not_exist_9999" not found on PyPI
               >  import fake_library_that_does_not_exist_9999
  ✗ critical  line 4    Package "totally_real_package_xyz" not found on PyPI
               >  from totally_real_package_xyz import something

Summary: 2 issues found across 1 file.
```

Works on `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.go`, `.rs`, `.rb`. Exits with code `1` when issues are found — drop it straight into CI.

---

## Quick start

```bash
# One-off check
npx trace-check your-file.py

# Install locally
npm install -D trace-core

# In package.json scripts
"check": "trace-check src/**/*.ts"

# JSON output for tooling
npx trace-check --json src/index.ts
```

### As a git pre-commit hook

```bash
# .git/hooks/pre-commit
#!/bin/sh
npx trace-check $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(py|js|ts|jsx|tsx|go|rs|rb)$')
```

Block commits with hallucinated imports before they ever reach the repo.

---

## How it works

trace-core does three things, well:

1. **Parse.** Language-aware import extraction — Python `import`/`from`, JavaScript `import`/`require`, including scoped packages and `node:` prefixes.
2. **Filter.** Standard library modules and relative imports are excluded. No false positives for `import os` or `import "./local"`.
3. **Verify.** Each external package is checked against its registry — PyPI for Python, npm for JS/TS — in parallel, with response caching.

If a package doesn't exist in the registry, it's flagged as **critical**. Either it's a typo, a hallucination, or — worst case — a real attacker has registered a typo-squatted package that will soon be a supply chain attack.

No AST. No tree-sitter. No heavyweight analyzer. Small, readable TypeScript — designed to stay that way.

---

## Architecture

trace-core is built from day one to accept five extensions without a rewrite:

```
Phase 1 (now)   → Core detection (19 patterns, 6 languages)
Phase 2         → Pre-commit Gate (commit blocking)
Phase 3         → Auto Fix (AI-generated fix PRs)
Phase 4         → Supply Chain Scanner (dependency diff monitoring)
Phase 5         → Organization Analytics (aggregated dashboards)
Phase 6         → Compliance Kit (audit logs, regulatory reports)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design principles — pluggable detectors, forward-compatible schemas, external-ready APIs, identity separation, fail-loudly.

---

## Paid tier

trace-core is MIT. Free forever. But it ships 4 of 7 detection patterns.

The full 7, plus Auto Fix, Supply Chain scanning, organization analytics, and compliance reporting, live in **Trace Cloud** — a hosted SaaS product. Pricing and waitlist: *(coming soon — LP in the next days)*.

The OSS / paid split:

| Feature | trace-core (OSS) | Trace Cloud |
|---|---|---|
| Patterns #01, #03, #05, #06 | ✅ | ✅ |
| Patterns #02, #04, #07 | — | ✅ |
| Pre-commit Gate | ✅ | ✅ + org policies |
| Auto Fix (AI fix PRs) | — | ✅ |
| Supply Chain Scanner | — | ✅ |
| Analytics Dashboard | — | ✅ |
| Compliance Kit | — | ✅ |
| Interface | CLI, GitHub Action | + Web, Slack, API |

---

## Contributing

This project is deliberately small. Contributions welcome in these areas:

- **More languages.** Java, PHP, Dart parsers.
- **Additional stdlib lists.** The Python stdlib filter is a pragmatic subset — PRs welcome for exhaustiveness.
- **Test cases.** Edge cases for import parsing that aren't covered yet.
- **Documentation.** Examples, blog posts, tutorials.

What's **not** welcome (for now): new detection patterns. Those land in the paid tier first, OSS later. This is how the project stays funded and sustainable.

See [CONTRIBUTING.md](./CONTRIBUTING.md) *(coming soon)*.

---

## License

MIT © 2026 Trace. See [LICENSE](./LICENSE).

---

<div align="center">

**Made with discipline, not hype.**

[Website](https://tracecheck.dev) · [GitHub](https://github.com/usercodeX-creator/Trace-core) · [Contact](mailto:hi@tracecheck.dev)

</div>

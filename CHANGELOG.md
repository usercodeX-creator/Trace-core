# Changelog

All notable changes to trace-core will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-04-21

### Added
- Detector: `deprecated-api` (medium) — catches misuse of non-existent or deprecated stdlib/framework APIs in Python and JS/TS (e.g., `os.exists`, `.has_key`, `.contains()`, `escape()`)
- Detector: `fake-type-safety` (medium/high) — catches `: any`, `as any`, `@ts-ignore`/`@ts-nocheck`/`@ts-expect-error` without explanation, and Python `# type: ignore` / `Any` equivalents
- Detector: `tautological-test` (high) — catches tautological assertions (`expect(true).toBe(true)`, `assert True`), skipped tests without reason (`it.skip`, `xit`, `@pytest.mark.skip()`)

### Detectors
trace-core now ships all 7 detection patterns previously listed as roadmap. No more "Cloud — coming soon" — everything is open source.

## [0.4.0] - 2026-04-18

### Added
- Detector 06: Unsafe sanitization — detects untrusted input reaching dangerous sinks (SQL injection, XSS, command injection, path traversal, deserialization RCE)
- Taint source table (`src/lib/taint-sources.ts`) covering Python (Flask, Django, CLI, deserialization) and JavaScript/TypeScript (Express, browser APIs, Node.js)
- Dangerous sink table (`src/lib/dangerous-sinks.ts`) with severity tiers, interpolation detection, and "always dangerous" classification
- Source + sink co-presence heuristic with false positive filtering: test paths, parameterized queries, sanitizer detection, hardcoded string sinks
- 21 new tests for unsafe-sanitization detector
- Example files `examples/unsafe-sinks.py` and `examples/unsafe-sinks.js`

## [0.3.0] - 2026-04-18

### Added
- Detector 05: Silent exception handling — detects empty `except: pass`, empty `catch {}`, `.catch(() => {})`, and log-only handlers in Python and JavaScript/TypeScript
- Shared exception-pattern parser (`src/parsers/exception-patterns.ts`) for try/catch scanning
- False positive filtering: test paths, intent comments, re-raise detection, substantive body detection
- 20 new tests for silent-exception detector
- Example files `examples/silent-exceptions.py` and `examples/silent-exceptions.js`

## [0.2.0] - 2026-04-18

### Added
- Detector 03: Credential leak detection — detects hardcoded API keys, tokens, passwords, and connection strings
- Shannon entropy helper (`src/lib/entropy.ts`) for generic high-entropy string detection
- Vendor-specific pattern table (`src/lib/secret-patterns.ts`) covering AWS, Stripe, GitHub, OpenAI, Anthropic, Google, Slack, JWT, PEM keys, and database connection strings
- Automatic secret redaction in all output — secrets are never logged in full
- Context-aware false positive filtering: test paths, placeholders, schema definitions
- 19 new tests for credential-leak detector
- Example file `examples/leaky-secrets.js`

## [0.1.0] - 2026-04-18

### Added
- Detector 01: Hallucinated dependencies — detects imports of packages not found on npm or PyPI
- CLI `trace-check` with human and JSON output formats
- Python import parser (regex-based, stdlib filtered)
- JavaScript / TypeScript import parser (handles scoped packages, `node:` prefix, relative imports)
- PyPI and npm registry clients with in-memory caching
- 14 unit tests across parsers and detectors
- Plugin-based detector architecture designed for future extensions

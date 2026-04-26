<h1 align="center">TraceCheck</h1>

<p align="center">
  <strong>AI can write. Trace can read.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/trace-core"><img alt="npm" src="https://img.shields.io/npm/v/trace-core?color=e5252a&label=npm"></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <a href="https://github.com/usercodeX-creator/Trace-core/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/usercodeX-creator/Trace-core?color=e5252a"></a>
  <img alt="tests" src="https://img.shields.io/badge/tests-294%2F294-brightgreen">
  <img alt="detectors" src="https://img.shields.io/badge/detectors-24-informational">
  <img alt="languages" src="https://img.shields.io/badge/languages-Python%20%7C%20JS%20%7C%20TS%20%7C%20Go%20%7C%20Rust%20%7C%20Ruby-informational">
</p>

---

TraceCheck is an open-source static analyzer for AI-generated code. It detects the 24 failure patterns that only LLMs produce — hallucinated imports, credentials baked into source, exceptions silently swallowed, tests that assert nothing, types that are lies. Snyk, Semgrep, and SonarQube don't catch these, because they were built to catch human bugs. AI writes differently. Trace reads differently.

```bash
npx trace-core your-file.py
```

No install. No signup. MIT licensed. Six languages.

## What TraceCheck detects

24 patterns across 6 languages. Grouped by the shape of the failure, not the language.

**Supply chain (2)**
- `hallucinated-deps` — imports a package that does not exist on npm/PyPI (or that an attacker has already claimed — see *slopsquatting*)
- `go/slopsquatting` — Go module path mimicking a legitimate one

**Secrets (3)**
- `credential-leak` — API key, token, or password hard-coded in source
- `go/hardcoded-secret` — same, for Go binaries (where `strings <binary>` exposes them)
- `hardcoded-localhost` — `http://localhost:3000` that survives into production

**Silent failures (4)**
- `silent-exception` — `except: pass`, `catch {}`, and similar handlers that swallow errors
- `ruby/silent-rescue` — the Ruby variant
- `go/error-ignored` — Go's `_` used to discard an `error` return value
- `missing-await` — `async` function called without `await`; work appears done, isn't

**Injection (5)**
- `dynamic-eval` — `eval()` / `exec()` executing runtime-constructed strings
- `ruby/eval-injection` — Ruby's `eval` / `send` / `constantize` reached by user input
- `go/sprintf-sql` — SQL built with `fmt.Sprintf` and user data
- `ruby/string-interpolation-sql` — SQL built with Ruby string interpolation
- `unsafe-sanitize` — hand-rolled input sanitization (always has holes)

**Mass assignment / authorization (1)**
- `ruby/mass-assignment` — Rails controller passing `params` straight into model, bypassing strong params

**Fake type safety (1)**
- `fake-type-safety` — `as any`, `as unknown as Foo`, `@ts-ignore` — types that lie

**Fake tests (1)**
- `tautological-test` — tests shaped like `expect(true).toBe(true)`, skipped tests, assertions that cannot fail

**Rust correctness (4)**
- `rust/unwrap-abuse` — `.unwrap()` / `.expect()` on input-dependent values
- `rust/panic-macro` — `panic!` in library code instead of `Result<T, E>`
- `rust/todo-macro` — `todo!()` / `unimplemented!()` left in shipped code
- `rust/unsafe-block` — `unsafe { ... }` where a safe API would work

**Crypto & config (3)**
- `insecure-rng` — `Math.random()` / `random.random()` used for tokens
- `env-no-fallback` — `process.env.X` with no validation; `undefined` silently propagates
- `deprecated-api` — APIs scheduled for removal; LLM's training data didn't know they were deprecated

Every detection comes with a bilingual remediation card in the [Playground](https://tracecheck.dev/playground) explaining *why* it's a problem and *how* to fix it.

## Why this exists

Think about the shape of AI-generated code.

When a human writes `except: pass`, it's usually laziness, caught in review. When an LLM writes `except: pass`, it's the model's default answer to "handle the error." It ships in production because the human reviewing it saw the word `except` and assumed something happened.

When a human types `import super-helper-validator`, it's a typo, caught by npm. When an LLM types `import super-helper-validator`, it's a hallucination — and attackers have already started claiming those hallucinated names on npm and PyPI. The supply chain attack has a name now: *slopsquatting*.

When a human writes `expect(true).toBe(true)`, they know it's a placeholder. When an LLM writes it, it's because you asked for a test and the model produced something test-shaped. The CI goes green. Coverage hits 100%. Production breaks anyway.

These aren't bugs in the conventional sense. They are the predictable output of models trained on tutorial code, optimized for plausibility, shipped at scale. The tooling built for human bugs misses them because it wasn't built for this distribution of failure.

TraceCheck was built for this distribution.

## Quick start

```bash
# Scan one file
npx trace-core your-file.py

# Scan a directory
npx trace-core src/

# JSON output for piping into other tools
npx trace-core src/ --format json
```

Exit code is `0` if nothing is found, `1` if detections exist. That's your CI signal.

## Supported languages

Python, JavaScript, TypeScript, Go, Rust, Ruby.

Detection granularity varies by language. Python, JS, and TS have the deepest coverage because that's where most AI-generated code lives today. Go, Rust, and Ruby have focused detectors for their highest-signal failure modes.

## How it compares

| | TraceCheck | Snyk | Semgrep | SonarQube | Claude /ultrareview |
|---|---|---|---|---|---|
| Targets AI-specific failures | ✓ | ✗ | ✗ | ✗ | partial |
| LLM-neutral (no vendor lock) | ✓ | ✓ | ✓ | ✓ | ✗ |
| Static analysis ($0 per scan) | ✓ | freemium | freemium | freemium | $$ per scan |
| OSS | ✓ | ✗ | partial | ✗ | ✗ |
| Detects hallucinated imports | ✓ | ✗ | ✗ | ✗ | partial |
| Detects tautological tests | ✓ | ✗ | ✗ | ✗ | partial |
| No install required | ✓ | ✗ | ✗ | ✗ | bound to Claude Code |
| Runs on any LLM's output | ✓ | n/a | n/a | n/a | Claude-only |

TraceCheck is not a replacement for Snyk or Semgrep. It's the layer above them. Run Snyk for CVE scanning. Run Semgrep for your team's custom patterns. Run TraceCheck for the failures your LLM puts in between.

## Install

```bash
# One-shot (recommended — nothing to install, always current)
npx trace-core src/

# Project-local
npm install --save-dev trace-core

# Global
npm install -g trace-core
```

## CI integration

### GitHub Actions

One line. Posts a PR comment with grade and detections, uploads SARIF
to the **Security → Code scanning** tab, and runs in under 30 seconds
on a clean cache.

```yaml
# .github/workflows/trace.yml
name: Trace
on: [push, pull_request]

permissions:
  contents: read
  security-events: write
  pull-requests: write

jobs:
  trace:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: usercodeX-creator/trace-action@v1
        with:
          path: src/
```

[Trace Check on the GitHub Marketplace](https://github.com/marketplace/actions/trace-check) · [trace-action repo](https://github.com/usercodeX-creator/trace-action)

### Other CIs (GitLab, Bitbucket, CircleCI, Jenkins, ...)

```yaml
- run: npx trace-core src/
```

TraceCheck writes to stdout, exits non-zero on detections, and accepts
`--json` for machine-readable output. That's all a CI needs.

## Try it in the browser

[tracecheck.dev/playground](https://tracecheck.dev/playground) — paste code, hit check, see detections with remediation. No install, no signup, no account.

## Philosophy

**AI-specific, not general-purpose.** TraceCheck does not try to replace Snyk or Semgrep. It focuses, narrowly, on the failure modes that appear when code is generated by a model. Every detector exists because the team observed an AI producing that pattern, in production code, at scale.

**Neutral third party.** TraceCheck is not built by Anthropic, OpenAI, or any LLM vendor. It runs on the output of all of them. An AI company has a structural conflict of interest in publishing a defect catalog of its own model. A neutral tool does not.

**OSS, and staying that way.** The 24 detectors are MIT. No usage limits. No telemetry without explicit consent. No `enterprise` tier gating the core. Everything needed to detect these failures is in this repo, today, free.

## Roadmap

The public roadmap is the changelog plus what's in GitHub Issues. Short version:

- **v0.8**: detector tuning from aggregated opt-in data (first *Trace Index* monthly report ships alongside)
- **v0.9**: configuration file for per-project severity overrides and suppressions
- **v1.0**: stability pledge — detectors frozen in meaning for one major version

No ETA promises. Shipping happens when it ships.

## Trace Index

Trace publishes a monthly report: the aggregate shape of AI-generated code failures, broken down by language, model, and detector. Built from opt-in telemetry. First issue: May 2026.

See [tracecheck.dev/insights](https://tracecheck.dev/insights) (coming soon).

## Contributing

Issues and PRs welcome. For new detector proposals, include:

- A real example of the failure (not a hypothetical)
- The LLM that produced it (Claude / GPT / Cursor / etc. — or "unknown, scraped from Stack Overflow AI answers")
- Why existing tooling misses it

The bar for a new detector is: *"a human would not write this; only an AI would."* If a human writes it too, it belongs in Snyk or Semgrep, not TraceCheck.

## License

[MIT](./LICENSE).

## Links

- **Website**: [tracecheck.dev](https://tracecheck.dev)
- **Playground**: [tracecheck.dev/playground](https://tracecheck.dev/playground)
- **Japanese README**: [docs/README-ja.md](./docs/README-ja.md)
- **npm**: [trace-core](https://www.npmjs.com/package/trace-core)
- **Author**: [@usercodeX-creator](https://github.com/usercodeX-creator) · Tokyo, Japan

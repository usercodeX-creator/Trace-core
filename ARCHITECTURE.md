# ARCHITECTURE — Trace Core

> **Principle**: Implement one thing. Design for five.

This document governs every code decision. If code violates these principles, it must be rewritten. The short-term cost of violation is low. The long-term cost is a ground-up rewrite at Month 12. That's unacceptable.

---

## The Five-Extension Roadmap

The architecture must accommodate these five extensions WITHOUT rewriting core interfaces:

| Phase | Extension | Timeline | What it adds |
|-------|-----------|----------|--------------|
| 1 | Core detection (NOW) | M0-M3 | 7 detection patterns |
| 2 | Pre-commit Gate | M3-M5 | Git hook integration, CLI blocks |
| 3 | Auto Fix | M5-M9 | Claude generates fix PRs |
| 4 | Supply Chain Scanner | M9-M12 | Dependency diff monitoring |
| 5 | Organization Analytics | M12-M18 | Dashboard aggregating detection data |
| 6 | Compliance Kit | M18-M24 | Audit logs, regulatory reports |

Every file you write now must not need changes when these arrive.

---

## Design Principles

### Principle 1 — Pluggable Detectors

Detectors live in `src/detectors/`. Each is a standalone module implementing the `Detector` interface. Adding a new detector means adding a file, not modifying existing ones.

**Forbidden**:
- `if (detectorId === "xyz") { ... }` anywhere outside the detector's own file
- Shared mutable state between detectors
- Detectors importing from each other

**Required**:
- Every detector exports a single `Detector` object
- The engine (`src/engine.ts`) discovers detectors via a registry array
- Tests for each detector are self-contained

**Extension point**: When Pattern #02-#07 arrive, you drop 6 new files in `src/detectors/` and add them to the registry. Zero changes to existing files.

### Principle 2 — Forward-Compatible Data Schema

Every `Detection` object carries fields that today are `null` but tomorrow will be populated:

```typescript
interface Detection {
  // Today's fields
  detector: DetectorId;
  severity: Severity;
  file: string;
  line: number;
  message: string;
  
  // Extension points — reserve now, populate later
  suggestedFix?: string | null;        // Auto Fix (Phase 3) will fill this
  dependencyContext?: object | null;   // Supply Chain (Phase 4) will fill this
  auditTrail?: object | null;          // Compliance (Phase 6) will fill this
}
```

**Rule**: Never remove a field. Add new ones. Default to `null` or `undefined`.

When `Trace Cloud` SaaS ingests detections from `trace-core`, these nullable fields let it enrich historical data retroactively. Without this, we'd need a schema migration at Month 6. With this, no migration, ever.

### Principle 3 — External-Ready APIs

Every module that the CLI calls today must be callable from an HTTP API tomorrow.

**Forbidden**:
- Reading from `process.argv` outside `cli.ts`
- Writing to `process.stdout` outside `cli.ts`
- Relying on environment variables inside detector logic

**Required**:
- Pure functions: inputs as arguments, outputs as return values
- Errors as thrown exceptions, not console.error + exit
- All detector logic works identically whether called by CLI, HTTP handler, or GitHub Action

**Extension point**: When `Trace Cloud` SaaS wraps this in an API server, the work is just adding a thin HTTP layer. No core rewrites.

### Principle 4 — Separation of Input and Identity

From day 1, detectors operate on anonymized code. No personal data, no customer identifiers touch the detection logic.

**Structure**:
```
┌─────────────────┐
│  Input Layer    │  ← file paths, user IDs, org IDs
│                 │    ANONYMIZATION HAPPENS HERE
├─────────────────┤
│  Detection Core │  ← only sees anonymized code + language
├─────────────────┤
│  Output Layer   │  ← re-attaches identity for reporting
└─────────────────┘
```

For v0.1 (OSS CLI, single user), this split is formal but thin. For future phases:
- **Phase 4 Supply Chain**: anonymized dep graphs feed the fleet-wide learning
- **Phase 5 Analytics**: aggregated detection stats without PII
- **Phase 6 Compliance**: audit trails separately from detection data

**Extension point**: The `DetectorContext` type today has `filePath` and `content`. When Analytics arrives, we add an `orgId` at the input layer, never inside the detector.

### Principle 5 — Fail Loudly, Never Silently

LLM-adjacent systems tend to silently return "looks fine" when they shouldn't. Trace must do the opposite.

**Required**:
- Network failures → throw with context
- Parse failures → log a warning, continue, but NEVER return empty detections as if the file was clean
- Ambiguous cases → flag with `low` severity, let the user decide

**Forbidden**:
- `try { ... } catch { return []; }` anywhere
- Silent fallbacks that hide registry outages
- Any code path that outputs "no issues" when it didn't actually run

---

## Directory Structure

This structure is part of the architecture. Do not deviate.

```
trace-core/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
├── .gitignore
├── ARCHITECTURE.md          (this file)
├── SPEC.md
├── INITIAL_PROMPT.md
│
├── src/
│   ├── cli.ts               Entry point. THIN. Delegates to core.
│   ├── engine.ts            Detector registry + runner
│   ├── types.ts             Shared types. The schema contract.
│   │
│   ├── detectors/           One file per detector. Pluggable.
│   │   ├── index.ts         Exports array of all detectors
│   │   └── hallucinated-deps.ts
│   │   # Future: deprecated-api.ts, credential-leak.ts, etc.
│   │
│   ├── parsers/             Language-specific import extraction
│   │   ├── python.ts
│   │   └── javascript.ts
│   │   # Future: go.ts, rust.ts, java.ts
│   │
│   ├── registries/          External registry clients
│   │   ├── pypi.ts
│   │   └── npm.ts
│   │   # Future: crates.io, maven, etc.
│   │
│   ├── output/              Formatters for different consumers
│   │   ├── human.ts         Terminal output with color
│   │   └── json.ts          Machine-readable
│   │   # Future: sarif.ts (GitHub security), github-comment.ts
│   │
│   └── lib/                 Shared utilities
│       ├── anonymizer.ts    Strips identity from contexts
│       └── cache.ts         In-memory cache for registry queries
│
├── tests/                   Mirror of src/ structure
│   ├── detectors/
│   ├── parsers/
│   └── registries/
│
└── dist/                    (gitignored, build output)
```

---

## What These Principles Cost You Today

Being honest about the overhead:

- `Detection.suggestedFix` is always `null` in v0.1 — you type it anyway
- `anonymizer.ts` is a stub function `(x) => x` in v0.1 — you create the file anyway
- Every detector goes through the registry pattern — even though there's only one detector
- JSON output is built alongside human output — even though most users will only see human

**This is the cost of buying optionality.** It's 10% more code today for 90% less rework at Month 6.

## What These Principles Save You at Month 6

When we add Auto Fix:
- No schema changes (Detection.suggestedFix already exists)
- No engine changes (just a new Detector that populates the field)
- No CLI changes (--auto-fix flag uses existing JSON output)

When we add Analytics:
- No detector changes (they already emit clean data)
- No privacy work (anonymizer already isolates identity)

When we get acquired by Snyk:
- Their engineers can onboard in days, not months
- They don't discover "the Auto Fix module reaches into the parser's private state"
- The codebase matches a senior engineer's expectations of a production system

---

## Reviewer's Checklist

Before any PR merges, verify:

- [ ] Does this change work for the 5 future extensions?
- [ ] Does this add a field to `Detection`? If removing, reject.
- [ ] Does this violate Principle 3 (external-ready)? If yes, refactor.
- [ ] Are there silent catches or empty returns? Reject.
- [ ] Would a Snyk engineer pick this up and understand it in 1 hour?

If you can't answer yes to all of these, the PR is not ready.

---

## Amendment Process

This architecture is NOT infallible. If you find a principle is wrong, propose an amendment in a PR that modifies this file. The PR must include:

1. The principle being amended
2. The specific failure case that proves it's wrong
3. The proposed replacement
4. A migration plan for existing code

Do NOT silently violate a principle and write code that breaks it. Either the principle wins, or the principle changes. No middle ground.

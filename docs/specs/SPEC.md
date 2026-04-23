# SPEC — Trace Core v0.1.0 Implementation Specification

This document defines exactly what to build. If a question arises not covered here, stop and ask.

---

## Package Manifest

Create `package.json` with this content:

```json
{
  "name": "trace-core",
  "version": "0.1.0",
  "description": "AI can write. Trace can read. Open source security checker for AI-generated code.",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "trace-check": "./dist/cli.js"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "keywords": ["ai", "security", "vibe-coding", "code-review", "llm", "hallucination", "slopsquatting"],
  "author": "Trace",
  "license": "MIT",
  "engines": { "node": ">=18.0.0" },
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  }
}
```

## TypeScript Config

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## Core Types

Create `src/types.ts`:

```typescript
export type Language = "python" | "javascript" | "typescript";

export type Severity = "critical" | "high" | "medium" | "low";

export type DetectorId = "hallucinated-deps" | "deprecated-api" | "credential-leak" |
                        "fake-type-safety" | "silent-catch" | "unsafe-sanitize" | "tautological-test";

export interface Detection {
  detector: DetectorId;
  severity: Severity;
  file: string;
  line: number;
  column?: number;
  message: string;
  rawCode?: string;
  // Extension points (ARCHITECTURE.md #2 — nullable for forward compatibility)
  suggestedFix?: string | null;
  dependencyContext?: Record<string, unknown> | null;
  auditTrail?: Record<string, unknown> | null;
}

export interface DetectorContext {
  filePath: string;
  content: string;
  language: Language;
}

export interface Detector {
  id: DetectorId;
  name: string;
  description: string;
  run(ctx: DetectorContext): Promise<Detection[]>;
}
```

---

## Detector 01: Hallucinated Dependencies

### Purpose
Detect `import` / `require` statements that reference packages not available on npm (for JS/TS) or PyPI (for Python).

### Algorithm

1. **Extract imports** from source using language-specific parser
2. **Normalize package names** (e.g. `from foo.bar import x` → `foo`; `import { X } from "foo/sub"` → `foo`)
3. **Skip relative imports** (starts with `.` or `..` or `/`)
4. **Skip built-in modules** (Python stdlib, Node.js builtin)
5. **Query registry** for each unique package name (parallel, with timeout)
6. **Report** packages that return 404 or equivalent

### Python Parser (`src/parsers/python.ts`)

Handle these import forms:

```python
import foo                       # → foo
import foo.bar                   # → foo
import foo as f                  # → foo
from foo import bar              # → foo
from foo.bar import baz          # → foo
from . import x                  # → SKIP (relative)
from .foo import x               # → SKIP (relative)
```

Use regex-based parsing for v0.1. AST parsing is Phase 7.

Skip these Python stdlib modules (hardcode the list):
`os, sys, re, json, math, time, datetime, collections, itertools, functools, typing, pathlib, subprocess, threading, asyncio, logging, argparse, unittest, pytest, io, csv, random, hashlib, uuid, warnings, abc, copy, enum`

(This is a pragmatic subset. Full stdlib check comes in Phase 7.)

### JavaScript/TypeScript Parser (`src/parsers/javascript.ts`)

Handle these forms:

```typescript
import foo from "bar"                    // → bar
import { x } from "bar"                  // → bar
import { x } from "bar/sub"              // → bar
import * as foo from "bar"               // → bar
import "bar"                             // → bar
const foo = require("bar")               // → bar
const { x } = require("bar/sub")         // → bar
import type { X } from "bar"             // → bar

import x from "./local"                  // → SKIP
import x from "../up"                    // → SKIP
import x from "/absolute"                // → SKIP
```

Scoped packages: `@scope/name/sub` → `@scope/name`

Skip Node.js built-ins:
`fs, path, http, https, url, crypto, os, util, stream, buffer, events, child_process, net, tls, dns, zlib, querystring, readline, assert, process, module, console`

Also skip if prefixed with `node:` (already explicitly a builtin).

### Registry Clients

**`src/registries/pypi.ts`**
```typescript
export async function exists(packageName: string): Promise<boolean>
```
- Endpoint: `https://pypi.org/pypi/{name}/json`
- 200 → exists (true)
- 404 → does not exist (false)
- Other errors → throw (caller decides)
- Timeout: 5 seconds per request
- Cache results in-memory for the session (don't hit the registry twice for same package)

**`src/registries/npm.ts`**
```typescript
export async function exists(packageName: string): Promise<boolean>
```
- Endpoint: `https://registry.npmjs.org/{name}` (URL-encode scoped packages)
- Same semantics as PyPI client
- Cache in-memory

### Detector Implementation (`src/detectors/hallucinated-deps.ts`)

```typescript
import type { Detector, DetectorContext, Detection } from "../types.js";

export const hallucinatedDeps: Detector = {
  id: "hallucinated-deps",
  name: "Hallucinated Dependencies",
  description: "Detects imports of packages that do not exist in the registry.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    // 1. Extract imports based on language
    // 2. Filter out stdlib and relative imports
    // 3. Query registry in parallel
    // 4. Build Detection[] for non-existent packages
  }
};
```

Severity rules:
- Package doesn't exist → `critical` (this is a live vulnerability / broken code)

---

## CLI (`src/cli.ts`)

```
Usage: trace-check [options] <file...>

Options:
  -V, --version          output version
  -h, --help             display help
  --json                 output as JSON
  --fail-on <severity>   exit 1 if any detection >= severity (default: "low")

Examples:
  trace-check app.py
  trace-check src/*.ts
  trace-check --json src/index.ts
```

Output format (human-readable, default):

```
trace-check v0.1.0

app.py
  ✗ critical  line 3    Package "fake_library_that_does_not_exist" not found on PyPI
               >  import fake_library_that_does_not_exist

  ✗ critical  line 5    Package "nonexistent-pkg" not found on PyPI
               >  from nonexistent-pkg import foo

Summary: 2 issues found across 1 file.
```

Colors: red for `critical`, yellow for `high`/`medium`, gray for code snippets.

Exit codes:
- `0`: no detections
- `1`: detections found at or above `--fail-on` threshold
- `2`: error (registry unreachable, file not found, etc.)

---

## Tests

Create these test files. Use Vitest with mocked HTTP.

### `tests/parsers/python.test.ts`
- Test 1: `import numpy` → returns `["numpy"]`
- Test 2: `from foo.bar import x\nimport baz as b` → returns `["foo", "baz"]`
- Test 3: `from . import local\nfrom .sibling import x` → returns `[]`
- Test 4: `import os\nimport json` → returns `[]` (stdlib filtered)
- Test 5: Empty file → returns `[]`

### `tests/parsers/javascript.test.ts`
- Test 1: `import foo from "bar"` → returns `["bar"]`
- Test 2: `import { x } from "@scope/pkg/sub"` → returns `["@scope/pkg"]`
- Test 3: `import fs from "fs"` → returns `[]` (builtin)
- Test 4: `import fs from "node:fs"` → returns `[]` (node: prefix)
- Test 5: `const x = require("./local")` → returns `[]` (relative)

### `tests/detectors/hallucinated-deps.test.ts`
Mock `pypi.exists` and `npm.exists` to return predefined maps.
- Test 1: All packages exist → 0 detections
- Test 2: One package missing → 1 detection, correct line number
- Test 3: Multiple packages missing → N detections
- Test 4: Registry timeout → throws clearly

---

## Acceptance Criteria

Phase 5 verification runs this script:

```bash
cat > test-input.py <<'EOF'
import numpy
import pandas as pd
import fake_library_that_does_not_exist_9999
from totally_real_package_xyz import something
import os
EOF

npx trace-check test-input.py
```

Expected output:
- Exit code 1
- 2 detections: `fake_library_that_does_not_exist_9999` and `totally_real_package_xyz`
- `numpy`, `pandas`, `os` are NOT flagged

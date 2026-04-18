export interface ParsedImport {
  packageName: string;
  line: number;
  rawCode: string;
}

const PYTHON_STDLIB = new Set([
  "os", "sys", "re", "json", "math", "time", "datetime", "collections",
  "itertools", "functools", "typing", "pathlib", "subprocess", "threading",
  "asyncio", "logging", "argparse", "unittest", "pytest", "io", "csv",
  "random", "hashlib", "uuid", "warnings", "abc", "copy", "enum",
]);

/**
 * Extract top-level package names from Python import statements.
 *
 * Handles:
 *   import foo               → foo
 *   import foo.bar           → foo
 *   import foo as f          → foo
 *   from foo import bar      → foo
 *   from foo.bar import baz  → foo
 *
 * Skips:
 *   from . import x          (relative)
 *   from .foo import x       (relative)
 */
export function extractImports(content: string): ParsedImport[] {
  const lines = content.split("\n");
  const results: ParsedImport[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Match "from X import Y"
    const fromMatch = trimmed.match(/^from\s+([\w.]+)\s+import\s/);
    if (fromMatch) {
      const modulePath = fromMatch[1]!;
      // Skip relative imports (starts with .)
      if (modulePath.startsWith(".")) continue;
      const topLevel = modulePath.split(".")[0]!;
      if (!PYTHON_STDLIB.has(topLevel)) {
        results.push({ packageName: topLevel, line: i + 1, rawCode: trimmed });
      }
      continue;
    }

    // Match "import X [as Y]" (possibly multiple comma-separated)
    const importMatch = trimmed.match(/^import\s+(.+)/);
    if (importMatch) {
      const modules = importMatch[1]!.split(",");
      for (const mod of modules) {
        const cleaned = mod.trim().split(/\s+as\s+/)[0]!.trim();
        if (cleaned.startsWith(".")) continue;
        const topLevel = cleaned.split(".")[0]!;
        if (!PYTHON_STDLIB.has(topLevel)) {
          results.push({ packageName: topLevel, line: i + 1, rawCode: trimmed });
        }
      }
    }
  }

  return results;
}

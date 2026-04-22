import { LOCAL_PREFIXES_JS, isLocalImport, SCOPED_PKG_RE } from "../detectors/_shared/local-imports.js";

export interface ParsedImport {
  packageName: string;
  line: number;
  rawCode: string;
}

const NODE_BUILTINS = new Set([
  "fs", "path", "http", "https", "url", "crypto", "os", "util", "stream",
  "buffer", "events", "child_process", "net", "tls", "dns", "zlib",
  "querystring", "readline", "assert", "process", "module", "console",
]);

/**
 * Normalize a module specifier to a top-level package name.
 *
 * Scoped packages: @scope/name/sub → @scope/name
 * Regular packages: name/sub → name
 *
 * Returns null for relative/absolute paths, node: builtins, and
 * framework path aliases (@/, ~/, #/, @@/).
 */
function normalizeSpecifier(specifier: string): string | null {
  // Skip local imports: relative, absolute, path aliases, node: builtins
  if (isLocalImport(specifier, LOCAL_PREFIXES_JS)) return null;

  // Scoped packages: @scope/name[/sub]
  if (specifier.startsWith("@")) {
    // Reject path-alias shaped specifiers (empty or invalid scope)
    if (!SCOPED_PKG_RE.test(specifier)) return null;
    const parts = specifier.split("/");
    if (parts.length < 2) return null;
    const pkg = `${parts[0]}/${parts[1]}`;
    return pkg;
  }

  // Regular packages: name[/sub]
  const topLevel = specifier.split("/")[0]!;

  // Skip Node.js built-ins
  if (NODE_BUILTINS.has(topLevel)) return null;

  return topLevel;
}

/**
 * Extract top-level package names from JS/TS import/require statements.
 *
 * Handles:
 *   import foo from "bar"
 *   import { x } from "bar"
 *   import { x } from "bar/sub"
 *   import * as foo from "bar"
 *   import "bar"
 *   import type { X } from "bar"
 *   const foo = require("bar")
 *   const { x } = require("bar/sub")
 */
export function extractImports(content: string): ParsedImport[] {
  const lines = content.split("\n");
  const results: ParsedImport[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("//")) continue;

    // Match ES import statements: import ... from "specifier" or import "specifier"
    const importMatch = trimmed.match(/^import\s+(?:type\s+)?(?:.*?\s+from\s+)?["']([^"']+)["']/);
    if (importMatch) {
      const specifier = importMatch[1]!;
      const pkg = normalizeSpecifier(specifier);
      if (pkg) {
        results.push({ packageName: pkg, line: i + 1, rawCode: trimmed });
      }
      continue;
    }

    // Match require() calls
    const requireMatch = trimmed.match(/require\(\s*["']([^"']+)["']\s*\)/);
    if (requireMatch) {
      const specifier = requireMatch[1]!;
      const pkg = normalizeSpecifier(specifier);
      if (pkg) {
        results.push({ packageName: pkg, line: i + 1, rawCode: trimmed });
      }
    }
  }

  return results;
}

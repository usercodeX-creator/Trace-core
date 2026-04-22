import type { Detector, DetectorContext, Detection } from "../../types.js";
import { LOCAL_PREFIXES_GO, isLocalImport } from "../_shared/local-imports.js";

/**
 * Go stdlib packages — single-word imports matching these are safe.
 */
const GO_STDLIB = new Set([
  "fmt", "os", "io", "net", "http", "sync", "time", "context", "errors",
  "strings", "strconv", "bytes", "sort", "math", "log", "flag", "testing",
  "encoding", "crypto", "reflect", "regexp", "bufio", "path", "filepath",
  "runtime", "unicode", "archive", "compress", "database", "debug", "embed",
  "go", "hash", "html", "image", "index", "mime", "plugin", "text", "unsafe",
]);

/**
 * Prefixes commonly hallucinated by LLMs when inventing Go packages.
 */
const SUSPICIOUS_PREFIXES = [
  "super-", "easy-", "smart-", "simple-", "better-",
  "ultra-", "magic-", "auto-",
];

/**
 * Well-known module path prefixes that are legitimate.
 */
const TRUSTED_HOSTS = [
  "github.com/",
  "golang.org/",
  "google.golang.org/",
];

/**
 * Extract import paths from Go source.
 * Handles both single-line `import "pkg"` and multi-line `import (...)` blocks.
 */
function extractGoImports(content: string): Array<{ path: string; line: number; rawCode: string }> {
  const imports: Array<{ path: string; line: number; rawCode: string }> = [];
  const lines = content.split("\n");

  // Single-line imports: import "pkg"
  const singleImportRe = /^\s*import\s+"([^"]+)"/;
  // Multi-line import block detection
  const importBlockStartRe = /^\s*import\s*\(/;
  const importBlockEndRe = /^\s*\)/;
  const importPathRe = /^\s*(?:\w+\s+)?"([^"]+)"/;

  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (inBlock) {
      if (importBlockEndRe.test(line)) {
        inBlock = false;
        continue;
      }
      const match = importPathRe.exec(line);
      if (match) {
        imports.push({ path: match[1]!, line: i + 1, rawCode: line.trimEnd() });
      }
      continue;
    }

    if (importBlockStartRe.test(line)) {
      inBlock = true;
      continue;
    }

    const singleMatch = singleImportRe.exec(line);
    if (singleMatch) {
      imports.push({ path: singleMatch[1]!, line: i + 1, rawCode: line.trimEnd() });
    }
  }

  return imports;
}

function isSuspicious(importPath: string): string | null {
  // Skip local/relative imports
  if (isLocalImport(importPath, LOCAL_PREFIXES_GO)) return null;

  // Skip internal/ paths (module-internal, not a package name)
  if (importPath === "internal" || importPath.startsWith("internal/") || importPath.includes("/internal/")) return null;

  // Trusted hosts — always allow
  for (const host of TRUSTED_HOSTS) {
    if (importPath.startsWith(host)) return null;
  }

  // Check for suspicious prefixes in any segment
  const segments = importPath.split("/");
  for (const segment of segments) {
    for (const prefix of SUSPICIOUS_PREFIXES) {
      if (segment.startsWith(prefix)) {
        return `Import path contains suspicious prefix "${prefix}" — possible AI-hallucinated package`;
      }
    }
  }

  // Single-word package not in stdlib
  if (!importPath.includes("/") && !importPath.includes(".")) {
    if (!GO_STDLIB.has(importPath)) {
      return `Single-word import "${importPath}" is not in the Go standard library — possible hallucinated package`;
    }
  }

  return null;
}

export const goSlopsquatting: Detector = {
  id: "go/slopsquatting" as any,
  name: "Go Slopsquatting",
  description: "Detects suspicious Go import paths that may be AI-hallucinated packages.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if ((ctx.language as string) !== "go") return [];

    const imports = extractGoImports(ctx.content);
    const detections: Detection[] = [];

    for (const imp of imports) {
      const reason = isSuspicious(imp.path);
      if (reason) {
        detections.push({
          detector: "go/slopsquatting" as any,
          severity: "critical",
          file: ctx.filePath,
          line: imp.line,
          message: reason,
          rawCode: imp.rawCode,
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    return detections;
  },
};

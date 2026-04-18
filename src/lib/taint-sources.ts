/**
 * Taint source patterns for unsafe-sanitization detection.
 *
 * Each regex identifies a code pattern where untrusted input enters the program.
 * Organized by language (Python, JavaScript/TypeScript).
 *
 * These are used by the co-presence heuristic: if a tainted source appears
 * anywhere in a file alongside a dangerous sink, the sink is flagged.
 */

import type { Language } from "../types.js";

export interface TaintSourceMatch {
  line: number;
  pattern: string;  // human-readable label
}

// ─── Python taint source patterns ──────────────────────────────────

const PYTHON_TAINT_PATTERNS: { regex: RegExp; label: string }[] = [
  // HTTP frameworks — Django
  { regex: /request\.GET\[/, label: "request.GET" },
  { regex: /request\.POST\[/, label: "request.POST" },
  // HTTP frameworks — Flask
  { regex: /request\.args/, label: "request.args" },
  { regex: /request\.form/, label: "request.form" },
  { regex: /request\.json/, label: "request.json" },
  // HTTP frameworks — generic
  { regex: /request\.params/, label: "request.params" },
  { regex: /request\.query/, label: "request.query" },
  { regex: /request\.body/, label: "request.body" },
  // Flask/Django module-level
  { regex: /flask\.request\./, label: "flask.request" },
  { regex: /django\.http\.HttpRequest/, label: "django.http.HttpRequest" },
  // CLI / env
  { regex: /sys\.argv\[/, label: "sys.argv" },
  { regex: /os\.environ\[/, label: "os.environ" },
  { regex: /\binput\s*\(/, label: "input()" },
  { regex: /\braw_input\s*\(/, label: "raw_input()" },
  // Deserialization as taint entry
  { regex: /json\.loads\s*\(.*request/, label: "json.loads(request...)" },
  { regex: /pickle\.loads\s*\(/, label: "pickle.loads()" },
  { regex: /yaml\.load\s*\(/, label: "yaml.load()" },
];

// ─── JavaScript/TypeScript taint source patterns ───────────────────

const JS_TAINT_PATTERNS: { regex: RegExp; label: string }[] = [
  // Express / Node
  { regex: /req\.body/, label: "req.body" },
  { regex: /req\.params/, label: "req.params" },
  { regex: /req\.query/, label: "req.query" },
  { regex: /req\.headers/, label: "req.headers" },
  { regex: /req\.cookies/, label: "req.cookies" },
  // Browser — location
  { regex: /document\.location/, label: "document.location" },
  { regex: /window\.location/, label: "window.location" },
  { regex: /URLSearchParams.*\.get\s*\(/, label: "URLSearchParams.get()" },
  // Browser — storage
  { regex: /localStorage\.getItem\s*\(/, label: "localStorage.getItem()" },
  { regex: /sessionStorage\.getItem\s*\(/, label: "sessionStorage.getItem()" },
  { regex: /document\.cookie/, label: "document.cookie" },
  { regex: /window\.name/, label: "window.name" },
  // Messaging
  { regex: /addEventListener\s*\(\s*["']message["']/, label: "message event listener" },
  { regex: /postMessage\s*\(/, label: "postMessage" },
  // CLI / env
  { regex: /process\.argv\[/, label: "process.argv" },
  { regex: /process\.env\./, label: "process.env" },
];

/**
 * Scan file content for tainted source patterns.
 * Returns all matches with line numbers.
 */
export function findTaintedSources(
  content: string,
  language: Language,
): TaintSourceMatch[] {
  const patterns =
    language === "python" ? PYTHON_TAINT_PATTERNS : JS_TAINT_PATTERNS;
  const lines = content.split("\n");
  const matches: TaintSourceMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const { regex, label } of patterns) {
      if (regex.test(line)) {
        matches.push({ line: i + 1, pattern: label });
        break; // one match per line is enough
      }
    }
  }

  return matches;
}

/**
 * Quick check: does this file contain any tainted source?
 */
export function hasTaintedSource(
  content: string,
  language: Language,
): boolean {
  const patterns =
    language === "python" ? PYTHON_TAINT_PATTERNS : JS_TAINT_PATTERNS;

  for (const { regex } of patterns) {
    if (regex.test(content)) return true;
  }

  return false;
}

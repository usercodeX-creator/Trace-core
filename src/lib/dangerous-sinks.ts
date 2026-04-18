/**
 * Dangerous sink definitions for unsafe-sanitization detection.
 *
 * Each sink has a regex to match the call, a severity when interpolation is
 * detected, a category label, and an "always dangerous" flag for sinks like
 * eval() and pickle.loads() that are dangerous regardless of interpolation.
 */

import type { Language, Severity } from "../types.js";

export interface SinkDefinition {
  regex: RegExp;
  category: string;          // e.g. "SQL injection", "XSS"
  label: string;             // human-readable sink name
  severityInterpolated: Severity;  // severity when interpolation detected
  alwaysDangerous: boolean;  // flag unconditionally (eval, pickle, etc.)
  isAssignment: boolean;     // true for assignment sinks like innerHTML =
}

export interface SinkMatch {
  line: number;
  column: number;
  category: string;
  label: string;
  severity: Severity;
  rawCode: string;
  alwaysDangerous: boolean;
  isAssignment: boolean;
}

// ─── Python sinks ──────────────────────────────────────────────────

const PYTHON_SINKS: SinkDefinition[] = [
  // SQL injection
  { regex: /cursor\.execute\s*\(/, category: "SQL injection", label: "cursor.execute", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  { regex: /conn\.execute\s*\(/, category: "SQL injection", label: "conn.execute", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  { regex: /db\.query\s*\(/, category: "SQL injection", label: "db.query", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  { regex: /session\.execute\s*\(\s*text\s*\(/, category: "SQL injection", label: "session.execute(text(...))", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  // Arbitrary code execution
  { regex: /\beval\s*\(/, category: "Arbitrary code execution", label: "eval()", severityInterpolated: "critical", alwaysDangerous: true, isAssignment: false },
  { regex: /\bexec\s*\(/, category: "Arbitrary code execution", label: "exec()", severityInterpolated: "critical", alwaysDangerous: true, isAssignment: false },
  { regex: /\bcompile\s*\(/, category: "Code compilation", label: "compile()", severityInterpolated: "high", alwaysDangerous: false, isAssignment: false },
  // Command injection
  { regex: /os\.system\s*\(/, category: "Command injection", label: "os.system", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  { regex: /os\.popen\s*\(/, category: "Command injection", label: "os.popen", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  { regex: /subprocess\.call\s*\(.*shell\s*=\s*True/, category: "Command injection", label: "subprocess.call with shell=True", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  { regex: /subprocess\.run\s*\(.*shell\s*=\s*True/, category: "Command injection", label: "subprocess.run with shell=True", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  { regex: /subprocess\.Popen\s*\(.*shell\s*=\s*True/, category: "Command injection", label: "subprocess.Popen with shell=True", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  // Path traversal
  { regex: /\bopen\s*\(/, category: "Path traversal", label: "open()", severityInterpolated: "high", alwaysDangerous: false, isAssignment: false },
  // Deserialization
  { regex: /pickle\.loads\s*\(/, category: "Deserialization RCE", label: "pickle.loads()", severityInterpolated: "critical", alwaysDangerous: true, isAssignment: false },
  { regex: /yaml\.load\s*\(/, category: "Deserialization RCE", label: "yaml.load()", severityInterpolated: "critical", alwaysDangerous: true, isAssignment: false },
  // SSTI
  { regex: /Template\s*\(.*\)\.render\s*\(/, category: "Possible SSTI", label: "Template().render()", severityInterpolated: "high", alwaysDangerous: false, isAssignment: false },
  { regex: /render_template_string\s*\(/, category: "Possible SSTI", label: "render_template_string()", severityInterpolated: "high", alwaysDangerous: false, isAssignment: false },
];

// ─── JavaScript/TypeScript sinks ───────────────────────────────────

const JS_SINKS: SinkDefinition[] = [
  // Arbitrary code execution
  { regex: /\beval\s*\(/, category: "Arbitrary code execution", label: "eval()", severityInterpolated: "critical", alwaysDangerous: true, isAssignment: false },
  { regex: /\bnew\s+Function\s*\(/, category: "Dynamic code execution", label: "new Function()", severityInterpolated: "critical", alwaysDangerous: true, isAssignment: false },
  { regex: /\bFunction\s*\(/, category: "Dynamic code execution", label: "Function()", severityInterpolated: "critical", alwaysDangerous: true, isAssignment: false },
  // Code string eval
  { regex: /\bsetTimeout\s*\(\s*["'`]/, category: "Code string eval", label: "setTimeout with string", severityInterpolated: "high", alwaysDangerous: false, isAssignment: false },
  { regex: /\bsetInterval\s*\(\s*["'`]/, category: "Code string eval", label: "setInterval with string", severityInterpolated: "high", alwaysDangerous: false, isAssignment: false },
  // XSS — assignment sinks
  { regex: /\.innerHTML\s*=/, category: "XSS", label: "innerHTML assignment", severityInterpolated: "high", alwaysDangerous: false, isAssignment: true },
  { regex: /\.outerHTML\s*=/, category: "XSS", label: "outerHTML assignment", severityInterpolated: "high", alwaysDangerous: false, isAssignment: true },
  // XSS — function call sinks
  { regex: /document\.write\s*\(/, category: "XSS", label: "document.write()", severityInterpolated: "high", alwaysDangerous: false, isAssignment: false },
  { regex: /insertAdjacentHTML\s*\(/, category: "XSS", label: "insertAdjacentHTML()", severityInterpolated: "high", alwaysDangerous: false, isAssignment: false },
  { regex: /\.html\s*\(/, category: "XSS", label: ".html() (jQuery)", severityInterpolated: "high", alwaysDangerous: false, isAssignment: false },
  { regex: /dangerouslySetInnerHTML/, category: "XSS", label: "dangerouslySetInnerHTML", severityInterpolated: "high", alwaysDangerous: false, isAssignment: true },
  // Command injection
  { regex: /\bexec\s*\(/, category: "Command injection", label: "exec()", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  { regex: /\bexecSync\s*\(/, category: "Command injection", label: "execSync()", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  { regex: /\bspawn\s*\(.*shell\s*:\s*true/, category: "Command injection", label: "spawn with shell:true", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  // SQL injection
  { regex: /db\.query\s*\(/, category: "SQL injection", label: "db.query()", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  { regex: /connection\.query\s*\(/, category: "SQL injection", label: "connection.query()", severityInterpolated: "critical", alwaysDangerous: false, isAssignment: false },
  // Path traversal
  { regex: /fs\.readFile\s*\(/, category: "Path traversal", label: "fs.readFile()", severityInterpolated: "high", alwaysDangerous: false, isAssignment: false },
];

// ─── Interpolation detection ───────────────────────────────────────

const PYTHON_INTERPOLATION_PATTERNS: RegExp[] = [
  /f["'][^"']*\{/,              // f-string: f"...{var}..."
  /["'].*%s.*["']\s*%/,         // % formatting: "...%s..." % var
  /["'].*\{\}.*["']\.format\(/, // .format(): "...{}...".format(var)
  /["'].*["']\s*\+\s*\w/,      // concat: "..." + var
  /\w\s*\+\s*["']/,            // concat: var + "..."
];

const JS_INTERPOLATION_PATTERNS: RegExp[] = [
  /`[^`]*\$\{/,                // template literal: `...${var}...`
  /["'].*["']\s*\+\s*\w/,     // concat: "..." + var
  /\w\s*\+\s*["']/,           // concat: var + "..."
];

/**
 * Check if a line contains string interpolation patterns.
 */
export function hasInterpolation(line: string, language: Language): boolean {
  const patterns =
    language === "python"
      ? PYTHON_INTERPOLATION_PATTERNS
      : JS_INTERPOLATION_PATTERNS;

  return patterns.some((p) => p.test(line));
}

// ─── Parameterized query detection (false positive filter) ─────────

/**
 * Check if a sink line uses parameterized queries.
 * Only applies to function-call sinks (not assignment sinks).
 * Detects: tuple/dict/array second args, ? placeholders, $N params, :name params.
 */
export function isParameterized(line: string): boolean {
  // Check for array second arg: db.query(sql, [id])
  if (/,\s*\[/.test(line)) return true;

  // Check for tuple second arg (Python): cursor.execute(sql, (id,))
  // Must not match callback patterns like (err, stdout) =>
  if (/,\s*\([^)]*\)\s*[^=]/.test(line) && !/=>\s*\{/.test(line) && !/\bfunction\b/.test(line)) {
    // Extra check: the tuple should contain values, not look like a callback signature
    const tupleMatch = line.match(/,\s*\(([^)]*)\)/);
    if (tupleMatch && !/\b(err|error|e|stdout|stderr|data|result|rows|res|req)\b/.test(tupleMatch[1]!)) {
      return true;
    }
  }

  // Check for dict second arg: cursor.execute(sql, {key: val})
  if (/,\s*\{/.test(line)) return true;

  // Check for placeholder patterns INSIDE a string argument
  // ? placeholders (in the SQL string, not in code)
  if (/["'`][^"'`]*\?[^"'`]*["'`]/.test(line)) return true;

  // $1, $2 numbered params (in the SQL string)
  if (/["'`][^"'`]*\$\d+[^"'`]*["'`]/.test(line)) return true;

  // :name named params (in the SQL string, not URL paths)
  if (/["'`][^"'`]*:\w+[^"'`]*["'`]/.test(line) && /\b(execute|query)\b/.test(line)) return true;

  return false;
}

// ─── Sanitizer detection ───────────────────────────────────────────

const SANITIZER_PATTERNS: RegExp[] = [
  // Python
  /\bescape\s*\(/,
  /\bhtmlentities\s*\(/,
  /\bhtml\.escape\s*\(/,
  /\bshlex\.quote\s*\(/,
  // JavaScript
  /DOMPurify\.sanitize\s*\(/,
  /escape-html/,
  /sanitize-html/,
];

/**
 * Check if a file contains sanitizer function calls.
 */
export function hasSanitizer(content: string): boolean {
  return SANITIZER_PATTERNS.some((p) => p.test(content));
}

// ─── Hardcoded string detection ────────────────────────────────────

/**
 * Check if a sink's argument is a hardcoded string with no interpolation.
 * E.g. cursor.execute("SELECT version()") is safe.
 * Only applies to function-call sinks (not assignment sinks).
 */
export function isHardcodedStringSink(
  line: string,
  language: Language,
  isAssignment: boolean,
): boolean {
  // Assignment sinks (innerHTML = x) are never "hardcoded" in this sense
  if (isAssignment) return false;

  // If there's interpolation, it's not hardcoded
  if (hasInterpolation(line, language)) return false;

  // For function calls, check if the final function call's argument is a simple string literal.
  // We look for the rightmost function-call-with-string-arg pattern to avoid matching
  // chained calls like querySelector("#out").innerHTML
  // Pattern: identify the sink function call and check its arg
  // Simple heuristic: if the line ends with ("string literal") or ('string literal'), it's hardcoded
  const trailingCallMatch = line.match(/\(\s*(["'])([^"']*)\1\s*\)\s*$/);
  if (trailingCallMatch) return true;

  // Also check for single function call: func("literal")
  // But only if there's exactly one function call pattern on the line
  const allCalls = line.match(/\w+\s*\(\s*(["'])([^"']*)\1\s*\)/g);
  if (allCalls && allCalls.length === 1) return true;

  return false;
}

// ─── Main sink finder ──────────────────────────────────────────────

/**
 * Find all dangerous sink matches in file content.
 */
export function findDangerousSinks(
  content: string,
  language: Language,
): SinkMatch[] {
  const sinks = language === "python" ? PYTHON_SINKS : JS_SINKS;
  const lines = content.split("\n");
  const matches: SinkMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const sink of sinks) {
      const regexMatch = sink.regex.exec(line);
      if (!regexMatch) continue;

      // Determine severity
      let severity: Severity;
      if (sink.alwaysDangerous) {
        severity = sink.severityInterpolated; // always at full severity
      } else if (hasInterpolation(line, language) || sink.isAssignment) {
        // Assignment sinks (innerHTML = x) always count as "data flows to sink"
        severity = sink.severityInterpolated;
      } else {
        // Non-interpolated, non-always-dangerous, non-assignment:
        // will be decided by caller based on co-presence with taint sources
        severity = "medium";
      }

      // Truncate raw code at 100 chars
      const rawCode = line.trim().length > 100
        ? line.trim().slice(0, 100) + "..."
        : line.trim();

      matches.push({
        line: i + 1,
        column: regexMatch.index + 1,
        category: sink.category,
        label: sink.label,
        severity,
        rawCode,
        alwaysDangerous: sink.alwaysDangerous,
        isAssignment: sink.isAssignment,
      });

      break; // one sink match per line
    }
  }

  return matches;
}

export type Language = "python" | "javascript" | "typescript" | "go" | "rust" | "ruby";

export type Severity = "critical" | "high" | "medium" | "low";

export type DetectorId = "hallucinated-deps" | "deprecated-api" | "credential-leak" |
                        "fake-type-safety" | "silent-exception" | "unsafe-sanitize" | "tautological-test" |
                        "go/slopsquatting" | "go/error-ignored" | "go/sprintf-sql" | "go/hardcoded-secret" |
                        "rust/unwrap-abuse" | "rust/unsafe-block" | "rust/todo-macro" | "rust/panic-macro" |
                        "ruby/mass-assignment" | "ruby/string-interpolation-sql" | "ruby/silent-rescue" | "ruby/eval-injection" |
                        "missing-await" | "insecure-rng" | "dynamic-eval" | "hardcoded-localhost" | "env-no-fallback";

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

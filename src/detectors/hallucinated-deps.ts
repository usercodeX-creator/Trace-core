import type { Detector, DetectorContext, Detection } from "../types.js";
import { extractImports as extractPythonImports } from "../parsers/python.js";
import { extractImports as extractJsImports } from "../parsers/javascript.js";
import * as pypi from "../registries/pypi.js";
import * as npm from "../registries/npm.js";

export const hallucinatedDeps: Detector = {
  id: "hallucinated-deps",
  name: "Hallucinated Dependencies",
  description: "Detects imports of packages that do not exist in the registry.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    // 1. Extract imports based on language
    const imports = ctx.language === "python"
      ? extractPythonImports(ctx.content)
      : extractJsImports(ctx.content);

    if (imports.length === 0) return [];

    // 2. Deduplicate package names while preserving first occurrence info
    const seen = new Map<string, typeof imports[number]>();
    for (const imp of imports) {
      if (!seen.has(imp.packageName)) {
        seen.set(imp.packageName, imp);
      }
    }

    // 3. Query registry in parallel
    const registryCheck = ctx.language === "python" ? pypi.exists : npm.exists;
    const uniquePackages = Array.from(seen.entries());

    const results = await Promise.all(
      uniquePackages.map(async ([name, info]) => {
        const found = await registryCheck(name);
        return { name, info, found };
      })
    );

    // 4. Build Detection[] for non-existent packages
    const detections: Detection[] = [];
    for (const { name, info, found } of results) {
      if (!found) {
        const registry = ctx.language === "python" ? "PyPI" : "npm";
        detections.push({
          detector: "hallucinated-deps",
          severity: "critical",
          file: ctx.filePath,
          line: info.line,
          message: `Package "${name}" not found on ${registry}`,
          rawCode: info.rawCode,
          // Extension points — reserved for future phases
          suggestedFix: null,
          dependencyContext: null,
          auditTrail: null,
        });
      }
    }

    return detections;
  },
};

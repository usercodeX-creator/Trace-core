import type { Detection, DetectorContext } from "./types.js";
import { detectors } from "./detectors/index.js";
import { anonymize } from "./lib/anonymizer.js";

/**
 * Run all registered detectors against a single file context.
 *
 * Architecture note (Principle 3): This function is pure — takes a context,
 * returns detections. No process.argv, no process.stdout, no env vars.
 * It can be called from CLI, HTTP handler, or GitHub Action identically.
 */
export async function runDetectors(ctx: DetectorContext): Promise<Detection[]> {
  // Principle 4: Anonymize before detection
  const anonymizedCtx = anonymize(ctx);

  const allDetections: Detection[] = [];

  // Run all detectors in parallel
  const results = await Promise.all(
    detectors.map((detector) => detector.run(anonymizedCtx))
  );

  for (const detections of results) {
    allDetections.push(...detections);
  }

  // Sort by line number for stable output
  allDetections.sort((a, b) => a.line - b.line);

  return allDetections;
}

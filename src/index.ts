// Public API — re-exports for programmatic usage
export type { Detection, DetectorContext, Detector, Language, Severity, DetectorId } from "./types.js";
export { runDetectors } from "./engine.js";
export { detectors } from "./detectors/index.js";

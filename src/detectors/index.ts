import type { Detector } from "../types.js";
import { hallucinatedDeps } from "./hallucinated-deps.js";

/**
 * Registry of all active detectors.
 *
 * TODO: Extension point — when detectors #02-#07 arrive, add them here.
 * Zero changes to existing files required.
 */
export const detectors: Detector[] = [
  hallucinatedDeps,
];

import type { Detector } from "../types.js";
import { hallucinatedDeps } from "./hallucinated-deps.js";
import { credentialLeak } from "./credential-leak.js";

/**
 * Registry of all active detectors.
 *
 * Extension point — when detectors #02-#07 arrive, add them here.
 * Zero changes to existing files required.
 */
export const detectors: Detector[] = [
  hallucinatedDeps,
  credentialLeak,
];

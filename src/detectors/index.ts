import type { Detector } from "../types.js";
import { hallucinatedDeps } from "./hallucinated-deps.js";
import { credentialLeak } from "./credential-leak.js";
import { silentException } from "./silent-exception.js";
import { unsafeSanitization } from "./unsafe-sanitization.js";
import { deprecatedApi } from "./deprecated-api.js";
import { fakeTypeSafety } from "./fake-type-safety.js";
import { meaninglessTest } from "./meaningless-test.js";

/**
 * Registry of all active detectors.
 *
 * v0.5.0: 7 detectors — all patterns the brand promises.
 */
export const detectors: Detector[] = [
  hallucinatedDeps,
  credentialLeak,
  silentException,
  unsafeSanitization,
  deprecatedApi,
  fakeTypeSafety,
  meaninglessTest,
];

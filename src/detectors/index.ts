import type { Detector } from "../types.js";
import { hallucinatedDeps } from "./hallucinated-deps.js";
import { credentialLeak } from "./credential-leak.js";
import { silentException } from "./silent-exception.js";
import { unsafeSanitization } from "./unsafe-sanitization.js";
import { deprecatedApi } from "./deprecated-api.js";
import { fakeTypeSafety } from "./fake-type-safety.js";
import { meaninglessTest } from "./meaningless-test.js";
import { goDetectors } from "./go/index.js";
import { rustDetectors } from "./rust/index.js";
import { rubyDetectors } from "./ruby/index.js";

/**
 * Registry of all active detectors.
 *
 * v0.6.0: 19 detectors — Python, JavaScript, TypeScript, Go, Rust, Ruby.
 */
export const detectors: Detector[] = [
  hallucinatedDeps,
  credentialLeak,
  silentException,
  unsafeSanitization,
  deprecatedApi,
  fakeTypeSafety,
  meaninglessTest,
  ...goDetectors,
  ...rustDetectors,
  ...rubyDetectors,
];

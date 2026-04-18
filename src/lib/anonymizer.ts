import type { DetectorContext } from "../types.js";

/**
 * Strips identity information from detector contexts.
 *
 * In v0.1 this is a passthrough stub. When Organization Analytics (Phase 5) and
 * Compliance Kit (Phase 6) arrive, this will strip PII before detection and
 * re-attach it in the output layer.
 *
 * TODO: Extension point — implement real anonymization for Phase 5/6
 */
export function anonymize(ctx: DetectorContext): DetectorContext {
  return ctx;
}

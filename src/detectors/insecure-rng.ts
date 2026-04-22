/**
 * Detector: insecure-rng
 *
 * Flags security-adjacent variables assigned from non-cryptographic RNGs
 * (Math.random in JS/TS, random module in Python). Single-line regex, no AST.
 */

import type { Detector, DetectorContext, Detection } from "../types.js";

const JS_INSECURE_RNG_RE =
  /\b\w*(token|session|key|password|secret|nonce|otp|csrf|auth)\w*\s*[:=]\s*[^;]*Math\.random\s*\(/i;

const PY_INSECURE_RNG_RE =
  /\b\w*(token|session|key|password|secret|nonce|otp|csrf|auth)\w*\s*=\s*[^#\n]*random\.(random|randint|choice|randrange|uniform)\s*\(/i;

export const insecureRng: Detector = {
  id: "insecure-rng",
  name: "Insecure RNG",
  description:
    "Detects security-sensitive variables assigned from non-cryptographic RNGs (Math.random, random.randint, etc.).",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if (
      ctx.language !== "javascript" &&
      ctx.language !== "typescript" &&
      ctx.language !== "python"
    )
      return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];
    const re = ctx.language === "python" ? PY_INSECURE_RNG_RE : JS_INSECURE_RNG_RE;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = re.exec(line);
      if (!match) continue;

      const rngSource = ctx.language === "python" ? "random module" : "Math.random()";
      const safeAlt =
        ctx.language === "python"
          ? "secrets module (secrets.token_urlsafe, secrets.token_hex)"
          : "crypto.randomBytes() or crypto.randomUUID()";

      detections.push({
        detector: "insecure-rng",
        severity: "high",
        file: ctx.filePath,
        line: i + 1,
        column: match.index + 1,
        message: `Insecure RNG: \`${rngSource}\` used for security-sensitive variable \`${match[1]}\`. Use ${safeAlt}.`,
        rawCode: line.trim(),
        suggestedFix: null,
        dependencyContext: null,
        auditTrail: null,
      });
    }

    return detections;
  },
};

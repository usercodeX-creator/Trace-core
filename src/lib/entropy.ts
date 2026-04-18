/**
 * Shannon entropy calculation for string analysis.
 *
 * Used by the credential-leak detector to identify high-entropy
 * strings that may be hardcoded secrets.
 */

/**
 * Compute Shannon entropy (bits per character) for a given string.
 * Returns 0 for empty strings.
 */
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const ch of s) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }

  let entropy = 0;
  const len = s.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

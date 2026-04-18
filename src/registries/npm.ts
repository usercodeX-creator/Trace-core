import { RegistryCache } from "../lib/cache.js";

const cache = new RegistryCache();
const TIMEOUT_MS = 5000;

/**
 * Check if a package exists on npm.
 *
 * Scoped packages are URL-encoded: @scope/name → @scope%2fname
 *
 * @returns true if the package exists, false if it returns 404
 * @throws on network errors or non-200/404 responses
 */
export async function exists(packageName: string): Promise<boolean> {
  const cached = cache.get(packageName);
  if (cached !== undefined) return cached;

  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (response.status === 200) {
      cache.set(packageName, true);
      return true;
    }

    if (response.status === 404) {
      cache.set(packageName, false);
      return false;
    }

    throw new Error(`npm returned unexpected status ${response.status} for package "${packageName}"`);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`npm request timed out after ${TIMEOUT_MS}ms for package "${packageName}"`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reset the cache. Useful for testing.
 */
export function resetCache(): void {
  cache.clear();
}

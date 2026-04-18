/**
 * Simple in-memory cache for registry lookups.
 * Scoped to the lifetime of a single CLI invocation.
 */
export class RegistryCache {
  private store = new Map<string, boolean>();

  get(key: string): boolean | undefined {
    return this.store.get(key);
  }

  set(key: string, value: boolean): void {
    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }
}

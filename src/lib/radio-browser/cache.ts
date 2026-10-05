interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Tiny TTL cache for directory responses.
 *
 * The directory is a volunteer-run service with a soft budget of ~2-3
 * requests/second, so hot searches must not hit it again. Process-local and
 * intentionally simple: Next.js edge caching covers the multi-instance case.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly defaultTtlMs: number = 300_000,
    private readonly maxEntries: number = 500,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    // Refresh recency: delete first so re-inserting moves the key to the end.
    this.store.delete(key);

    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
    }

    this.store.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

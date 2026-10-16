/**
 * Small in-process LRU with per-entry TTL. Per serverless instance only —
 * good enough to absorb repeated geocode / elevation lookups without a cache
 * service; correctness never depends on a hit.
 */
export class TtlCache<V> {
  private map = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

/**
 * Per-key minimum spacing between calls (e.g. 1 request/second per user).
 * Returns the milliseconds to wait, or 0 when the call may proceed (and
 * records it).
 */
export class Spacing {
  private last = new Map<string, number>();

  constructor(
    private readonly intervalMs: number,
    private readonly maxKeys = 10000
  ) {}

  take(key: string, now = Date.now()): number {
    const prev = this.last.get(key) ?? 0;
    const wait = prev + this.intervalMs - now;
    if (wait > 0) return wait;
    this.last.delete(key);
    this.last.set(key, now);
    if (this.last.size > this.maxKeys) {
      const oldest = this.last.keys().next().value;
      if (oldest !== undefined) this.last.delete(oldest);
    }
    return 0;
  }
}

/**
 * Fixed-window request counter per key (e.g. 60 calls per minute per user).
 * `take` returns 0 when allowed (and counts the call), otherwise the
 * milliseconds until the window resets. Per instance, like the caches above.
 */
export class WindowLimiter {
  private windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10000
  ) {}

  take(key: string, now = Date.now()): number {
    let w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      w = { start: now, count: 0 };
      this.windows.delete(key);
      this.windows.set(key, w);
      if (this.windows.size > this.maxKeys) {
        const oldest = this.windows.keys().next().value;
        if (oldest !== undefined) this.windows.delete(oldest);
      }
    }
    if (w.count >= this.max) return w.start + this.windowMs - now;
    w.count++;
    return 0;
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

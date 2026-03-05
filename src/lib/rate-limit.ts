const rateLimitMaps = new Map<string, Map<string, { count: number; resetAt: number }>>();

export function createRateLimiter(limit: number, windowMs: number) {
  const store = new Map<string, { count: number; resetAt: number }>();
  rateLimitMaps.set(`${limit}-${windowMs}`, store);

  return function isRateLimited(key: string): boolean {
    const now = Date.now();
    const entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    entry.count++;
    return entry.count > limit;
  };
}

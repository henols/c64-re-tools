# Wire-ID Catalogs

Never hardcode VICE register or bank ids. They are per build and per
machine. Resolve names through the connected build's own enumeration
(REGISTERS_AVAILABLE, BANKS_AVAILABLE).

Cache the catalog per session, keyed on the session object:

```ts
let catalogs = new WeakMap<StockConnectSession, Promise<Catalog>>();

export async function catalogFor(session) {
  const hit = catalogs.get(session);
  if (hit) return hit;
  const pending = fetchCatalog(session);   // throws on empty enumeration
  catalogs.set(session, pending);
  pending.catch(() => catalogs.delete(session));
  return pending;
}
```

- Cache the in-flight promise, not the result, so concurrent callers
  share one round trip.
- Evict on reject. A failure is retried, never memoised.
- No manual invalidation: a reconnect yields a new session object.
- Export `resetXForTest()` that swaps in a fresh map.

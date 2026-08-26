# hcacher

Flexible in-memory cache manager with optional TTL, FIFO or strict-LRU eviction, and an event bus.

> English | [Русский](https://github.com/dirold2/hcacher/tree/main/lang/ru)

[![npm version](https://img.shields.io/npm/v/hcacher)](https://www.npmjs.com/package/hcacher)
[![npm downloads](https://img.shields.io/npm/dm/hcacher)](https://www.npmjs.com/package/hcacher)
[![license](https://img.shields.io/npm/l/hcacher)](./LICENSE)
[![typescript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)

## Install

```sh
npm install hcacher
```

```sh
pnpm install hcacher
```

```sh
bun install hcacher
```

## Usage

```ts
import { CacheManager } from "hcacher";

// Basic usage
const cache = new CacheManager<string>({ maxSize: 100, ttl: 60_000 });
cache.set("key", "value");
console.log(cache.get("key")); // "value"

// With factory (deduplicates concurrent requests)
const result = await cache.getOrSet("key", async () => {
  const res = await fetch("https://api.example.com/data");
  return res.json();
});

// Events
cache.on("hit", (key, data) => console.log(`Cache hit: ${key}`));
cache.on("miss", (key) => console.log(`Cache miss: ${key}`));
cache.on("evict", (key, data) => console.log(`Evicted: ${key}`));
cache.on("expire", (key, data) => console.log(`Expired: ${key}`));
```

## API

### `new CacheManager<T>(options?)`

| Option       | Default    | Description                                                           |
| ------------ | ---------- | --------------------------------------------------------------------- |
| `maxSize`    | `Infinity` | Positive safe-integer maximum entries; `Infinity` disables eviction   |
| `ttl`        | `Infinity` | Non-negative lifetime in milliseconds; `Infinity` disables expiration |
| `touchOnGet` | `false`    | Enables strict LRU; otherwise a bounded cache uses FIFO eviction      |
| `enabled`    | `true`     | Enables or disables caching                                           |

```ts
// Defaults: unbounded cache, no expiration.
new CacheManager<string>();

// Bounded caches use FIFO by default: reads and overwrites preserve insertion order.
new CacheManager<string>({ maxSize: 100, ttl: 30_000 });

// Opt in to strict LRU: reads and overwrites move an entry to the newest position.
new CacheManager<string>({ maxSize: 100, ttl: 30_000, touchOnGet: true });

// Positional arguments are also supported.
new CacheManager<string>(100, 30_000, true, true);
```

### Eviction behavior

- With `maxSize: Infinity` (the default), no entries are evicted for capacity.
- With finite `maxSize` and `touchOnGet: false` (the default), the oldest inserted entry is evicted first (FIFO). Reading or overwriting an existing entry does not change its position.
- With finite `maxSize` and `touchOnGet: true`, the least recently used entry is evicted first (strict LRU). Reading or overwriting an existing entry moves it to the newest position.

### Methods

- **`get(key)`** — Get value by key. Returns `undefined` on miss or expiration.
- **`getEntry(key)`** — Get full entry with `etag`/`lastModified` metadata.
- **`set(key, data, meta?)`** — Store value with optional `etag`/`lastModified`.
- **`getOrSet(key, factory, meta?)`** — Get or create via factory.
  Deduplicates concurrent calls for the same key.
- **`has(key)`** — Check if key exists and is not expired.
- **`delete(key)`** — Remove an entry and invalidate its pending factory.
- **`clear()`** — Remove all entries and invalidate all pending factories.
- **`prune()`** — Remove expired entries and return their count.
- **`size`** — Current number of non-expired entries.

### Events

| Event    | Payload       | Description                                     |
| -------- | ------------- | ----------------------------------------------- |
| `hit`    | `(key, data)` | Cache hit                                       |
| `miss`   | `(key)`       | Cache miss                                      |
| `set`    | `(key, data)` | Entry stored                                    |
| `evict`  | `(key, data)` | Entry evicted because the bounded cache is full |
| `expire` | `(key, data)` | Entry expired (TTL)                             |

## License

MIT

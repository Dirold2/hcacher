# hcacher

Flexible in-memory cache manager with TTL, LRU eviction, and event bus.

## Install

```sh
npm install hcacher
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

| Option       | Default | Description                                  |
| ------------ | ------- | -------------------------------------------- |
| `maxSize`    | `1000`  | Positive integer maximum number of entries   |
| `ttl`        | `60000` | Non-negative time-to-live in milliseconds    |
| `touchOnGet` | `true`  | Update access order on read (for LRU)        |
| `enabled`    | `true`  | Enable/disable the cache                     |

```ts
// Positional args also supported
new CacheManager<string>(100, 30000, true, true);
```

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

| Event    | Payload       | Description         |
| -------- | ------------- | ------------------- |
| `hit`    | `(key, data)` | Cache hit           |
| `miss`   | `(key)`       | Cache miss          |
| `set`    | `(key, data)` | Entry stored        |
| `evict`  | `(key, data)` | Entry evicted (LRU) |
| `expire` | `(key, data)` | Entry expired (TTL) |

## License

MIT

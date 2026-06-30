/**
 * @ru hcacher — гибкий менеджер кэша с TTL, LRU-эвикцией и событийной шиной.
 * @en hcacher — flexible cache manager with TTL, LRU eviction and event bus.
 *
 * @example
 * import { CacheManager } from "hcacher";
 *
 * const cache = new CacheManager<string>({ maxSize: 100, ttl: 60_000 });
 * cache.set("key", "value");
 * console.log(cache.get("key")); // "value"
 */

export { CacheManager } from "./cacher.js";
export { MiniEmitter } from "./miniEmitter.js";

export type { CacheEntry, CacheManagerOptions } from "./interface/index.js";
export type { CacheEvents } from "./types/index.js";

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

/**
 * @ru Менеджер кэша с поддержкой TTL, LRU-эвикции и событий.
 * @en Cache manager with TTL, LRU eviction, and events.
 */
export { CacheManager } from "./cacher.js";

/**
 * @ru Тип записи кэша и параметры конфигурации менеджера.
 * @en Cache entry type and cache manager configuration options.
 */
export type { CacheEntry, CacheManagerOptions } from "./interface/index.js";

/**
 * @ru Тип событий, отправляемых менеджером кэша.
 * @en Event map emitted by the cache manager.
 */
export type { CacheEvents } from "./types/index.js";

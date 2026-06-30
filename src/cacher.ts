import type { CacheEntry, CacheManagerOptions, InternalEntry } from "./interface/index.js";
import { MiniEmitter } from "./miniEmitter.js";
import type { CacheEvents } from "./types/index.js";

/**
 * @ru Менеджер кэша с поддержкой TTL, LRU-эвикции и событийной шины.
 * @en Cache manager with TTL, LRU eviction and event bus support.
 */
export class CacheManager<T = unknown> extends MiniEmitter<CacheEvents<T>> {
  private readonly storage = new Map<string, InternalEntry<T>>();
  private readonly pending = new Map<string, Promise<T>>();
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly touchOnGet: boolean;
  private readonly enabled: boolean;

  /**
   * @ru Создаёт новый экземпляр CacheManager.
   * @en Creates a new CacheManager instance.
   * @param maxSizeOrOptions - Maximum cache size or options object.
   * @param ttl - Entry TTL in milliseconds.
   * @param touchOnGet - Update order on read.
   * @param enabled - Whether the cache is enabled.
   */
  constructor(options?: CacheManagerOptions);
  constructor(maxSize?: number, ttl?: number, touchOnGet?: boolean, enabled?: boolean);
  constructor(
    maxSizeOrOptions?: number | CacheManagerOptions,
    ttl?: number,
    touchOnGet?: boolean,
    enabled?: boolean,
  ) {
    super();
    if (typeof maxSizeOrOptions === "object" && maxSizeOrOptions !== null) {
      this.enabled = maxSizeOrOptions.enabled ?? true;
      this.maxSize = maxSizeOrOptions.maxSize ?? 1000;
      this.ttl = maxSizeOrOptions.ttl ?? 60000;
      this.touchOnGet = maxSizeOrOptions.touchOnGet ?? true;
    } else {
      this.enabled = enabled ?? true;
      this.maxSize = maxSizeOrOptions ?? 1000;
      this.ttl = ttl ?? 60000;
      this.touchOnGet = touchOnGet ?? true;
    }
  }

  /**
   * @ru Получает значение по ключу.
   * @en Gets a value by key.
   * @param key - Cache key.
   * @returns Value or undefined.
   */
  get(key: string): T | undefined {
    return this.getEntry(key)?.data;
  }

  /**
   * @ru Получает запись кэша с метаданными.
   * @en Gets a cache entry with metadata.
   * @param key - Cache key.
   * @returns Cache entry or undefined.
   */
  getEntry(key: string): CacheEntry<T> | undefined {
    if (!this.enabled) return undefined;

    const item = this.storage.get(key);
    if (!item) {
      this.emit("miss", key);
      return undefined;
    }

    if (Date.now() > item.expiresAt) {
      this.storage.delete(key);
      this.emit("expire", key, item.entry.data);
      this.emit("miss", key);
      return undefined;
    }

    if (this.touchOnGet) {
      this.storage.delete(key);
      this.storage.set(key, item);
    }

    this.emit("hit", key, item.entry.data);
    return item.entry;
  }

  /**
   * @ru Сохраняет значение в кэш.
   * @en Stores a value in the cache.
   * @param key - Cache key.
   * @param data - Data.
   * @param meta - ETag and/or LastModified.
   */
  set(key: string, data: T, meta?: { etag?: string; lastModified?: string }): void {
    if (!this.enabled) return;

    if (this.storage.has(key)) {
      this.storage.delete(key);
    } else if (this.storage.size >= this.maxSize) {
      this.evict();
    }

    this.storage.set(key, {
      entry: {
        data,
        etag: meta?.etag,
        lastModified: meta?.lastModified,
      },
      expiresAt: Date.now() + this.ttl,
    });

    this.emit("set", key, data);
  }

  /**
   * @ru Получает значение из кэша или создаёт через фабрику (с дедупликацией concurrent-запросов).
   * @en Gets from cache or creates via factory (with concurrent request deduplication).
   * @param key - Cache key.
   * @param factory - Factory function.
   * @param meta - ETag and/or LastModified.
   * @returns Cached or freshly created value.
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T> | T,
    meta?: { etag?: string; lastModified?: string },
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const pendingPromise = this.pending.get(key);
    if (pendingPromise) return pendingPromise;

    const promise = (async () => {
      try {
        const data = await factory();
        this.set(key, data, meta);
        return data;
      } finally {
        this.pending.delete(key);
      }
    })();

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * @ru Проверяет наличие ключа в кэше.
   * @en Checks if a key exists in the cache.
   * @param key - Cache key.
   * @returns True if the key exists and is not expired.
   */
  has(key: string): boolean {
    if (!this.enabled) return false;

    const item = this.storage.get(key);
    if (!item) return false;

    if (Date.now() > item.expiresAt) {
      this.storage.delete(key);
      this.emit("expire", key, item.entry.data);
      return false;
    }

    return true;
  }

  /**
   * @ru Удаляет запись из кэша.
   * @en Deletes an entry from the cache.
   * @param key - Cache key.
   * @returns True if the entry existed and was deleted.
   */
  delete(key: string): boolean {
    if (!this.enabled) return false;
    this.pending.delete(key);
    return this.storage.delete(key);
  }

  /**
   * @ru Очищает кэш и отменяет все ожидающие запросы.
   * @en Clears the cache and cancels all pending requests.
   */
  clear(): void {
    this.storage.clear();
    this.pending.clear();
  }

  /**
   * @ru Текущее количество записей в кэше.
   * @en Current number of entries in the cache.
   */
  get size(): number {
    return this.storage.size;
  }

  private evict(): void {
    const oldestKey = this.storage.keys().next().value;
    if (oldestKey !== undefined) {
      const item = this.storage.get(oldestKey);
      if (item) {
        const expired = Date.now() > item.expiresAt;
        this.emit(expired ? "expire" : "evict", oldestKey, item.entry.data);
        this.storage.delete(oldestKey);
      }
    }
  }
}

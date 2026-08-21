import type { CacheEntry, CacheManagerOptions, InternalEntry } from "./interface/index.js";
import { MiniEmitter } from "./miniEmitter.js";
import type { CacheEvents } from "./types/index.js";

interface PendingRequest<T> {
  promise: Promise<T>;
}

/**
 * @ru Менеджер кэша с поддержкой TTL, LRU-эвикции и событийной шины.
 * @en Cache manager with TTL, LRU eviction and event bus support.
 */
export class CacheManager<T = unknown> extends MiniEmitter<CacheEvents<T>> {
  private readonly storage = new Map<string, InternalEntry<T>>();
  private readonly pending = new Map<string, PendingRequest<T>>();
  private readonly generations = new Map<string, number>();
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly touchOnGet: boolean;
  private readonly enabled: boolean;

  /**
   * @ru Создаёт новый экземпляр CacheManager.
   * @en Creates a new CacheManager instance.
   * @param maxSize - Maximum cache size.
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
    const options =
      typeof maxSizeOrOptions === "object" && maxSizeOrOptions !== null
        ? maxSizeOrOptions
        : { enabled, maxSize: maxSizeOrOptions, ttl, touchOnGet };

    this.enabled = options.enabled ?? true;
    this.maxSize = options.maxSize ?? 1000;
    this.ttl = options.ttl ?? 60000;
    this.touchOnGet = options.touchOnGet ?? true;

    if (!Number.isSafeInteger(this.maxSize) || this.maxSize <= 0) {
      throw new RangeError("maxSize must be a positive safe integer");
    }
    if (!Number.isFinite(this.ttl) || this.ttl < 0) {
      throw new RangeError("ttl must be a non-negative finite number");
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

    if (this.isExpired(item)) {
      this.expire(key, item);
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
   * @ru Сохраняет значение в кэш и отменяет ожидающую фабрику для этого ключа.
   * @en Stores a value and invalidates a pending factory for this key.
   * @param key - Cache key.
   * @param data - Data.
   * @param meta - ETag and/or LastModified.
   */
  set(key: string, data: T, meta?: { etag?: string; lastModified?: string }): void {
    if (!this.enabled) return;
    this.invalidatePending(key);
    this.store(key, data, meta);
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
    if (!this.enabled) return factory();

    const cached = this.getEntry(key);
    if (cached) return cached.data;

    const pending = this.pending.get(key);
    if (pending) return pending.promise;

    const generation = this.generations.get(key) ?? 0;
    let promise!: Promise<T>;
    promise = Promise.resolve()
      .then(factory)
      .then((data) => {
        if ((this.generations.get(key) ?? 0) === generation) {
          this.store(key, data, meta);
        }
        return data;
      })
      .finally(() => {
        if (this.pending.get(key)?.promise === promise) {
          this.pending.delete(key);
        }
      });

    this.pending.set(key, { promise });
    return promise;
  }

  /**
   * @ru Проверяет наличие ключа в кэше.
   * @en Checks if a key exists and is not expired.
   * @param key - Cache key.
   * @returns True if the key exists and is not expired.
   */
  has(key: string): boolean {
    if (!this.enabled) return false;

    const item = this.storage.get(key);
    if (!item) return false;

    if (this.isExpired(item)) {
      this.expire(key, item);
      return false;
    }

    return true;
  }

  /**
   * @ru Удаляет запись и инвалидирует ожидающую фабрику для ключа.
   * @en Deletes an entry and invalidates a pending factory for the key.
   * @param key - Cache key.
   * @returns True if the entry existed and was deleted.
   */
  delete(key: string): boolean {
    this.invalidatePending(key);
    if (!this.enabled) return false;
    return this.storage.delete(key);
  }

  /**
   * @ru Очищает кэш и инвалидирует все ожидающие фабрики.
   * @en Clears the cache and invalidates all pending factories.
   */
  clear(): void {
    for (const key of this.pending.keys()) this.invalidatePending(key);
    this.storage.clear();
  }

  /**
   * @ru Удаляет истёкшие записи.
   * @en Removes expired entries.
   * @returns Number of removed entries.
   */
  prune(): number {
    if (!this.enabled) return 0;

    let removed = 0;
    for (const [key, item] of this.storage) {
      if (this.isExpired(item)) {
        this.expire(key, item);
        removed += 1;
      }
    }
    return removed;
  }

  /**
   * @ru Текущее количество неистёкших записей в кэше.
   * @en Current number of non-expired cache entries.
   */
  get size(): number {
    this.prune();
    return this.storage.size;
  }

  private store(key: string, data: T, meta?: { etag?: string; lastModified?: string }): void {
    this.prune();
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

  private invalidatePending(key: string): void {
    if (!this.pending.delete(key)) return;
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
  }

  private isExpired(item: InternalEntry<T>): boolean {
    return Date.now() >= item.expiresAt;
  }

  private expire(key: string, item: InternalEntry<T>): void {
    this.storage.delete(key);
    this.emit("expire", key, item.entry.data);
  }

  private evict(): void {
    const oldestKey = this.storage.keys().next().value;
    if (oldestKey !== undefined) {
      const item = this.storage.get(oldestKey);
      if (item) {
        this.emit("evict", oldestKey, item.entry.data);
        this.storage.delete(oldestKey);
      }
    }
  }
}

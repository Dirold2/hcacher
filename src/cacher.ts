import { MiniEmitter, type EventListener } from "hemmiter";
import type { CacheEntry, CacheManagerOptions, InternalEntry } from "./interface/index.js";
import type { CacheEvents } from "./types/index.js";

/**
 * @ru Ожидающий результат фабрики для ключа.
 * @en Pending factory result for a cache key.
 *
 * @typeParam T - The type of the cached value.
 */
interface PendingRequest<T> {
  /**
   * @ru Обещание результата фабрики.
   * @en Promise returned by the factory.
   */
  promise: Promise<T>;
}

/**
 * @ru Внутренняя запись кэша, связанная с двусвязным списком.
 * @en Internal cache entry linked into a doubly linked list.
 *
 * @typeParam T - The type of the cached value.
 */
interface LruEntry<T> extends InternalEntry<T> {
  /**
   * @ru Ключ записи.
   * @en Entry key.
   */
  key: string;
  /**
   * @ru Следующая запись в списке.
   * @en Next entry in the list.
   */
  next: LruEntry<T> | undefined;
  /**
   * @ru Предыдущая запись в списке.
   * @en Previous entry in the list.
   */
  previous: LruEntry<T> | undefined;
}

/**
 * @ru Менеджер кэша с поддержкой TTL, LRU-эвикции и событийной шины.
 * @en Cache manager with TTL, LRU eviction and event bus support.
 *
 * @typeParam T - The type of values stored in the cache.
 */
export class CacheManager<T = unknown> extends MiniEmitter<CacheEvents<T>> {
  private readonly storage = new Map<string, LruEntry<T>>();
  private readonly pending = new Map<string, PendingRequest<T>>();
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly touchOnGet: boolean;
  private readonly enabled: boolean;
  private readonly hasExpiry: boolean;
  private readonly hasCapacityLimit: boolean;
  private hasEventListeners = false;
  private notifyingEviction = false;
  private oldest: LruEntry<T> | undefined;
  private newest: LruEntry<T> | undefined;

  /**
   * @ru Регистрирует обработчик события кэша.
   * @en Registers a listener for a cache event.
   *
   * @param event - Event name.
   * @param listener - Function called with the event arguments.
   * @returns This cache manager for method chaining.
   */
  override on<K extends keyof CacheEvents<T>>(
    event: K,
    listener: EventListener<CacheEvents<T>[K]>,
  ): this {
    this.hasEventListeners = true;
    return super.on(event, listener);
  }

  /**
   * @ru Удаляет обработчик события кэша.
   * @en Removes a listener from a cache event.
   *
   * @param event - Event name.
   * @param listener - Previously registered listener.
   * @returns This cache manager for method chaining.
   */
  override off<K extends keyof CacheEvents<T>>(
    event: K,
    listener: EventListener<CacheEvents<T>[K]>,
  ): this {
    const result = super.off(event, listener);
    this.refreshEventListenerState();
    return result;
  }

  /**
   * @ru Удаляет все обработчики или обработчики одного события.
   * @en Removes all listeners, optionally only for one event.
   *
   * @param event - Event name to clear, or all events when omitted.
   * @returns This cache manager for method chaining.
   */
  override removeAllListeners<K extends keyof CacheEvents<T>>(event?: K): this {
    const result = super.removeAllListeners(event);
    this.refreshEventListenerState();
    return result;
  }

  protected override emit<K extends keyof CacheEvents<T>>(
    event: K,
    ...args: CacheEvents<T>[K]
  ): void {
    if (this.hasEventListeners) super.emit(event, ...args);
  }

  /**
   * @ru Создаёт новый экземпляр CacheManager.
   * @en Creates a new CacheManager instance.
   * @param options - Cache configuration, or the legacy positional arguments.
   * @param ttl - Entry TTL in milliseconds when using positional arguments.
   * @param touchOnGet - Update order on read when using positional arguments.
   * @param enabled - Whether the cache is enabled when using positional arguments.
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
    this.maxSize = options.maxSize ?? Infinity;
    this.ttl = options.ttl ?? Infinity;
    this.touchOnGet = options.touchOnGet ?? false;
    this.hasCapacityLimit = this.maxSize !== Infinity;
    this.hasExpiry = this.ttl !== Infinity;

    if (this.maxSize !== Infinity && (!Number.isSafeInteger(this.maxSize) || this.maxSize <= 0)) {
      throw new RangeError("maxSize must be a positive safe integer or Infinity");
    }
    if (this.ttl !== Infinity && (!Number.isFinite(this.ttl) || this.ttl < 0)) {
      throw new RangeError("ttl must be a non-negative finite number or Infinity");
    }
  }

  /**
   * @ru Получает значение по ключу.
   * @en Gets a value by key.
   * @param key - Cache key.
   * @returns Value or undefined.
   */
  get(key: string): T | undefined {
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

    if (this.hasCapacityLimit && this.touchOnGet && this.newest !== item) {
      this.moveToNewest(item);
    }

    this.emit("hit", key, item.entry.data);
    return item.entry.data;
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

    if (this.hasCapacityLimit && this.touchOnGet && this.newest !== item) {
      this.moveToNewest(item);
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
    if (this.pending.size > 0) this.invalidatePending(key);
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

    let request!: PendingRequest<T>;
    const promise = Promise.resolve()
      .then(factory)
      .then((data) => {
        if (this.pending.get(key) === request) {
          this.store(key, data, meta);
        }
        return data;
      })
      .finally(() => {
        if (this.pending.get(key) === request) {
          this.pending.delete(key);
        }
      });

    request = { promise };
    this.pending.set(key, request);
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

    const item = this.storage.get(key);
    if (!item) return false;

    this.storage.delete(key);
    if (this.hasCapacityLimit) this.unlink(item);
    return true;
  }

  /**
   * @ru Очищает кэш и инвалидирует все ожидающие фабрики.
   * @en Clears the cache and invalidates all pending factories.
   */
  clear(): void {
    for (const key of this.pending.keys()) this.invalidatePending(key);
    this.storage.clear();
    this.oldest = undefined;
    this.newest = undefined;
  }

  /**
   * @ru Удаляет истёкшие записи.
   * @en Removes expired entries.
   * @returns Number of removed entries.
   */
  prune(): number {
    if (!this.enabled || !this.hasExpiry) return 0;

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
    const existing = this.storage.get(key);
    if (existing) {
      existing.entry = {
        data,
        etag: meta?.etag,
        lastModified: meta?.lastModified,
      };
      if (this.hasExpiry) existing.expiresAt = Date.now() + this.ttl;
      if (this.hasCapacityLimit && this.touchOnGet && this.newest !== existing) {
        this.moveToNewest(existing);
      }
      this.emit("set", key, data);
      return;
    }

    if (this.hasCapacityLimit && this.storage.size >= this.maxSize) {
      if (this.notifyingEviction) {
        throw new Error("Cannot insert into a full cache during an eviction callback");
      }
      this.evict();
      // An eviction listener may have inserted this key or filled the cache again.
      if (this.storage.has(key)) {
        this.store(key, data, meta);
        return;
      }
      if (this.storage.size >= this.maxSize) {
        throw new Error("Eviction callback refilled the cache");
      }
    }

    const item: LruEntry<T> = {
      key,
      entry: {
        data,
        etag: meta?.etag,
        lastModified: meta?.lastModified,
      },
      expiresAt: this.hasExpiry ? Date.now() + this.ttl : Infinity,
      next: undefined,
      previous: undefined,
    };
    this.storage.set(key, item);
    if (this.hasCapacityLimit) this.append(item);

    this.emit("set", key, data);
  }

  private invalidatePending(key: string): void {
    this.pending.delete(key);
  }

  private isExpired(item: InternalEntry<T>): boolean {
    return this.hasExpiry && Date.now() >= item.expiresAt;
  }

  private expire(key: string, item: LruEntry<T>): void {
    this.storage.delete(key);
    if (this.hasCapacityLimit) this.unlink(item);
    this.emit("expire", key, item.entry.data);
  }

  private evict(): void {
    const item = this.oldest;
    if (!item) return;

    this.storage.delete(item.key);
    this.unlink(item);
    if (this.listenerCount("evict") === 0) return;

    this.notifyingEviction = true;
    try {
      this.emit("evict", item.key, item.entry.data);
    } finally {
      this.notifyingEviction = false;
    }
  }

  private refreshEventListenerState(): void {
    this.hasEventListeners =
      this.listenerCount("hit") > 0 ||
      this.listenerCount("miss") > 0 ||
      this.listenerCount("set") > 0 ||
      this.listenerCount("evict") > 0 ||
      this.listenerCount("expire") > 0;
  }

  private append(item: LruEntry<T>): void {
    item.previous = this.newest;
    item.next = undefined;
    if (this.newest) this.newest.next = item;
    else this.oldest = item;
    this.newest = item;
  }

  private unlink(item: LruEntry<T>): void {
    const { previous, next } = item;
    if (previous) previous.next = next;
    else if (this.oldest === item) this.oldest = next;

    if (next) next.previous = previous;
    else if (this.newest === item) this.newest = previous;

    item.previous = undefined;
    item.next = undefined;
  }

  private moveToNewest(item: LruEntry<T>): void {
    const previous = item.previous;
    const next = item.next;

    if (previous) previous.next = next;
    else this.oldest = next;
    if (next) next.previous = previous;

    item.previous = this.newest;
    item.next = undefined;
    this.newest!.next = item;
    this.newest = item;
  }
}

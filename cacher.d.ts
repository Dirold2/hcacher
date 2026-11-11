import { MiniEmitter, type EventListener } from "hemmiter";
import type { CacheEntry, CacheManagerOptions } from "./interface/index.js";
import type { CacheEvents } from "./types/index.js";
/**
 * @ru Менеджер кэша с поддержкой TTL, LRU-эвикции и событийной шины.
 * @en Cache manager with TTL, LRU eviction and event bus support.
 *
 * @typeParam T - The type of values stored in the cache.
 */
export declare class CacheManager<T = unknown> extends MiniEmitter<CacheEvents<T>> {
    private readonly storage;
    private readonly pending;
    private readonly maxSize;
    private readonly ttl;
    private readonly touchOnGet;
    private readonly enabled;
    private readonly hasExpiry;
    private readonly hasCapacityLimit;
    private hasEventListeners;
    private notifyingEviction;
    private oldest;
    private newest;
    /**
     * @ru Регистрирует обработчик события кэша.
     * @en Registers a listener for a cache event.
     *
     * @param event - Event name.
     * @param listener - Function called with the event arguments.
     * @returns This cache manager for method chaining.
     */
    on<K extends keyof CacheEvents<T>>(event: K, listener: EventListener<CacheEvents<T>[K]>): this;
    /**
     * @ru Удаляет обработчик события кэша.
     * @en Removes a listener from a cache event.
     *
     * @param event - Event name.
     * @param listener - Previously registered listener.
     * @returns This cache manager for method chaining.
     */
    off<K extends keyof CacheEvents<T>>(event: K, listener: EventListener<CacheEvents<T>[K]>): this;
    /**
     * @ru Удаляет все обработчики или обработчики одного события.
     * @en Removes all listeners, optionally only for one event.
     *
     * @param event - Event name to clear, or all events when omitted.
     * @returns This cache manager for method chaining.
     */
    removeAllListeners<K extends keyof CacheEvents<T>>(event?: K): this;
    protected emit<K extends keyof CacheEvents<T>>(event: K, ...args: CacheEvents<T>[K]): void;
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
    /**
     * @ru Получает значение по ключу.
     * @en Gets a value by key.
     * @param key - Cache key.
     * @returns Value or undefined.
     */
    get(key: string): T | undefined;
    /**
     * @ru Получает запись кэша с метаданными.
     * @en Gets a cache entry with metadata.
     * @param key - Cache key.
     * @returns Cache entry or undefined.
     */
    getEntry(key: string): CacheEntry<T> | undefined;
    /**
     * @ru Сохраняет значение в кэш и отменяет ожидающую фабрику для этого ключа.
     * @en Stores a value and invalidates a pending factory for this key.
     * @param key - Cache key.
     * @param data - Data.
     * @param meta - ETag and/or LastModified.
     */
    set(key: string, data: T, meta?: {
        etag?: string;
        lastModified?: string;
    }): void;
    /**
     * @ru Получает значение из кэша или создаёт через фабрику (с дедупликацией concurrent-запросов).
     * @en Gets from cache or creates via factory (with concurrent request deduplication).
     * @param key - Cache key.
     * @param factory - Factory function.
     * @param meta - ETag and/or LastModified.
     * @returns Cached or freshly created value.
     */
    getOrSet(key: string, factory: () => Promise<T> | T, meta?: {
        etag?: string;
        lastModified?: string;
    }): Promise<T>;
    /**
     * @ru Проверяет наличие ключа в кэше.
     * @en Checks if a key exists and is not expired.
     * @param key - Cache key.
     * @returns True if the key exists and is not expired.
     */
    has(key: string): boolean;
    /**
     * @ru Удаляет запись и инвалидирует ожидающую фабрику для ключа.
     * @en Deletes an entry and invalidates a pending factory for the key.
     * @param key - Cache key.
     * @returns True if the entry existed and was deleted.
     */
    delete(key: string): boolean;
    /**
     * @ru Очищает кэш и инвалидирует все ожидающие фабрики.
     * @en Clears the cache and invalidates all pending factories.
     */
    clear(): void;
    /**
     * @ru Удаляет истёкшие записи.
     * @en Removes expired entries.
     * @returns Number of removed entries.
     */
    prune(): number;
    /**
     * @ru Текущее количество неистёкших записей в кэше.
     * @en Current number of non-expired cache entries.
     */
    get size(): number;
    private store;
    private invalidatePending;
    private isExpired;
    private expire;
    private evict;
    private refreshEventListenerState;
    private append;
    private unlink;
    private moveToNewest;
}
//# sourceMappingURL=cacher.d.ts.map
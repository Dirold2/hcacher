/**
 * @ru События, отправляемые {@link CacheManager}.
 * @en Events emitted by {@link CacheManager}.
 *
 * Each property contains the tuple of arguments passed to listeners for that event.
 *
 * @typeParam T - The type of the cached value.
 */
export type CacheEvents<T> = {
    /**
     * @ru Отправляется после успешного поиска в кэше.
     * @en Emitted after a successful cache lookup.
     */
    hit: [key: string, data: T];
    /**
     * @ru Отправляется при отсутствии записи или обнаружении истёкшей записи.
     * @en Emitted when a cache lookup misses or finds an expired entry.
     */
    miss: [key: string];
    /**
     * @ru Отправляется после сохранения записи.
     * @en Emitted after an entry is stored.
     */
    set: [key: string, data: T];
    /**
     * @ru Отправляется перед удалением записи из переполненного кэша.
     * @en Emitted before an entry is removed because the cache is full.
     */
    evict: [key: string, data: T];
    /**
     * @ru Отправляется при удалении записи после истечения TTL.
     * @en Emitted when an entry is removed because its TTL elapsed.
     */
    expire: [key: string, data: T];
};
//# sourceMappingURL=index.d.ts.map
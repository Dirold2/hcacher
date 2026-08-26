/**
 * @ru Кэшированное значение и его необязательные метаданные HTTP-валидации.
 * @en A cached value and its optional HTTP validation metadata.
 *
 * @typeParam T - The type of the cached value.
 */
export interface CacheEntry<T> {
  /**
   * @ru Кэшированное значение.
   * @en The cached value.
   */
  data: T;
  /**
   * @ru Необязательный тег сущности для HTTP-валидации.
   * @en An optional entity tag used for HTTP validation.
   */
  etag?: string;
  /**
   * @ru Необязательная дата последнего изменения для HTTP-валидации.
   * @en An optional last-modified timestamp used for HTTP validation.
   */
  lastModified?: string;
}

/**
 * @ru Параметры конфигурации для {@link CacheManager}.
 * @en Configuration options for {@link CacheManager}.
 */
export interface CacheManagerOptions {
  /**
   * @ru Включает или отключает кэширование. По умолчанию `true`.
   * @en Whether caching is enabled. Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * @ru Время жизни записи в миллисекундах. По умолчанию `Infinity`.
   * @en Entry lifetime in milliseconds. Defaults to `Infinity`.
   */
  ttl?: number;
  /**
   * @ru Максимальное количество записей. По умолчанию `Infinity`.
   * @en Maximum number of entries. Defaults to `Infinity`.
   */
  maxSize?: number;
  /**
   * @ru Перемещает ли чтение запись в конец очереди. По умолчанию `false` (FIFO).
   * @en Whether reads move entries to the newest position. Defaults to `false` (FIFO).
   */
  touchOnGet?: boolean;
}

/**
 * @ru Внутренняя запись кэша с данными и временем истечения.
 * @en Internal cache entry containing the data and expiration time.
 *
 * @typeParam T - The type of the cached value.
 */
export interface InternalEntry<T> {
  /**
   * @ru Данные и метаданные кэшированной записи.
   * @en Cached data and metadata.
   */
  entry: CacheEntry<T>;
  /**
   * @ru Время истечения записи в миллисекундах Unix epoch.
   * @en Expiration time as milliseconds since the Unix epoch.
   */
  expiresAt: number;
}

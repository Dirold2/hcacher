export interface CacheEntry<T> {
  data: T;
  etag?: string;
  lastModified?: string;
}

export interface CacheManagerOptions {
  enabled?: boolean;
  ttl?: number;
  maxSize?: number;
  touchOnGet?: boolean;
}

export interface InternalEntry<T> {
  entry: CacheEntry<T>;
  expiresAt: number;
}

export type CacheEvents<T> = {
  hit: [key: string, data: T];
  miss: [key: string];
  set: [key: string, data: T];
  evict: [key: string, data: T];
  expire: [key: string, data: T];
};

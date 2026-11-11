import { afterEach, describe, expect, it, vi } from "vitest";
import { CacheManager } from "../src/index.js";

describe("CacheManager", () => {
  afterEach(() => vi.useRealTimers());

  it("stores, reads, checks, deletes, and clears entries", () => {
    const cache = new CacheManager<string>();
    cache.set("key", "value", { etag: "etag-1", lastModified: "yesterday" });

    expect(cache.get("key")).toBe("value");
    expect(cache.getEntry("key")).toEqual({
      data: "value",
      etag: "etag-1",
      lastModified: "yesterday",
    });
    expect(cache.has("key")).toBe(true);
    expect(cache.size).toBe(1);
    expect(cache.delete("key")).toBe(true);
    expect(cache.delete("key")).toBe(false);

    cache.set("a", "1");
    cache.set("b", "2");
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("updates an existing entry without increasing its size", () => {
    const cache = new CacheManager<string>();
    cache.set("key", "first");
    cache.set("key", "second");

    expect(cache.get("key")).toBe("second");
    expect(cache.size).toBe(1);
  });

  it("expires entries at their exact TTL deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const cache = new CacheManager<string>({ ttl: 100 });
    cache.set("key", "value");

    vi.setSystemTime(1_099);
    expect(cache.get("key")).toBe("value");
    vi.setSystemTime(1_100);
    expect(cache.get("key")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("prunes expired entries and returns the removed count", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const cache = new CacheManager<string>({ ttl: 100 });
    cache.set("a", "1");
    cache.set("b", "2");
    vi.setSystemTime(1_100);

    expect(cache.prune()).toBe(2);
    expect(cache.prune()).toBe(0);
  });

  it("uses FIFO by default and preserves overwrite order", () => {
    const cache = new CacheManager<string>({ maxSize: 2 });
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.get("a")).toBe("1");
    cache.set("a", "updated");
    cache.set("c", "3");

    expect(cache.has("a")).toBe(false);
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
  });

  it("keeps capacity when an eviction listener reinserts the evicted key", () => {
    const cache = new CacheManager<number>({ maxSize: 1 });
    cache.set("a", 1);
    cache.on("evict", (key) => {
      if (key === "a") cache.set("a", 2);
    });
    expect(() => cache.set("b", 3)).toThrow("Eviction callback refilled the cache");
    expect(cache.size).toBe(1);
    expect(cache.get("a")).toBe(2);
    expect(cache.has("b")).toBe(false);
  });

  it("rejects recursive eviction without corrupting the cache", () => {
    const cache = new CacheManager<number>({ maxSize: 1 });
    cache.set("a", 1);
    cache.on("evict", () => {
      cache.set("nested", 2);
      cache.set("recursive", 3);
    });
    expect(() => cache.set("b", 4)).toThrow("during an eviction callback");
    expect(cache.size).toBe(1);
    expect(cache.get("nested")).toBe(2);
    cache.removeAllListeners();
    cache.set("next", 5);
    expect(cache.size).toBe(1);
    expect(cache.get("next")).toBe(5);
  });

  it("uses strict LRU when touchOnGet is enabled", () => {
    const cache = new CacheManager<string>({ maxSize: 2, touchOnGet: true });
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.get("a")).toBe("1");
    cache.set("c", "3");

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("moves overwrites to newest in strict LRU mode", () => {
    const cache = new CacheManager<string>({ maxSize: 2, touchOnGet: true });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("a", "updated");
    cache.set("c", "3");

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
  });

  it("returns cached values without calling getOrSet factory", async () => {
    const cache = new CacheManager<string>();
    const factory = vi.fn(() => "created");
    cache.set("key", "cached");

    await expect(cache.getOrSet("key", factory)).resolves.toBe("cached");
    expect(factory).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent getOrSet factories", async () => {
    const cache = new CacheManager<string>();
    let resolveFactory!: (value: string) => void;
    const factory = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFactory = resolve;
        }),
    );

    const first = cache.getOrSet("key", factory);
    const second = cache.getOrSet("key", factory);
    await Promise.resolve();
    resolveFactory("created");

    await expect(first).resolves.toBe("created");
    await expect(second).resolves.toBe("created");
    expect(factory).toHaveBeenCalledTimes(1);
    expect(cache.get("key")).toBe("created");
  });

  it("does not store a factory result after deletion", async () => {
    const cache = new CacheManager<string>();
    let resolveFactory!: (value: string) => void;
    const pending = cache.getOrSet(
      "key",
      () =>
        new Promise<string>((resolve) => {
          resolveFactory = resolve;
        }),
    );
    await Promise.resolve();

    expect(cache.delete("key")).toBe(false);
    resolveFactory("late value");
    await expect(pending).resolves.toBe("late value");
    expect(cache.get("key")).toBeUndefined();
  });

  it("keeps newer getOrSet requests after set, delete, or clear invalidation", async () => {
    for (const invalidate of [
      (cache: CacheManager<string>) => {
        cache.set("key", "explicit");
        cache.delete("key");
      },
      (cache: CacheManager<string>) => cache.delete("key"),
      (cache: CacheManager<string>) => cache.clear(),
    ]) {
      const cache = new CacheManager<string>();
      const resolvers: Array<(value: string) => void> = [];
      const factory = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolvers.push(resolve);
          }),
      );

      const first = cache.getOrSet("key", factory);
      await Promise.resolve();
      invalidate(cache);
      const second = cache.getOrSet("key", factory);
      await Promise.resolve();

      resolvers[0]("stale");
      await expect(first).resolves.toBe("stale");
      expect(cache.get("key")).toBeUndefined();

      resolvers[1]("fresh");
      await expect(second).resolves.toBe("fresh");
      expect(cache.get("key")).toBe("fresh");
      expect(factory).toHaveBeenCalledTimes(2);
    }
  });

  it("does not retain invalidation generations after set, delete, or clear", async () => {
    const cache = new CacheManager<string>();
    const resolvers: Array<(value: string) => void> = [];
    const requests: Array<Promise<string>> = [];

    for (let index = 0; index < 100; index += 1) {
      const key = `key-${index}`;
      requests.push(
        cache.getOrSet(
          key,
          () =>
            new Promise<string>((resolve) => {
              resolvers.push(resolve);
            }),
        ),
      );
    }
    await Promise.resolve();

    cache.set("key-0", "explicit");
    cache.delete("key-1");
    cache.clear();
    for (const resolve of resolvers) resolve("late");
    await expect(Promise.all(requests)).resolves.toHaveLength(100);

    expect(cache.size).toBe(0);
    expect(cache).not.toHaveProperty("generations");
  });

  it("does not store or read values when disabled", async () => {
    const cache = new CacheManager<string>({ enabled: false });
    const factory = vi.fn(() => "created");
    cache.set("key", "value");

    expect(cache.get("key")).toBeUndefined();
    expect(cache.has("key")).toBe(false);
    expect(cache.size).toBe(0);
    await expect(cache.getOrSet("key", factory)).resolves.toBe("created");
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("emits hit, miss, set, expire, and evict events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const cache = new CacheManager<string>({ maxSize: 1, ttl: 100 });
    const events = {
      hit: vi.fn(),
      miss: vi.fn(),
      set: vi.fn(),
      evict: vi.fn(),
      expire: vi.fn(),
    };

    cache.on("hit", events.hit);
    cache.on("miss", events.miss);
    cache.on("set", events.set);
    cache.on("evict", events.evict);
    cache.on("expire", events.expire);
    cache.set("a", "1");
    expect(cache.get("a")).toBe("1");
    expect(cache.get("missing")).toBeUndefined();
    cache.set("b", "2");
    vi.setSystemTime(1_100);
    expect(cache.get("b")).toBeUndefined();

    expect(events.set).toHaveBeenCalledTimes(2);
    expect(events.hit).toHaveBeenCalledWith("a", "1");
    expect(events.miss).toHaveBeenCalledWith("missing");
    expect(events.evict).toHaveBeenCalledWith("a", "1");
    expect(events.expire).toHaveBeenCalledWith("b", "2");
  });

  it("supports listener removal and method chaining", () => {
    const cache = new CacheManager<string>();
    const listener = vi.fn();

    expect(cache.on("hit", listener)).toBe(cache);
    expect(cache.off("hit", listener)).toBe(cache);
    expect(cache.removeAllListeners()).toBe(cache);
    cache.set("key", "value");
    cache.get("key");

    expect(listener).not.toHaveBeenCalled();
  });
});

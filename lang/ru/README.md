# hcacher

Гибкий менеджер кэша в памяти с опциональным TTL, FIFO- или строгой LRU-эвикцией и шиной событий.

> [English](https://github.com/dirold2/hcacher) | Русский

[![версия npm](https://img.shields.io/npm/v/hcacher)](https://www.npmjs.com/package/hcacher)
[![загрузки npm](https://img.shields.io/npm/dm/hcacher)](https://www.npmjs.com/package/hcacher)
[![лицензия](https://img.shields.io/npm/l/hcacher)](../../LICENSE)
[![typescript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)

## Установка

```sh
npm install hcacher
```

```sh
pnpm install hcacher
```

```sh
bun install hcacher
```

## Использование

```ts
import { CacheManager } from "hcacher";

// Базовое использование
const cache = new CacheManager<string>({ maxSize: 100, ttl: 60_000 });
cache.set("key", "value");
console.log(cache.get("key")); // "value"

// Фабрика с дедупликацией параллельных запросов
const result = await cache.getOrSet("key", async () => {
  const res = await fetch("https://api.example.com/data");
  return res.json();
});

// События
cache.on("hit", (key, data) => console.log(`Попадание в кэш: ${key}`));
cache.on("miss", (key) => console.log(`Промах кэша: ${key}`));
cache.on("evict", (key, data) => console.log(`Удалено из-за лимита: ${key}`));
cache.on("expire", (key, data) => console.log(`Срок истёк: ${key}`));
```

## API

### `new CacheManager<T>(options?)`

| Параметр     | По умолчанию | Описание                                                                              |
| ------------ | ------------ | ------------------------------------------------------------------------------------- |
| `maxSize`    | `Infinity`   | Максимальное число записей — положительное safe integer; `Infinity` отключает эвикцию |
| `ttl`        | `Infinity`   | Время жизни записи в миллисекундах; `Infinity` отключает истечение срока              |
| `touchOnGet` | `false`      | Включает строгую LRU; иначе ограниченный кэш использует FIFO                          |
| `enabled`    | `true`       | Включает или отключает кэширование                                                    |

```ts
// Значения по умолчанию: неограниченный кэш без истечения записей.
new CacheManager<string>();

// По умолчанию ограниченный кэш использует FIFO: чтение и перезапись
// сохраняют исходный порядок вставки.
new CacheManager<string>({ maxSize: 100, ttl: 30_000 });

// Включить строгую LRU: чтение и перезапись перемещают запись в конец очереди.
new CacheManager<string>({ maxSize: 100, ttl: 30_000, touchOnGet: true });

// Также поддерживаются позиционные аргументы.
new CacheManager<string>(100, 30_000, true, true);
```

### Поведение эвикции

- При `maxSize: Infinity` (значение по умолчанию) записи не удаляются из-за ограничения размера.
- При конечном `maxSize` и `touchOnGet: false` (значение по умолчанию) первой удаляется самая старая добавленная запись (FIFO). Чтение или перезапись существующей записи не меняет её позиции.
- При конечном `maxSize` и `touchOnGet: true` первой удаляется наименее недавно использованная запись (строгая LRU). Чтение или перезапись существующей записи перемещает её в конец очереди.

### Методы

- **`get(key)`** — получает значение по ключу; при промахе или истечении срока возвращает `undefined`.
- **`getEntry(key)`** — получает полную запись с метаданными `etag`/`lastModified`.
- **`set(key, data, meta?)`** — сохраняет значение с необязательными `etag`/`lastModified`.
- **`getOrSet(key, factory, meta?)`** — получает значение или создаёт его через фабрику; дедуплицирует параллельные вызовы для одного ключа.
- **`has(key)`** — проверяет, существует ли ключ и не истёк ли срок его записи.
- **`delete(key)`** — удаляет запись и инвалидирует ожидающую фабрику для этого ключа.
- **`clear()`** — удаляет все записи и инвалидирует все ожидающие фабрики.
- **`prune()`** — удаляет истёкшие записи и возвращает их количество.
- **`size`** — текущее количество неистёкших записей.

### События

| Событие  | Аргументы     | Описание                                             |
| -------- | ------------- | ---------------------------------------------------- |
| `hit`    | `(key, data)` | Попадание в кэш                                      |
| `miss`   | `(key)`       | Промах кэша                                          |
| `set`    | `(key, data)` | Запись сохранена                                     |
| `evict`  | `(key, data)` | Запись удалена из-за переполнения ограниченного кэша |
| `expire` | `(key, data)` | Срок действия записи истёк (TTL)                     |

## Лицензия

MIT

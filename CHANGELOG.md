# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `prune()` to remove expired entries explicitly and report how many were removed.

### Changed

- `size` now excludes expired entries.
- `getOrSet()` bypasses cache lookup and request deduplication when caching is disabled.
- `delete()`, `clear()`, and manual `set()` now invalidate an in-flight factory for the same key.
- Cache configuration validates `maxSize` and `ttl` values.
- Event listener storage no longer uses `any` or `Function`.
- Package `module` metadata points to the published ESM bundle.
- Development dependencies were updated.

### Fixed

- Pending factories can no longer restore a value after its key is deleted or the cache is cleared.
- A completed older factory can no longer remove a newer pending request for the same key.
- `getOrSet()` correctly treats a cached `undefined` as a cache hit.
- TTL expires at its exact deadline.
- Expired entries are pruned before LRU eviction.

## [0.1.0] - 2026-07-01

### Added

- Initial release with in-memory caching, TTL, LRU eviction, request deduplication, and cache events.

# Changelog

## Unreleased

### Fixed
- `package.json` version was stuck at `1.0.0` while `src/version.ts` (the value actually reported by the running worker) was already at `2.0.0`. Bumped `package.json` to `2.0.0` to match.
- Dropped the `Updated at` timestamp line from the `mal_update_anime_status` and `mal_update_manga_status` tool responses. It echoed a value nothing consumes and only added tokens to every write-confirmation reply. `Status`, `Score`, and episodes/volumes/chapters counts are kept since they confirm what MAL actually persisted (which can differ from the request, e.g. clamped values).

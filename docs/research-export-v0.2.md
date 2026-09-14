# Research export contract — 0.2

Architect: Astra. Implementer: Sol. 2026-09-13. Recovered from the accepted conversation specification after the Documents copy became unreadable. This is a semantic reconstruction, not a claim of byte-identical recovery. Version 0.1 remains supported and unchanged. The Phase 4 review fixes below refine provenance handling and validation.

## Scope and encoding

One frozen real-catalog exploration session is exported as one UTF-8 `bundle.json`. Browser download uses a Blob. CLI writes this file into a previously unused directory and refuses overwrite. Research accepts either the existing 0.1 directory or a 0.2 JSON file. No ZIP dependency, service, audio bytes, artwork, account IDs, free text, human judgments, or LLM calls.
Top-level keys are exactly `manifest`, `catalog`, `cases`, `events`, `human_ratings`, `llm_predictions`. Final two arrays must be empty. Catalog, cases and events are arrays. Reject missing/extra keys, duplicate decoded JSON keys, unsupported schema, non-finite numbers and wrong types. Boolean is not an integer. Retain the strict 0.1 JSON parser and real Gregorian UTC timestamp rules.
IDs, names and URLs below are nonempty strings. SHA-256 values are 64 lowercase hex digits. Source paths are relative POSIX paths without `..`.

## Manifest

All keys required:

| Key | Constraint |
|---|---|
| schema_version | `"0.2"` |
| bundle_id | nonempty string |
| created_at | real UTC ISO timestamp, Z ending; same rules as 0.1 |
| purpose | `"engineering_demo"` |
| data_kind | `"real_catalog"` |
| session_id | locally generated opaque string; no identity/account data |
| producer | same project/commit/dirty/source_files shape as 0.1 |
| provider | exactly `{"id":"genre-jaccard-v1","config":{}}` |
| dataset | exactly `{"id":"sonder-fma-40-v1","sha256":<catalog hash>}` |
| case_count | positive integer, equals cases.length |
| event_count | nonnegative integer, equals events.length |
| cases_sha256 | canonical cases array hash |
| events_sha256 | canonical events array hash |

Canonical hashing recursively sorts object keys by Unicode code point, preserves array order, uses compact JSON, UTF-8, literal non-ASCII characters, standard control escapes, no slash escaping and no trailing newline. Hashed arrays contain strings, integers, booleans and null, not floats. Catalog hash covers the canonical catalog array. Verify Japanese text/control escapes between TS and Python. Hashes show consistency, not authenticity.
Both validators recompute all three hashes. Rank validation uses the catalog inside the bundle, not unrelated runtime metadata. Validate before returning/exporting any bundle, including an externally supplied bundle argument.

## Build provenance and review fixes

Compute provenance before build, not at browser export. Record commit/dirty and relevant source hashes: provider, catalog, exporter, parser, domain, package lock and sources that generate cases/events (store, session, composition and affected UI). Exclude the generated provenance asset itself; do not hash the entire repo. Dev builds must regenerate after source changes. Catalog hash at export must match build provenance.
Freeze catalog hash and producer/source provenance at session creation. Missing or mismatching catalog/source hashes require a new session; reject continued use and export. Do not silently relabel old cases as generated from a newer catalog or source. Test unchanged-build restore, metadata-only change and event-code-only change. The saved generation provenance is the evidence for existing cases.

## Catalog

Exactly 40 entries sorted by numeric FMA ID, no duplicate IDs. Selection is fixed by `fma40-audit.json`; changed data needs a new dataset ID/hash.
Each entry has exactly:

- `id`: `fma-` followed by six decimal digits.
- `title`: string.
- `artists`: nonempty array of objects with only `name`: string.
- `genre_ids`: nonempty ascending unique positive integer array; FMA direct genres, not genres_all.
- `genre_names`: one nonempty name per genre_id in matching order; one ID maps to one name across catalog.
- `source_url`: HTTPS original FMA track URL from MP3 tag.
- `license_url`: HTTPS URL in the audited allowlist: CC BY 3.0 or CC BY 3.0 US.
- `audio_sha256`: checksum of the audited MP3 asset.
- `preview_duration_ms`: positive integer measured from the clip, not full-track duration.

Reader does not fetch URLs or audio. UI credits retain supplied album/composer/copyright notices from the acquisition manifest; those are not 0.2 LLM input fields.

## Cases

Exact keys: `case_id`, `participant_id`, `session_id`, `requested_at`, `input`, `recommendations`, `presentation`.
case_id is unique, participant_id is null, session_id equals manifest.session_id. requested_at is valid UTC <= created_at. Preserve request order.
Input retains four 0.1 keys: current_track_id, session_path, explored_track_ids, limit. Every ID resolves in catalog. Path is nonempty, unique and ends at current. Exclusion IDs are unique and include current and all path IDs. Limit is 8 for a one-track seed path, otherwise 7.
explored_track_ids means **all existing graph node track IDs**, including unclicked candidates. It is an exclusion set, not proof of listening or liking. CLI fixture must also add all returned candidate IDs after every request; only the chosen seed is appended to session_path. Three requests produce exclusion sizes 1/9/16 and 23 unique graph tracks.
Recommendations contain 0..limit entries with exactly rank, track_id, shared_genre_count, union_genre_count. Ranks are consecutive from 1. Track IDs are unique, in catalog, and absent from exclusion set. Union is a positive integer, shared is integer 0..union.
Compute intersection/union from seed and candidate direct genres. Rank by Jaccard descending using integer cross-multiplication, ties by numeric FMA ID ascending. Return min(limit, eligible_count) candidates, including zero-overlap if needed. Reader independently recomputes all eligible ranks/counts. UI labels zero-overlap as cross-genre exploration, not similarity.
presentation is exactly `{"mode":"graph_committed"}` for UI, or `{"mode":"not_presented"}` for an offline fixture. Do not mix modes. Graph committed means nodes entered store state, not that a human saw/heard them.
Freeze input before the provider call. Record the returned candidates only when accepted by the stale-response guard, exactly as committed to graph. Unexpected filtering/reranking is a contract error for this local fixed provider. Superseded requests and returns to already expanded nodes do not create cases.
Exhaustion is valid with zero candidates. No completed cases means export disabled. Do not reconstruct past request input from current state.

## Events

Exact keys: event_id, session_id, case_id, track_id, occurred_at, type, value. Event IDs unique. session_id matches manifest. case_id references an existing case; track_id is its seed or recommendation. Associate via the node's originating case, not the latest request. Initial seed uses first case. Exclude pre-case/unassociated events without inventing an association.
occurred_at is real UTC >= associated requested_at and <= created_at. Preserve append order; do not infer event chronology from wall-clock sorting if the clock moved backward.
Types: node_impression, node_expand, preview_start, preview_pause, preview_complete, like, save. value is boolean for like/save (true added, false removed), null otherwise. No free-form detail.
Use actual viewport observation and audio callbacks. Deduplicate impressions by (case_id, track_id). Neither impression nor audio callback proves attention/listening. Like/save are not human research ratings.
Record prospectively once cases exist. Do not backfill legacy events. not_presented bundles require empty events.

## Entry points and persistence

UI export downloads one validated JSON file. Later Like/Save must not modify earlier inputs. Cases persist with versioned session state. Legacy or dataset/provider/build-mismatching sessions require fresh start; disable export with an explanation. Never convert mock IDs into real IDs.
Keep mock CLI/tests. Real and mock selection use existing composition boundary. CLI: `npm run export:research -- --dataset fma40 --output <unused-dir>`; omitted --dataset retains 0.1.
Research: `python -B studies/music-evaluator/validate_export.py <bundle.json>`.

## Acceptance

1. Fixed real cases exported by TS are accepted independently by Python; catalog/case/event hashes agree, including Unicode/control escapes.
2. Same fixed IDs/timestamps/inputs produce byte-identical output. Live sessions are not promised byte-identical.
3. Reject bad hashes, duplicate decoded keys/IDs, missing/extra keys, wrong types/dates, wrong catalog size, unknown IDs, altered ranks/counts and omitted eligible candidates. Recompute hashes in structural corruption tests so hash checks do not hide failures.
4. Reject nonempty human/LLM arrays, unknown event types, invalid like/save values/references and presentation/event contradictions.
5. Test exhaustion, stale responses, returning to branches, restore, dataset/source changes and later reactions preserving earlier cases.
6. Preserve 0.1 tests. Run test/typecheck/build plus browser checks for previews, attribution, two expansions, reactions, reload and export. State unverified scopes. Layout tests are not browser FPS evidence.

Reuse existing parsers, provider, player and session persistence. No new database, auth service, shared SDK, ZIP library or LLM invocation.

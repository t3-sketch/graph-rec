# Implementation State

Last updated: 2026-09-13 (Asia/Tokyo). This repository file is the handoff source of truth. Update it after meaningful changes, verification, and before stopping. Original complete brief: `.codex/PRODUCT_REQUEST.md`.

## Goal

Build Sonder, a polished song-level spatial music discovery MVP directly in this repository. Search a seed, show eight recommendations, expand chosen nodes with seven forward-growing children, preserve branches and draggable positions, inspect/preview songs, restore locally, and browse mock music-service playlists. Keep recommendation and layout replaceable.

Priority explicitly set by user: **1. UI smoothness 2. speed 3. everything else**. No recommendation ML or real account integration in this iteration.

## Current status

2026-09-13 publication checkpoint (supersedes earlier review/publication status below): Phase 1–3 passed Astra re-review. Engineering tests 9/9 and typecheck passed; Research tests 10/10 passed. Build/browser were not repeated in re-review. Public repository https://github.com/t3-sketch/graph-rec was created with user approval; implementation checkpoint `45b436d` is on main. Phase 4 is PLANNING_ONLY. The historical entries below retain their original verification scope.

- Phase 3 (2026-09-13): offline mock export implemented. Astra P2 fixes: JSON keys are decoded before duplicate detection (`\u0063ase_id` counts as `case_id`); `created_at` / `requested_at` must be real UTC dates (Gregorian month length, leap years, hours 0–23, minutes/seconds 0–59). Awaiting re-review. Do not start Phase 4. Mock export is integration_test / synthetic only.
- Architecture handoff (2026-09-13): overall Phase 1–2 passed Astra re-review. Phase 3 contract remains `docs/research-export.md` version 0.1.

- Phase 1 inventory (2026-09-13): source already implements anchored D3 floating motion (`src/graph/floatingGraph.ts`) and filament repulsion routing (`src/graph/filaments.ts`), wired from `MusicGraph.tsx`. `forceEntrance.ts` is absent. README matched the source; this file's bounded-entrance / "in progress replacement" wording was stale and is corrected here.
- Provider boundary unchanged: `src/services/dependencies.ts` still injects `MockRecommendationProvider` and `DirectionalPlacementStrategy`.
- Git initialized in this folder on 2026-09-13. No remote, no first commit. Do not create GitHub until visibility is decided.
- Earlier browser verification covered circular artwork, branch restore, and drag persistence. It does not automatically validate the current floating/filament loop. That browser pass was not re-run in Phase 1.
- Local preview: http://localhost:3000, serving the verified static production build from `~/.cache/sonder-runtime/check/out` with Python HTTP server. Confirm process/URL on future resumes.
- Repository is the source of truth. `.codex/SOURCE_SNAPSHOT.json` records the app source and assets copied for final verification.

## Completed

Implemented; verification scope is recorded below:
- Next.js App Router + strict TypeScript + React Flow + Zustand scaffold and npm lockfile.
- Provider-independent track/session/event types and recommendation/placement interfaces.
- Mock catalog (640 fictional tracks); original local nine-cover image atlas and three 12-second synthesized WAV previews.
- Search with keyboard results; seed creation; branch-preserving expansion; explicit active path.
- Directional deterministic placement, collision scan, stale recommendation response suppression.
- Custom artwork nodes, pan/zoom/drag, fit/recenter and responsive styling; anchored D3 floating motion, filament repulsion routing, circular artwork and curved OrbitEdge filaments.
- Inspector, separate preview player, like/save actions, external search links.
- Mock Spotify/Apple Music connections and playlist seed picker.
- Versioned localStorage session/collection persistence with debounced writes and pagehide flush.
- Node test source for branches, provider swapping, serialization, stale requests, and 500-node placement.
- Original request copied into repository for future sessions.

## In progress

- Phase 3 implementation is done and waiting for Astra review. Do not start Phase 4.
- Source-complete for floating motion and filament routing. Browser re-verification of drag, persistence, reduced-motion, and 500-node FPS is not claimed. Phase 3 did not change UI and did not re-run a browser pass.

## Not started

Deliberately outside this MVP:
- Real recommendation models, scores, Spotify OAuth and Apple MusicKit integration.
- Multi-session cloud history, minimap and exploration slider.
- Browser frame-rate benchmark at 500 nodes and physical Mac trackpad/touchscreen testing. Do not infer these from the placement test.

## Important architecture decisions

- `src/services/dependencies.ts` is the composition root: swap RecommendationProvider and GraphPlacementStrategy here without modifying graph UI.
- `src/services/recommendation.ts` contains only mock recommendation behavior; coordinates never mean ranking or serendipity.
- Track IDs are app IDs (`sonder-*`), external IDs are aliases. Optional scores must stay optional.
- `src/graph/session.ts` computes the current ancestry path; all branches live in session.nodes/edges.
- Click means exploration, never implicit like. Like/save are separate actions.
- D3 floating offsets render around saved anchors and do not overwrite session positions. Filament routing is soft collision, not a planar-graph solver. Drag/keyboard pins a node; reduced-motion and hidden tabs skip the loop. Do not add perpetual physics libraries without measured need.
- Drag motion stays local to React Flow; persist positions after gestures. Do not add perpetual physics or animation libraries without measured need.
- `src/services/musicProviders.ts` exposes one frontend interface but allows Spotify OAuth and Apple MusicKit to use different authorization mechanics. Current implementations are explicitly demo only.
- Next.js uses static export (`out/`). No server auth credentials or provider secrets exist.
- Plain CSS is used; Tailwind/Motion are unnecessary for current UI.

## Files created / modified

- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `.gitignore`: infrastructure; start now serves static out/ using Python HTTP server.
- `AGENTS.md`, `CLAUDE.md`: framework-generated instructions; read local Next docs before framework changes.
- `src/app/{layout,page}.tsx`, `src/app/globals.css`: entrypoints and styling.
- `src/domain/types.ts`: independent track, graph, session, event, recommendation and placement contracts.
- `src/services/{dependencies,recommendation,musicProviders}.ts`: provider composition and mock integrations.
- `src/services/webmcp.ts`: removed September 12; unrequested capability omitted.
- `src/graph/{placement,session,floatingGraph,filaments}.ts`: layout, restoration/path, anchored floating motion and filament routing.
- `src/store/{exploration,player}.ts`: state and actions.
- `src/mocks/tracks.ts`: fictional searchable catalog.
- `src/components/{Explorer,MusicGraph,SongNode,OrbitEdge,Artwork,MusicSearch,TrackInspector,MiniPlayer,LibraryPanel}.tsx`: UI.
- `public/album-atlas.jpg`, `public/audio/preview-{0,1,2}.wav`: local generated media.
- `tests/exploration.test.ts`: three passing behavior/placement/force-convergence tests.
- `src/research-export/{json,schema,validate,exportBundle}.ts`, `scripts/export-research.ts`, `tests/research-export.test.ts`: Phase 3 mock bundle export (schema 0.1).
- `package.json`: added `export:research`.
- `scripts/isolated-run.py`: also syncs `scripts/` so isolated test/typecheck/build can hash the CLI.
- `scripts/isolated-run.py`, `.codex/SOURCE_SNAPSHOT.json`: reproducible execution workaround and source hash inventory.
- `README.md`: run instructions, demo limits and extension points.
- `.openai/hosting.json`: earlier local Site registration, excluded from Git. Never create another Site for this checkout without checking this local registration.
- `.codex/{IMPLEMENTATION_STATE,PRODUCT_REQUEST}.md`: recovery handoff and original scope.

## Verification status

Phase 3 (2026-09-13), isolated checkout `python3 scripts/isolated-run.py`:
- test: 9/9 PASS (existing 4 + research-export 5). Placement check 33ms. No browser claim.
- typecheck: PASS.
- build: PASS. Next.js 16.3.4 webpack static export; compiled 1.6s, TypeScript 1.4s. Existing isolated workspace-root lockfile warning remains.
- CLI: `npm run export:research -- --output <unused-dir>` wrote schema 0.1, 2 cases, 15 recommendations. Seed `sonder-1` limit 8 then `sonder-2` limit 7. `human-ratings.jsonl` and `llm-predictions.jsonl` are 0 bytes.
- Second unused dir: cases bytes and SHA-256 identical (`6ebfb299a5c5e2fb84b46fdd1e14d88a7384bb1375d58ab755b7c15a40f23128` on this run; hash is of cases bytes and will change if catalog or serializer changes).
- Re-run to existing dir refused; four file hashes unchanged.
- Research `python -B studies/music-evaluator/validate_export.py` on the live bundle: `schema_version=0.1 case_count=2 recommendation_count=15`.
- Research unit tests: 9/9 PASS. Structural failures still fail after hash rewrite.

Latest D3 texture revision (September 13):
- Build and TypeScript PASS on final source (webpack 1.5s, TypeScript 1.1s). Existing harmless isolated workspace-root warning remains.
- Tests 3/3 PASS, including force convergence within 72 ticks and no mutation of persisted nodes. 500-node placement 32ms (not browser FPS).
- Production browser: circular artwork and quadratic edges inspected; Glass Cities expands 9 to 16 nodes; branch restores after reload; no console errors/warnings.
- Manual drag Distant Bloom from (-376.704,-306.503) to (-495.562,-367.631); reload restores exact new position.
- Mid-animation drag, physical touch and 500-node FPS were not separately measured. Reduced-motion skips D3 entrance by media query.

Earlier MVP verification:

- Typecheck: PASS September 13, including final changes, as part of production build in the identical isolated source copy.
- Lint: no lint configured; no lint pass claimed.
- Build: PASS September 13. Next.js 16.3.4 webpack static export; compiled in 3.1s, TypeScript in 1.9s. Non-blocking inferred workspace-root warning due to isolated-copy parent lockfile.
- Tests: PASS September 13, 2/2. Branching/provider swap/stale responses/serialization and deterministic collision-free placement through 500 nodes. Placement check 31ms; whole runner 141ms. This is not browser FPS.
- Browser September 12: search seed (9 nodes), first expansion (16), alternative branch (23), manual drag, exact position restoration, saved flag restoration, audio playback and completion, Spotify + Apple Music demo connections, playlist seeding all passed. Browser console had no errors/warnings.
- UI bug fixed during browser testing: animated node wrappers distorted React Flow handle measurements, collapsing edges. Handles now sit outside animated content; connection lines verified.
- Responsive: 1440×900 desktop and 390×844 mobile inspected. Resize recenter verified (active node inside viewport); mobile external links visible, no horizontal overflow. Physical touch/pinch gesture simulation not performed.
- September 13 production browser checks: Enter expands to 16 nodes; arrow-key move changes x from 0 to 5; reload restores exact (5, -222.3) position. Zoom changes scale 0.290587→0.348705, canvas pan moves translation by (50,35).
- Production preview avoids the stalled development asset-loading path. Core app operations are fully local except optional font loading and clicked external music-service links.
- Original Documents dependency files stalled in OS reads/rename (cause unproven). Fresh dependency install and a byte-copied checkout under `~/.cache/sonder-runtime/check` run normally. Original node_modules was NOT moved; attempted rename was cancelled.
- Reproducible workaround: `python3 scripts/isolated-run.py dev|typecheck|test|build|start`. Script syncs source and records `.codex/SOURCE_SNAPSHOT.json`. Restart/sync after repository edits.

## Known issues

- Memoized graph and narrow store subscriptions; Map-based synchronization; telemetry does not recalculate edges. No claim of measured 500-node browser FPS.
- Initial camera fits after children initialize once per session; verified. Viewport resize recenters active node.
- Player bar heights unified to avoid canvas shift on playback.
- Corrupt collection JSON isolated from graph restoration; parent depth/path validation added.
- node_impression now fires from viewport IntersectionObserver; actual node entries, not generated candidates.
- Real music-service authentication, ML, scoring, archive of multiple sessions, minimap are deliberately deferred.
- Current Site registration is unpublished. User requested repository implementation, not public release; do not expose publicly or require deployment to complete local work.
- No secrets in recovery files. Any old temporary source credential is expired; do not rely on conversation memory.

## Next exact actions

1. Astra designs Phase 4 data source, baseline, and end-to-end scope; Sol implements only after user approval. Do not start live-data integration or ratings collection yet.
2. Public GitHub checkpoint is complete. Keep `.openai/` and `.codex/SOURCE_SNAPSHOT.json` excluded. Repository publication does not authorize Site deployment.
3. If a later Graph-Rec change is authorized, keep provider boundaries, run `python3 scripts/isolated-run.py test` and `build`, and re-check only affected browser behavior.

## Resume notes

- Workspace: `/Users/macuser/Documents/ChatGPT/Graph-Rec`; npm; local Git initialized 2026-09-13, no remote, no commit.
- Read this file and original request before changing scope. Do not recreate existing files from scratch.
- Local preview uses http://localhost:3000 from the isolated copy. Confirm server availability on every resume.
- Useful alternate Node executable: `/Users/macuser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node` (verify availability).
- Original image is already integrated; no new image generation or subagent needed.
- After each verified milestone and before interruption, update Current status, Verification status, Known issues and Next exact actions. Clearly distinguish source-complete from verified.

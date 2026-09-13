# Sonder

A song-level music exploration canvas built with Next.js, TypeScript, React Flow, d3-force, and Zustand. Songs form a branching session map; choosing a direction never implies liking a track.

## Continue implementation

Read [implementation state](.codex/IMPLEMENTATION_STATE.md) first. It records completed work, actual verification results, outstanding issues, and next actions. The [original product brief](.codex/PRODUCT_REQUEST.md) preserves the complete scope. Update the state file after meaningful changes and before ending a session.

User priority: **UI smoothness → speed → everything else.**

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Node.js 22 or later recommended. The npm lockfile pins dependencies. No credentials are needed.

```sh
npm run typecheck
npm test
npm run build
```

The build produces a static `out/` directory. `npm start` serves it on port 3000 using Python’s static server (stop the dev server first).

### Recovery on this Mac

Existing dependency files under Documents stalled during reads on this machine. A freshly installed, byte-identical source copy outside Documents passed typecheck, tests and build. Use the reproducible fallback if regular commands stall:

```sh
python3 scripts/isolated-run.py dev
# Or: typecheck, test, build
# After build, stop the dev server and run:
python3 scripts/isolated-run.py start
```

The script copies current sources and assets to `~/.cache/sonder-runtime/check`, installs the locked dependencies if needed, and records source hashes in `.codex/SOURCE_SNAPSHOT.json`. This repository remains the source of truth. Stop and rerun the command after editing repository files; the copy is not a live filesystem link. No credentials are copied. The cause of the original filesystem stalls is not established.

## Explore

- Search for a fictional song, artist or album (`⌘/Ctrl K`), or start with Neon Horizon.
- A seed opens eight recommendations. Select one to grow seven more, with older branches preserved.
- Drag songs to arrange your map; scroll to pan, pinch to zoom, or use zoom/fit/recenter controls.
- Use Enter on a focused graph node to explore; select a node and use arrow keys to move it.
- The inspector provides explicit Like/Save actions and previews. Three original 12-second soundscapes stand in for song audio; some songs intentionally have no preview.
- History returns to prior branches. Saved songs survive new explorations. A new exploration replaces the current map.
- Your Space connects demo Spotify/Apple Music libraries. Playlists let you choose another seed. This does not authorize a real music-service account.
- The session and positions restore from localStorage in the same browser/origin. Private-mode restrictions or full storage are reported in the UI.

## Architecture and replacement points

| Area | Location | Responsibility |
| --- | --- | --- |
| Domain | `src/domain/types.ts` | Track, graph, session, event, recommendation and placement contracts |
| Composition | `src/services/dependencies.ts` | Inject recommendation and placement implementations |
| Recommendations | `src/services/recommendation.ts` | Mock outputs; no coordinates, ML or preference inference |
| Layout | `src/graph/placement.ts` | Deterministic forward fan and collision avoidance |
| Floating motion | `src/graph/floatingGraph.ts` | Gentle anchored D3 drift, collision, hover/drag pinning; render offsets never overwrite saved positions |
| Session | `src/store/exploration.ts`, `src/graph/session.ts` | Branches, active ancestry, async request handling, persistence |
| Graph | `src/components/MusicGraph.tsx`, `SongNode.tsx` | React Flow rendering and gestures |
| Providers | `src/services/musicProviders.ts` | Connection, profile, playlists and library boundary |
| Playback | `src/store/player.ts`, `src/components/MiniPlayer.tsx` | Independent HTML audio state and transport |

Implement `RecommendationProvider.getRecommendations(context)` and replace `dependencies.recommendation`. Neither graph components nor layout need to change. Optional recommendation scores remain metadata and never determine geometric distance.

Implement a `MusicServiceProvider` adapter per service and replace the corresponding `musicProviders` entry. Spotify OAuth/PKCE and Apple MusicKit authorization must retain their different mechanics. Normalize returned tracks, keep service IDs in `externalIds`, and keep any signing secrets server-side. Server routes require changing the static-export configuration or using an external backend.

## Deliberate limits

- A fictional 640-track catalog, nine original artwork tiles, three generated demo previews.
- External links without service IDs open music-service search; fictional songs are not promised to exist there.
- One locally persisted exploration, not a cloud account or multi-session archive.
- Deterministic collision scan; floating motion pauses for reduced motion or hidden tabs. Upgrade to spatial indexing only after measured placement latency warrants it.
- No ranking, embeddings, SASRec, NSGA-II, preference inference or automatic playlist writes.
- No public deployment required for local development. Existing `.openai/hosting.json` is an earlier private Site registration, not proof of a live release.

See implementation state for verified results and unfinished work rather than assuming this README implies validation.

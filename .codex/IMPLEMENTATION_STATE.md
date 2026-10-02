# Implementation State

Last updated: 2026-10-02 (America/Los_Angeles). This repository file is the handoff source of truth. Update it after meaningful changes, verification, and before stopping. Original complete brief: `.codex/PRODUCT_REQUEST.md`.

## Goal

Build Sonder, a polished song-level spatial music discovery MVP directly in this repository. Search a seed, show eight recommendations, expand chosen nodes with seven forward-growing children, preserve branches and draggable positions, inspect/preview songs, restore locally, and browse mock music-service playlists. Keep recommendation and layout replaceable.

Priority explicitly set by user: **1. UI smoothness 2. speed 3. everything else**. No recommendation ML or real account integration in this iteration.

## Current status

2026-10-02 SPARCレビュー指摘5点をユーザー指示でAstraが修正。対照学習の教師を対角列へ変更し、BCEを計画の単一target条件query（e0/再構成50/50）へ戻した。検索はk_effに縮めて確率を再正規化し、quota同剰余はコードID順。APIはcurrent IDを除外集合へ必ず追加する。artifactには学習開始時のcommit/dirty/6 source hashesと実際の入力tensor内容のhashを凍結して保存し、由来情報欠落を読込時に拒否する。既存の由来情報なし人工artifactは再生成が必要。

検証：Python 7/7、Node 19/19、npm typecheck、webpack build PASS。追加回帰検査は対角positive・重複ID、BCEのqueryとinterest towerへの不要な勾配なし、3興味/2候補とquota同点、APIのcurrent除外漏れ、hash/由来情報の凍結・欠落拒否。200 step・seed 0を維持し、学習前後を同一の推論経路で測定：BCE 0.6940603852 → 0.0967546701、正負margin -0.0018163174 → 7.6069059372。CLI smokeも成功し、artifact IDは34f474249dcf5db5332f49b778958d99c268b3d3d543e509ea65209f7f850d1d、保存先は `/private/tmp/sonder-sparc-fix.TAv2w2/artifact`。これは人工系列の動作検証で、音楽推薦品質ではない。

次の作業：S4の音楽データ・特徴・ラベル・時間分割の判断。UI接続・browser確認・0.3・公開は未実施。実装・修正は `05b8aa5`、計画・レビュー記録は `3f955b4` にコミットし、ユーザー指示でmainへ統合。下の2026-10-01の数値と4/4記録は修正前の履歴。

2026-10-01 SPARC S0〜S3実装・検査完了：Engineering正本のPLANとResearch master PLANへ採用範囲を記録した。S1は人工データのPyTorch model（Item/User/Interest tower、RQ、6種loss、padding、コードブックの推薦loss勾配、保存/読込）、S2は200 step人工smoke・artifact・決定的全件検索、S3は127.0.0.1 loopback HTTPとTypeScript `SparcProvider` adapterを追加した。Python `unittest` 4/4、既存15件を含むNode `npm test` 19/19、typecheck、webpack buildがPASS。timeout、未知ID、artifact/catalog版違い、余分key、NaN、不正件数を拒否する検査を含む。

既存 `GenreJaccardProvider`、mock、UI、`dependencies` の既定値、FMA40 catalog/音源、0.1/0.2研究契約、npm依存は変更していない。SPARCはdependencies/store/UIへ配線しておらず、人工artifactはFMA40推薦に使っていない。進捗表示は `docs/sparc-dashboard.html`。

今回の未検証・未着手：音楽データ選定、特徴/ラベル/時系列分割、本学習と品質比較、Sonder store/session/UI接続、0.3 reader、browser運用、公開/deploy。音楽側の仕様不足は推測で補完せず、S4の判断ゲートへ残した。

### SPARC計画・レビュー履歴（現在は上記の修正を適用済み）

2026-10-02 review fixes completed in canonical `/Users/macuser/dev/graph-rec` at the user's request. All five findings below addressed: diagonal contrastive targets, planned single target-conditioned BCE, k_eff retrieval, server current-ID exclusion, and frozen code/input provenance. Python 7/7, Node 19/19, typecheck, webpack build and CLI smoke passed. Fixed-seed 200-step inference BCE 0.6940603852 → 0.0967546701; margin -0.0018163174 → 7.6069059372. Canonical PLAN/IMPLEMENTATION_STATE/dashboard updated; no commit/deployment or S4–S6. Below is the preceding review record, superseded by these fixes.

2026-10-02 Astra review of canonical `/Users/macuser/dev/graph-rec` SPARC S0–S3: NOT ACCEPTED yet. Re-ran Python unittest 4/4 and Node tests 19/19 successfully (loopback tests required sandbox escalation); direct TypeScript noEmit check passed. Did not re-run build/browser or change implementation. Additional diagnostic inputs reproduced: (1) model.py `_contrastive` assigns column 0 as every row's target instead of the diagonal; identity embeddings give loss 6.666757 versus expected 0.00009083, and repeated IDs produce about 1.13e38. (2) retrieval uses all configured K routes when fewer candidates remain instead of k_eff; a fixed 3-route/2-item fixture reverses the planned order. (3) server request validation fails to union current_track_id into exclusions; a valid request returns its current track. Source review also found unrecorded training-objective changes (predicted K-route probability mixture with target query replacing slot 0, rather than the planned target-conditioned single-query BCE), and artifact manifests omit commit/source hashes and training-example hashes. Existing tests do not establish these requirements despite passing. Next: fix the contrastive targets and boundary failures, resolve the training-objective deviation against SPARC.md, add focused regression checks and artifact provenance, then repeat acceptance review. Canonical implementation and its completion claims were left untouched during this review; this entry records the review in the plan worktree.

2026-10-01 SPARC implementation-plan addendum: expanded `SPARC.md` with scoped S0–S6 work units, tensor/loss/gradient contracts, synthetic training artifacts, deterministic retrieval rules, HTTP/provider validation, and the exact store/session/export integration boundaries. Recommended first implementation assignment is S0–S3 only; real music training and UI activation remain gated. Reviewed existing callers and tests; documentation-only checks, no code/test execution, dependency install, training, or worker dispatch. User asked this turn for planning only. Next: user selects implementation start/scope; then transfer the accepted plan to canonical Engineering and Research master PLAN before implementation.

2026-10-01 SPARC planning only: reviewed the supplied arXiv:2508.09090v2 PDF, Engineering/Research plans, provider/store/session/export boundaries, and corresponding canonical files. Added `SPARC.md` at the user's requested path and linked it from PLAN. Proposal retains Jaccard and adds an isolated SPARC model/adapter, with explicit data, session and export compatibility gates. No implementation, restoration, training, tests or deployment performed. Both checkouts had no tracked uncommitted changes before this documentation work; restoration target remains unspecified. Research master plan has not been updated with adoption. Next: clarify restoration intent and establish music training data/features before implementation authorization.

### 以前の作業記録

2026-09-14 career presentation stage 2: README now links three design decisions to existing specification, source, and tests in `docs/design-evidence.md`. Checked code paths, source anchors and the scope of the existing verification record. Documentation only; no new app test, build, deployment or user-study claim. Music RAG is excluded. Publishing uses an isolated public snapshot and preserves local uncommitted work.

2026-09-14 career presentation stage 1 VERIFIED: README + live-demo image published in de706a2. Public file hashes and added relative links checked; GitHub rendering and image inspected. About updated and profile pins verified in product / RAG / research / team order. Documentation-only commit skipped app redeployment; no new functional test claim. Existing local uncommitted work remains untouched.

2026-09-14 career presentation stage 1: user authorized README introduction, role, verification summary, live-demo screenshot and repository description changes. Documentation only; app code and experiment conditions unchanged. Screenshot captured from the public demo; existing verification claims retain their original dates. Publishing independently of local uncommitted work. No new app test or research-result claim.

2026-09-14 final publication checkpoint: documentation follow-up source `54e1a38266c8ed02d83dd581fe1786db3a641e96` deployed successfully in Actions run 34794653262 (47s); README links verified on GitHub. HF-embedded page also downloaded a real JSON file accepted by Research: 1 case / 8 recommendations / 10 events. Public CREDITS.md SHA-256 matches the repository. This verification-only record uses `[skip ci]` to avoid a recursive documentation redeployment; deployed app source remains 54e1a38. No Phase 5 or Research repo push.

2026-09-14 PUBLIC DEMO VERIFIED: https://huggingface.co/spaces/t3-sketch/sonder (direct app: https://t3-sketch-sonder.static.hf.space/index.html). GitHub Actions run 34793009972 successfully installed locked dependencies, passed tests/typecheck/webpack build and uploaded the Static Space from source commit `fde408c30b68be772acf46388b0595c2d8895408`. The first workflow-only run was cancelled as obsolete before publishing. Workflow was added through the signed-in GitHub UI because CLI OAuth lacks workflow scope; merged normally, no force push or permission expansion.

Public Chrome checks: all three curated seeds start with 9 nodes; The Factory expands 9→16→23; all three starting-song MP3s advance in the player without audio errors. Like/Save and 23 nodes restore after reload. The downloaded browser JSON was validated by the independent Research reader: schema 0.2, 3 cases, 22 recommendations, 31 events; graph_committed, producer commit fde408c, dirty=false, empty human/LLM arrays. No app console errors/warnings observed. Fresh CLI exports also passed Research (0.1: 2 cases/15 candidates; 0.2: 3 cases/22 candidates/0 events). README now links to the live demo near the top. A documentation-only follow-up deploy is expected; app source hashes are unchanged. Full 40-track subjective listening, mobile/drag/FPS and embedded-browser download behavior are not newly verified. Phase 5, paid resources, research ratings and Research repo publication remain out of scope. Retired local `scripts/sync-to-graph-rec.sh` is intentionally left untracked and was not published.

2026-09-14 deployment checkpoint: after explicit action-time approval, created the fine-grained `sonder-github-actions` token with write access limited to Space `t3-sketch/sonder` (no inference/billing/user-wide write permissions). Saved it as Graph-Rec Actions `HF_TOKEN`; GitHub UI and CLI both confirm the secret name. No token value is stored in project files or conversation. Publishing the tested Phase 4 source and the main-only Actions workflow is next; public app verification is still pending.

2026-09-14 latest continuation: user approved Astra to finish implementation/publication as a one-time exception and requested Computer Use registration of HF_TOKEN. GitHub Secrets UI confirms no repository secrets. HF token settings redirects to password identity confirmation; user was asked to complete that in Chrome. No token was read, created, or saved. Next credential action after identity confirmation: inspect token options, prepare a fine-grained token limited to `t3-sketch/sonder`, obtain action-time confirmation before creating new write access, then save only to graph-rec Actions HF_TOKEN without displaying its value.

Publication fixes now saved: copy credits into the static Space package, keep HF description below 60 characters, use tested webpack build, restrict workflow to main, serialize deployments without cancellation and skip stale commits, install HF client before exposing token, verify existing Space is Public/static before uploading. README's contradictory 'No ranking' wording corrected. Direct test 15/15, typecheck, webpack build and Research 12/12 PASS on this continuation; 40 audio hashes match audit. No commit/push/deploy yet. Earlier unfinished-work list below is historical; live HF still shows its starter page.

2026-09-14 HF publication in progress: `https://huggingface.co/spaces/t3-sketch/sonder` was created as a free Public Static Space using the user's existing browser login. It currently serves HF's default welcome page, NOT Sonder. Sol saved `.github/workflows/deploy-hugging-face.yml`, README changes (demo link near the top, explicitly pending), and a footer Credits link, then stopped at the model usage limit. These changes are uncommitted and NOT accepted. Root review found unfinished packaging: CREDITS.md is checked in staged output but not copied there; the HF short_description exceeds the 60-character form limit; use the known passing webpack build or verify the default build before release. README still says 'No ranking' despite the genre rank baseline. Recheck workflow concurrency and trusted-main dispatch before enabling credentials. No GitHub push or app deployment happened.

Auth checkpoint: GitHub CLI is logged into t3-sketch, Actions enabled, but repository HF_TOKEN secret is absent and local HF CLI is not logged in. User was asked to register HF_TOKEN directly in GitHub Actions secrets, never in chat. GitHub CLI's current listed scopes do not include workflow; verify workflow publication permission before pushing. Next: resume Sol after reset or obtain user permission for a temporary Astra implementation exception, finish and test the saved workflow, confirm secret registration, publish and verify actual demo/export. Do not mark HF's default welcome page as success.

2026-09-14 latest: user approved free Public HF Static Space `t3-sketch/sonder`, demo verification and scoped Engineering README publication. Astra recorded the Sol handoff in the first section of PLAN. Deployment has NOT been executed by this planning turn. Sol's next action is that section, not the historical Phase 4 planning or old deployment prohibition below. Phase 5 and paid services remain excluded.

2026-09-13 canonical recovery (latest; all earlier status is historical): canonical checkout is now `/Users/macuser/dev/graph-rec`, with user approval. Public Git history was cloned at `aa91a066c8f80566dc43dca3b69c1b7169b389d8`, then the Phase 4 implementation and three review fixes were copied from `/Users/macuser/.cache/sonder-phase4-work`. Old Documents checkout and cache remain untouched backups. No commit, push, deployment or Phase 5 work.

Recovery checks: direct canonical test 15/15, typecheck and webpack production build PASS; Research tests 12/12 PASS. Fresh CLI bundles pass the Research reader: 0.2 has 3 cases / 22 recommendations / 0 events; 0.1 retains 2 cases / 15 recommendations. Source (excluding generated provenance), tests and public assets match the working copy by checksum comparison. All 40 audio files match the restored audit SHA-256 and sizes (30,254,221 bytes). Provenance regenerated in this Git checkout; 24 source files.

Browser smoke on the canonical production build at http://127.0.0.1:3002: The Factory starts with 9 nodes, playback advances to 0:11, Like/Save persist with the map after reload. No console errors/warnings observed. Export click produced no visible error, but the browser automation download event timed out: browser download delivery was NOT verified in this recovery pass. CLI export is verified. Full branch/drag/mobile/FPS and changed-build rejection browser tests were not repeated.

Recovery limits: Documents files were iCloud dataless/read-timeout. `docs/phase4-implementation.md` and `docs/research-export-v0.2.md` were semantically reconstructed from the accepted conversation, not recovered byte-for-byte. `docs/fma40-audit.json` was restored from the saved 40-track audit records. Unreadable old private files are not claimed recovered. Dependencies currently use a symlink to the existing shared cache. Legacy sync helper is disabled; edit only this canonical checkout.

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
- SPARC S0〜S3: `recommendation/sparc/{model,train,retrieval,serve,test_model}.py`、`src/services/sparc.ts`、`tests/sparc-provider.test.ts`。S0の計画採用記録、S1の6種loss/RQ勾配、S2のsynthetic artifact/決定的検索、S3のHTTP/adapter検査を完了。
- `docs/sparc-dashboard.html`: S0〜S6の進捗・検査・残作業を表示する静的dashboard。アプリUIへの配線はしていない。
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

- SPARC S0〜S3はsource-complete。S4の音楽データ成立確認が済むまで、既定providerへの切替とS5 UI/store接続を開始しない。
- Phase 3 implementation is done and waiting for Astra review. Do not start Phase 4.
- Source-complete for floating motion and filament routing. Browser re-verification of drag, persistence, reduced-motion, and 500-node FPS is not claimed. Phase 3 did not change UI and did not re-run a browser pass.

## Not started

Deliberately outside this MVP:
- SPARC S4〜S6：音楽本学習、Sonder接続、0.3研究出力、公開/deploy。データprotocol、特徴対応、評価条件が未確定のため保留。
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

- `recommendation/{__init__.py,sparc/{model,train,retrieval,serve,test_model}.py,requirements.txt,.gitignore}`: S1〜S3のCPU/PyTorch人工prototype、artifact、決定的検索、loopback HTTP、標準unittest。
- `src/services/sparc.ts`, `tests/sparc-provider.test.ts`: HTTP契約を既存RecommendationProviderへ変換するadapterと、実loopback/不正応答/timeout検査。
- `src/domain/types.ts`: 既存providerを壊さない任意の`historyTrackIds`入力。
- `docs/sparc-dashboard.html`: S0〜S6の静的進捗dashboard。
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

SPARC S0〜S3 (2026-10-01):
- S0: Engineering `PLAN.md` とResearch `/Users/macuser/dev/sasrec-serendipity/PLAN.md` に採用範囲を追記。SPARC計画の最新差分、正本の既存境界、40曲/0.1/0.2仕様を照合。
- S1/S2: `python3 -m unittest discover -s recommendation/sparc -p 'test_*.py'` は4/4 PASS。200 step smokeでBCE `0.69424045 → 0.69381160`、正負score margin `0.00025515 > 0`、artifact ID生成。shape/padding、全6 loss有限、RQを除いた推薦lossから選択codebookへの有限非ゼロ勾配、state_dict復元、決定的検索、重複/除外/全件枯渇を確認。
- S3: Python loopback HTTP往復（127.0.0.1、実body）を含む4/4 PASS。未知ID=400、artifact版違い=409、全件除外=空配列を確認。Node `npm test` は19/19 PASS（既存15 + SPARC adapter 4）。adapterでunknown ID、responseの余分key/NaN、HTTP error、timeoutを拒否し、Node標準HTTP fixtureとの実往復も確認。
- Engineering `npm run typecheck` PASS。`npm run build -- --webpack` PASS（Next.js 16.3.4）。既存baseline、UI、依存、40音源の差分なしを確認。
- loopbackとnpm検査はsandboxのIPC/socket制限のためsandbox外で実行した。browser、音楽データ、本学習、UI配線、0.3、公開は検査していない。

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

- SPARCの人工モデルは接続用prototypeで、FMA40の特徴・履歴・学習品質を意味しない。S4で音楽データ、positive定義、時間分割、特徴版、予算を確定するまで既定providerへ切り替えない。
- S3はlocal-only loopback server。TLS、認証、外部bind、公開配信、retry/fallbackは実装していない。S5以降の配信方式・費用判断が必要。
- Memoized graph and narrow store subscriptions; Map-based synchronization; telemetry does not recalculate edges. No claim of measured 500-node browser FPS.
- Initial camera fits after children initialize once per session; verified. Viewport resize recenters active node.
- Player bar heights unified to avoid canvas shift on playback.
- Corrupt collection JSON isolated from graph restoration; parent depth/path validation added.
- node_impression now fires from viewport IntersectionObserver; actual node entries, not generated candidates.
- Real music-service authentication, ML, scoring, archive of multiple sessions, minimap are deliberately deferred.
- Current Site registration is unpublished. User requested repository implementation, not public release; do not expose publicly or require deployment to complete local work.
- No secrets in recovery files. Any old temporary source credential is expired; do not rely on conversation memory.

## Next exact actions

Latest next action: S4のデータ成立判断（音楽データ、特徴、ラベル、時間分割、FMA40対応）が採択されるまで、今回のS0〜S3を既定provider/UIへ接続しない。設計不足は推測で埋めず、影響と最小代案を返す。S4を開始する場合はEngineering/Researchの計画を先に更新する。
Historical Phase 4 next action: finish the acceptance review on this canonical checkout, including browser download delivery if required for acceptance. Do not run the old cache-to-Documents sync helper. Do not start Phase 5, commit, push or deploy without user scope. The numbered items below are historical.

1. Astra designs Phase 4 data source, baseline, and end-to-end scope; Sol implements only after user approval. Do not start live-data integration or ratings collection yet.
2. Public GitHub checkpoint is complete. Keep `.openai/` and `.codex/SOURCE_SNAPSHOT.json` excluded. Repository publication does not authorize Site deployment.
3. If a later Graph-Rec change is authorized, keep provider boundaries, run `python3 scripts/isolated-run.py test` and `build`, and re-check only affected browser behavior.

## Resume notes

- Workspace: `/Users/macuser/dev/graph-rec`; npm; remote `https://github.com/t3-sketch/graph-rec.git`. Documents checkout is a preserved backup, not the editing target.
- Read this file and original request before changing scope. Do not recreate existing files from scratch.
- Local preview uses http://localhost:3000 from the isolated copy. Confirm server availability on every resume.
- Useful alternate Node executable: `/Users/macuser/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node` (verify availability).
- Original image is already integrated; no new image generation or subagent needed.
- After each verified milestone and before interruption, update Current status, Verification status, Known issues and Next exact actions. Clearly distinguish source-complete from verified.

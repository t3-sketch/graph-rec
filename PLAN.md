# Graph-Rec / Sonder — Engineering引き継ぎ計画

更新日：2026-09-13。**PHASE_4_PLANNING_ONLY：Phase 1〜3はAstra再レビュー合格。Public公開済み。Phase 4は設計のみ、実装未許可。**
設計はAstra、実装はSol。Cursor等の実装agentも同じ計画に従う。モデルの切り替えだけでは実装開始しない。

## 全体計画の正本

Researchプロジェクト `sasrec-serendipity` のルート `PLAN.md` が全体計画の正本。
公開された全体計画：[Research PLAN](https://github.com/t3-sketch/serendipity-ga-multiobjective/blob/main/PLAN.md)。
別環境ではResearch checkoutの `PLAN.md` を読む。見つからない場合は取得場所を確認し、計画を推測して再作成しない。

採用方針：既存Researchを継続して公開再現性を整える／このGraph-RecをEngineering repoとして育てる／固定推薦ケースで接続する。
新しいアプリを作り直さない。製品名Sonderと既存ソースを継続する。GitHubは https://github.com/t3-sketch/graph-rec （ユーザー承認によりPublic）。

## 現在地と守る境界

- 2026-09-13に初回公開commit `45b436d` をorigin/mainへpush済み。
- Next.js / TypeScript / React Flow / Zustandの探索UIがある。
- 推薦は架空640曲のmock。実認証、SASRec、KG、学習は未実装。
- `src/services/dependencies.ts` と `RecommendationProvider` が差し替え口。新しい推薦実装はここを利用する。
- グラフは探索履歴。Knowledge Graphでも、距離によるスコア表示でもない。
- クリックは探索。Like/Saveを別に扱う。UIの滑らかさ → 速度の順を維持する。
- ソース正本はこのフォルダ。既存cacheは実行用コピーであり、編集先ではない。
- アニメーションの正本はソース。`floatingGraph.ts` と `filaments.ts` が実装済み。旧`forceEntrance`記述はPhase 1で状態文書を更新した。過去のブラウザ検証を最新ソースの検証とみなさない。

## 担当作業と順序

1. 全体Phase 1：完了。状態照合、公開除外、現作業場所でGit初期化。GitHub公開設定は未決のため作成していない。
2. 全体Phase 2：完了（Research側）。このアプリの機能拡張は始めていない。
3. Phase 3：`docs/research-export.md` version 0.1は再レビュー合格。入口は `npm run export:research -- --output <未使用ディレクトリ>`。human-ratingsとllm-predictionsは空ファイル。実ケースへの拡張はPhase 4設計、本人評定の尺度はPhase 5で確定する。
4. Phase 4：Astraが音楽データ源・baselineを確定した後、曲選択→候補→探索→試聴→明示的反応→exportの一往復を完成させる。
5. Phase 5：確定protocolに基づいて必要な提示・記録を支援。本人評定とLLM入力は分離。募集やサービス接続を計画から自動実行しない。
6. Phase 6：デモ、起動方法、構成、実測と関連研究へのリンクを整える。

実装前に必要な判断：音楽データ、推薦baseline、KGで扱う関係、schema、サーバーの要否、GitHub公開設定。共有SDKやモデル別サービスは先に作らない。
完了条件：既存の枝保持・drag・復元・Like/Saveを維持し、固定ケースをResearch側で検査できる。mockを実推薦の成果として報告しない。

## 再開と検証

現在：Phase 3のP2修正はAstra再レビュー合格。仕様正本は [docs/research-export.md](docs/research-export.md)。キーはデコード後に重複判定。created_at / requested_atは実在UTC。再レビューはEngineering test 9/9・typecheck、Research test 10/10を確認。build・ブラウザは再実行していない。次は音楽データ源・baseline・完成範囲の設計。実装はユーザー承認後にSolが行う。
作業状態の正本は既存 `.codex/IMPLEMENTATION_STATE.md`。同じ目的の `docs/PROJECT_STATE.md` はここへ新設しない。Research側の運用状態はResearchの `docs/PROJECT_STATE.md`。
公開から除外：`node_modules/`、`.next/`、`out/`、`*.tsbuildinfo`、`.env*`、`.DS_Store`、`.playwright-mcp/`。
公開前に確認：`.openai/hosting.json`、`.codex/SOURCE_SNAPSHOT.json`。
実装後は既存typecheck・test・buildと変更箇所に必要なブラウザ検証を行い、状態文書へ変更・証拠・未検証範囲・次の操作を記録する。
計画変更は先にAstraが全体PLANへ反映する。技術的障害時は証拠と最小代替案を返す。
GitHub公開・deployは独立した指示範囲で扱う。既存 `.openai/hosting.json` のSite登録を重複作成しない。

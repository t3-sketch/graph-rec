# Graph-Rec / Sonder — Engineering引き継ぎ計画

## 最新の公開許可（2026-09-14）

同日追加承認：Solの利用上限による停止を受け、ユーザーは今回の残りの実装と公開をAstraが担当する例外を承認した。GitHub README冒頭へリンクを掲載し、GitHub Actionsから無料Static Spaceへ配信する。Computer UseでHF_TOKENをGitHub Secretsへ登録する操作も依頼された。新規トークンの発行など権限追加は操作直前に権限範囲を示して確認する。通常のAstra/Sol分担は変更しない。

**HF_STATIC_DEMO_APPROVED**。ユーザーは `t3-sketch/sonder` をPublicの無料Hugging Face Static Spaceとして公開する範囲を承認した。Astraはこの手順を記録し、Solが実装と公開を担当する。この節は下の旧deploy禁止記録に優先するが、Phase 5、課金、GPU、募集、学習、Research repoの公開変更は許可しない。

1. 正本 `/Users/macuser/dev/graph-rec` のAGENTSと状態文書を読む。既存の未コミット変更を保持し、Phase 4実装、40音源、クレジットを公開対象として確認する。秘密情報、cache、個人のセッション、研究の生データを含めない。
2. HFの認証先が `t3-sketch` か確認する。トークンを会話や公開ファイルに書かない。既存 `t3-sketch/sonder` があれば内容を読み、無関係なSpaceは上書きしない。ログインが必要ならユーザーへ引き継ぐ。
3. 既存Next.jsの静的出力を使う。Gradio、Docker、DB、再生APIは追加しない。まず検査済みcheckoutでprovenanceを生成してbuildし、完成した静的出力と必要なライセンス文書だけをSpaceへ配信する。HF用READMEは公開用の作業ディレクトリに置き、ソースrepoのREADMEを置き換えない。公式Static Space仕様に従い `sdk: static` と入口を設定する。
4. 公開前にtest、typecheck、webpack build、0.1/0.2 Research reader、40音源hashを確認する。クレジットをデモから辿れるようにする。静的出力内のJSON、MP3は公開閲覧者が取得できる前提で確認する。公開bundleに秘密を含めない。
5. 無料Public Spaceへ公開する。公開URLで3開始曲、枝展開、試聴、Like/Save、reload復元を確認する。ブラウザでexportを実際に保存し、保存ファイルをResearch readerで検査する。先のdownloadイベントtimeoutを成功扱いしない。埋め込み側の制約ならSpaceの直接アプリURLでも確認する。
6. 動作確認後、GitHubのREADMEに実在するデモURLと40曲genre baselineの範囲を記載する。必要なEngineering公開差分だけを選別してcommit/pushしてよい。Researchの変更は含めず、force pushはしない。生成物に記録するcommitとsource hashがどの検査済み版を指すかを記録し、HF配信用commitと混同しない。
7. `.codex/IMPLEMENTATION_STATE.md` に公開URL、公開対象版、実測と未確認項目を記録する。有料プランが必要になった場合や構成変更が必要なら止めて理由を返す。自動課金や別サービスへの切り替えはしない。

完了条件：公開URLから40曲デモが利用でき、試聴とexportの実ファイル保存を確認し、GitHubからデモへ到達できる。Phase 5完了や推薦品質の実証は主張しない。
参照：https://huggingface.co/docs/hub/spaces-sdks-static 。実行時に現行仕様を確認する。

更新日：2026-09-13。**PHASE_4_CANONICAL_RECOVERED_REVIEW：ユーザー承認により正本を `/Users/macuser/dev/graph-rec` へ復元済み。Phase 4の3修正を取り込み、正本でtest 15/15・typecheck・build・0.1/0.2 Research読み込みを確認。ブラウザは推薦・試聴・Like/Save・復元まで確認、ダウンロード配送は未確認。Phase 5・commit・push・deployは対象外。**
設計はAstra、実装はSol。Cursor等の実装agentも同じ計画に従う。モデルの切り替えだけでは実装開始しない。

## 全体計画の正本

Researchプロジェクト `sasrec-serendipity` のルート `PLAN.md` が全体計画の正本。
公開された全体計画：[Research PLAN](https://github.com/t3-sketch/serendipity-ga-multiobjective/blob/main/PLAN.md)。
別環境ではResearch checkoutの `PLAN.md` を読む。見つからない場合は取得場所を確認し、計画を推測して再作成しない。

採用方針：既存Researchを継続して公開再現性を整える／このGraph-RecをEngineering repoとして育てる／固定推薦ケースで接続する。
新しいアプリを作り直さない。製品名Sonderと既存ソースを継続する。GitHubは https://github.com/t3-sketch/graph-rec （ユーザー承認によりPublic）。

## 現在地と守る境界

最新の正本：`/Users/macuser/dev/graph-rec`。旧`/Users/macuser/Documents/ChatGPT/Graph-Rec`はiCloud dataless/read timeoutのため保全用に残し、編集先にしない。`/Users/macuser/.cache/sonder-phase4-work`も旧作業コピーとして保持し、以後の変更は新正本で行う。
公開Git履歴をcloneし、作業コピーのsrc/tests/public/scripts・package/config・CREDITSを反映。読めない旧資料は会話に保存された確定仕様・監査記録から復元した。旧ディレクトリ内の未取得資料まで完全復旧したとは扱わない。
Phase 4引き継ぎ：`docs/phase4-implementation.md`、`docs/research-export-v0.2.md`、`docs/fma40-audit.json`。40曲を固定する。0.1は維持。以下の計画のみ・未着手等の記述は過去の記録であり、この最新記録に優先しない。

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

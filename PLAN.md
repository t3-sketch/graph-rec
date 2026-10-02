# Graph-Rec / Sonder — Engineering引き継ぎ計画

## SPARCレビュー修正（2026-10-02）

ユーザーの「こっちで直しちゃおう。やっといて」によりAstraがS0〜S3のレビュー指摘5点を修正・再検証する。対照学習の正解列、計画どおりの単一target条件付きBCE、残候補数に応じた興味数、API側の現在曲除外、artifact由来情報が対象。これらの回帰検査と人工smokeも更新する。S4〜S6、UI配線、公開は対象外。

完了：5点の修正と回帰検査、Python 7/7・Node 19/19・typecheck・webpack build・CLI smokeが成功。実測とartifactは既存IMPLEMENTATION_STATEに記録。S4以降は未着手。

## SPARC S0〜S3 採用範囲（2026-10-01）

ユーザー指示と [SPARC.md](SPARC.md) のコード実装計画に基づき、S0〜S3だけをEngineering正本へ採用する。S1はPyTorchの人工データモデル検証（Item/User/Interest tower、RQ、6種loss、コードブック勾配、padding、保存/読込）、S2は人工系列の小規模学習・artifact・決定的全件検索、S3は127.0.0.1 loopback HTTPとTS `RecommendationProvider` adapterの境界検証を担当する。既存 `GenreJaccardProvider`、mock、UI、`dependencies` の既定値、FMA40音源と0.1/0.2契約は変更しない。

S4（音楽データの選定・特徴・本学習）、S5（store/session/composition/UI配線）、S6（0.3研究出力）、公開・deployは今回の採用範囲外とする。人工artifactをFMA40推薦へ流用しない。実装後は既存の変更範囲に応じてtest/typecheck/buildを確認し、S0〜S3の検査結果・未検証範囲・最小代案を `.codex/IMPLEMENTATION_STATE.md` に記録する。

進捗表示：[SPARC dashboard](docs/sparc-dashboard.html)。

## SPARC導入の計画案（2026-10-01・履歴）

以下は採用前の計画記録。現在の実装範囲・完了状況は上記を参照。

同日追記：ユーザー依頼によりSPARC.mdへ軽量モデル向けコード実装計画を追加。S0〜S3を最初の実装候補とし、人工データでモデル・検索・HTTP/TS adapterまでを検査する。音楽学習とUI接続は後続単位。今回は計画のみで、実装agentは起動していない。型・loss・勾配・候補統合・通信・保存/export境界・検査・引継ぎ文を記録した。

ユーザー依頼に基づき、SPARC論文と既存provider/保存/export境界を確認した。今回は計画のみ。提案は [SPARC.md](SPARC.md)。既存GenreJaccardProviderを保持し、独立モデルとadapterを追加する。学習データと論文の不足仕様を先に確定し、保存・exportのJaccard固定部分だけを切り分ける。

実装・復元・学習・公開は未実施。「元のファイル」の復元元は未指定で、両checkoutの追跡対象に未コミット変更なし。正本は引き続き `/Users/macuser/dev/graph-rec`。Research master PLANは読取済み・未更新。本案は採用済み計画ではなく、実装前に全体計画へ採用範囲を反映する。次は復元意図と音楽の学習データ/特徴の確定。

## 就活向け第二段：根拠への導線（2026-09-14）

ユーザーの「Music-RAG以外の第二段の他は実行」に基づき、公開READMEから既存の判断・結果・コード・検証へ進める文書更新とGitHub反映を実施する。Music RAGは対象外。機能、実験条件、データ、既存のローカル未コミット変更は対象外。NotionのGitHubガイドに沿い、元の説明を保ちつつ根拠へのリンクを追加する。

チェックポイント：第二段の文書更新を完了。追加リンクの参照先、コードの位置、正式報告と公開集計の数値、Notebookの担当記載を照合済み。新規実験・アプリ再検証は未実施。公開反映は文書のみのcommitとし、反映後にファイル内容を読み戻して照合する。次の研究・機能開発は既存計画の許可範囲に従う。

## 就活向け入口の第一段階（2026-09-14）

完了・検証：READMEとAboutを公開済み。公開ファイルの内容一致、新規リンクの参照先、プロフィールの4件ピンと順序を確認。Sonderの紹介画像、RAGの評価表と折りたたみは公開画面で確認。機能・研究の追加実験は実施していない。次は第一段階の公開内容に対するユーザーの確認。

ユーザーの「第一段を実行して」に基づき、READMEの紹介・担当・評価結果・デモへの導線を整えて公開する。機能・実験条件は変更しない。既存のローカル未コミット変更は含めず、公開版の文書だけを独立して編集する。


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

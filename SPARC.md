# SPARC導入計画 — Sonderの交換可能な推薦モジュール

2026-10-01 / Astra / DRAFT・計画のみ。実装、復元、学習、公開は未実施。

## 目的と既存資産

既存のグラフUIに、SPARCの複数興味による候補検索を追加する。現在のGenreJaccardProviderとmockは保持し、選択した推薦器を外せば既存baselineへ戻せる構成にする。

調査先はplan worktree（175e0fe）と正本 `/Users/macuser/dev/graph-rec`（3383961）。推薦、型、store、session、0.2 exporter/validator、Phase 4仕様の対象ファイルは両commit間で差分なし。両方とも追跡対象の未コミット変更なし。正本に未追跡の旧同期scriptがあるが対象外。「元のファイルを戻す」の具体的な復元元は未指定なので、ファイルを復元・削除しない。実装先は既存方針どおり正本とする。

## 論文のアーキテクチャと採用範囲

資料：ユーザー提供SPARC.pdf、arXiv:2508.09090v2（https://arxiv.org/abs/2508.09090v2）。図1、§3.1–3.5、§4.1を確認。

1. Item Towerが曲の特徴をベクトルzへ変換する。
2. 3段のRQ-VAEが残差を量子化し、学習可能なコードブックと再構成ベクトルを得る。
3. User Towerが行動系列と興味コードをattentionで組み合わせ、興味ごとのユーザーベクトルを作る。学習時はe0と再構成ベクトルを50/50でqueryに使う。
4. 独立したInterest Probability Towerが第1段コード全体への確率を予測する。
5. 推論時は複数の興味について候補検索し、統合・重複除去・順位付けする。
6. BCE、RQ再構成/コードブック、shuffle BPR、user-item/item-item対照学習、興味予測の損失を組み合わせて学習する。

SPARCは主にretrievalの方式。Sonderが必要とする最終8/7曲への絞り込みも別途明示する。固定ジャンルの混合だけをSPARC実装と呼ばない。学習の共同最適化を核として残す。

論文内の未解決点：§3は3段×256コード・64次元、§4.1.5は3段×64コード・embedding 128次元・興味数4。§3.5のK=5は例示。soft-searchもTop-K選択を説明しており、ランダムサンプリングを必須とはしていない。Hardとの厳密な差、確率に応じた整数quota、統合後の順位規則、量子化の勾配処理は追加の実装判断が必要。公式実装の有無・利用条件は未確認。再現対象と不足仕様を先に固定し、独自補完を論文再現と混同しない。

## 接続案

```text
既存UI → exploration store → RecommendationProvider
                              ├─ GenreJaccardProvider（既存baseline）
                              └─ SparcProvider（新規adapter）
                                   → ローカル推論API
                                       → 興味確率 → 興味別user vector
                                       → 曲検索 → 統合・除外・順位付け

オフライン学習 → checkpoint + 曲特徴/ベクトル + codebooks + 設定/hash
                                              ↓
                                         ローカル推論API
```

初期接続はローカル検証。静的HFデモはbaselineを継続する。公開SPARCには別途推論の配信方式と費用判断が必要。ブラウザ内モデル変換、ベクトルDB、分散ANN、プラグイン管理機構は先に追加しない。少数候補では全件内積を用い、ANNは検索時間が問題になってから追加する。この置換は論文の大規模配信性能の再現ではない。

新規ファイル案（承認後に必要な段階だけ作る）：

| パス | 責務 |
|---|---|
| `recommendation/sparc/model.py` | towers、RQ、損失、興味別表現 |
| `recommendation/sparc/train.py` | 学習・checkpoint保存。Engineeringに実装を一本化 |
| `recommendation/sparc/serve.py` | checkpoint読込、推論、候補統合、ローカルAPI |
| `src/services/sparc.ts` | 既存provider契約とAPIの変換、応答検証・timeout |
| `tests/sparc-provider.test.ts` | provider境界・異常応答・除外の検査 |
| `recommendation/sparc/test_model.py` | 勾配、有限loss、小規模過学習・推論の確認 |

Python依存はこのモジュールに分離する。学習ライブラリ・サーバー方式はデータと実行環境を確認後に確定する。上表は足場だけ先に作る指示ではない。

## 既存コードに必要な最小変更

providerインターフェースは既存だが、アプリ全体が完全に推薦器非依存という状態ではない。

| 対象 | 変更案と理由 |
|---|---|
| `src/services/dependencies.ts` | baseline/SPARCを構成時に選択。既存providerを上書きしない |
| `src/domain/types.ts` | 推薦要求に必要な行動履歴を任意追加。provider/model/configの識別情報を定義。既存baselineは履歴を無視できる |
| `src/store/exploration.ts` | 要求前の履歴snapshotを渡す。FMA曲なら常にJaccard ID・genre件数付きcaseにする処理を切り分ける。既存stale-response guardを保持 |
| `src/graph/session.ts` | provider/model/catalog版を照合。baselineとSPARCは保存領域を分け、切替で元のmapを上書きしない |
| export入口・provenance | SPARCを0.2として出さない。初期ローカル接続では理由付きで研究exportを無効化。モデルと新しいコードの由来も記録する |

`genreJaccard.ts`、mock、グラフ配置、音源40曲、クレジットは保持する。ジャンル属性の説明を表示する場合は実際の共通genre数を計算し、SPARCのscoreをジャンル件数やserendipity値に偽装しない。

0.2のvalidatorはprovider IDとJaccard順を再計算する厳密な契約。これを緩めてSPARCを通す案は採らない。研究接続時は新しい契約（0.3案）を設計し、モデルhash、入力履歴snapshot、特徴版、検索/統合設定、候補IDと順位、乱数使用時のseedを記録する。TSとResearch Python readerを対応させ、0.1/0.2の仕様とテストを残す。hash一致は学習モデルの推薦の正しさを保証しないため、固定モデルによる再推論照合を別に行う。

API応答はカタログ内ID、重複、除外、件数、有限score、モデル版を検査する。timeoutやモデル不一致ではその要求を失敗として表示し、SPARC名義のままbaselineを返さない。baselineへの復帰は構成切替と別セッションで行う。

## 学習データと利用者履歴

現40曲は接続デモ用で、行動系列の学習データではない。既存UIには明示Like/Save・再生callbackがあるが、`RecommendationContext`には渡されていない。

- `exploredTrackIds`は画面上の全ノードを除外する集合。聴取履歴・positiveにしない。
- `sessionPath`は枝の探索経路。好みの履歴と同一視しない。
- Like/Save、再生、探索を別イベントとして扱う。positive/negative、繰返し、取消、時間窓の定義を学習前に決める。未観測を無条件にdislikeにしない。
- 現在のseedは文脈、要求より前の反応がユーザー履歴。未来の反応を入力へ入れない。
- 履歴ゼロではbaselineの別セッションへ案内する初期案。論文のcold-start検証は履歴5–10件で、ゼロ履歴への効果の根拠ではない。

最初の判断ゲートは、時刻付きユーザー×曲履歴と曲特徴を得られるか、そして学習データの曲とデモ40曲をどう接続できるか。ID embeddingだけの別カタログモデルではFMA40へ移せない。音楽データ・特徴・対応付けを確定してから学習する。Amazon/映画データでの構造確認と、音楽への有効性確認を区別する。

## 実行順と完了条件

1. **既存版保持と仕様固定**：復元元が指定された場合だけ差分を確認して復元。データ、ラベル、分割、RQ寸法、勾配処理、quota、統合順位を確定する。Research master PLANに採用範囲を記録してから複雑な実装へ進む。
2. **独立モデル検証**：小さな人工系列で各lossとcodebookへの勾配・過学習・保存/読込一致を確認。これは推薦品質の証明ではない。その後、確定した音楽データで学習・評価する。
3. **ローカル接続**：adapterと必要な境界変更を加える。3開始曲、8/7/7（不足なら少数/0）、重複・除外、遅延応答破棄、試聴、drag、Like/Save、reload、切替後のbaseline復帰を検査する。学習済みモデル未提供時にダミーをSPARCとして有効化しない。
4. **研究出力**：0.3案とResearch readerを確定・実装し、固定ケースの独立検査を成立させる。元の0.1/0.2回帰検査も行う。
5. **採否判断**：同じ候補集合・時間分割・予算でJaccard、two-tower、SPARCを比較。共同学習/固定codebook、複数興味検索の寄与も切り分ける。品質と推論遅延p50/p95、エラー率を測り、採否基準を結果を見る前に固定する。公開配信はその後の別スコープ。

評価はRecall/NDCG、catalog coverage、明示した特徴によるILD、train人気によるtail指標を併記。100候補サンプル評価と全件retrievalを混同しない。UIの滑らかさを優先し、既存test/typecheck/buildと変更に応じたブラウザ検査を行う。主観的な発見体験は本人評価なしに改善を主張しない。Phase 5のLLM評価・参加者募集は今回の計画から自動開始しない。

## 技術選定の記録

- **課題**：現在は選択曲とのgenre一致による推薦で、複数の興味を学習して探索する機構がない。
- **仮説**：SPARCの共同学習と興味別検索が、単一の類似度に偏らない候補発見に役立つ。
- **根拠**：論文に対応する機構があり、既存provider境界も利用できる。ただし論文のBooks/産業データでの結果はSonderの音楽での効果を保証しない。
- **結果**：未計測。TODOはデータ成立確認、独立学習検証、baseline比較、遅延計測。

今回の作業はPDF/ソース/既存計画の読取と計画文書作成のみ。コード、モデル、元ファイルの復元、依存追加、学習、テスト実行、deployは行っていない。Research master PLANへの採用反映は未実施で、本書は提案段階。

## コード実装計画（2026-10-01追記）

この節は軽量モデル向けの実装指示書案。ユーザーの今回の依頼は計画の追記までで、実装agentの起動やコード変更は行わない。Astraが設計、Sol等の軽量モデルが範囲を指定された実装を担当する。

### 1. 最初に渡す実装単位

最初の依頼は **S1〜S3：独立したモデル・推論関数・TS adapterを人工データで検証する** 範囲を推奨する。実曲の学習データが未確定でも、この範囲なら入出力と勾配の不具合を検出できる。アプリの既定推薦器は切り替えない。人工データのcheckpointを実曲推薦に流用しない。

| 単位 | 前提 | 成果物 | 終了条件 |
|---|---|---|---|
| S0：着手準備 | 実装開始の指示 | 正本の差分確認、計画の採用範囲記録 | 正本・Research master PLANにS1〜S3等の実行範囲が明記される |
| S1：モデル | S0 | `model.py`、`test_model.py`、モジュール用依存定義 | tensor形状、loss、勾配、padding、保存/読込の検査成功 |
| S2：学習・検索 | S1 | `train.py`、`retrieval.py`、同じPython testへの追加 | 人工系列の小規模学習、artifact生成、決定的検索・除外検査成功 |
| S3：通信adapter | S2 | `serve.py`、`src/services/sparc.ts`、`tests/sparc-provider.test.ts` | 実HTTPの人工fixture往復と不正応答拒否。既存appの推薦はbaselineのまま |
| S4：音楽モデル | データ/ラベル/特徴/分割/予算の確定 | 同じコードによる学習済みartifactと評価記録 | 音楽の時系列評価、FMA40特徴の対応、未知曲処理の確認 |
| S5：Sonder接続 | S3・S4、下記の接続仕様採用 | store/session/composition/UIの最小変更 | baseline復帰、SPARC試聴・展開・復元、0.2誤出力防止を確認 |
| S6：研究出力 | 新export契約の設計確定 | 0.3 exporter/reader | 0.1/0.2を保持した独立検証。今回の初回実装には含めない |

S0で読むもの：正本のAGENTS、PLAN、IMPLEMENTATION_STATE、本書、Phase 4仕様。今回の計画は `/Users/macuser/orca/workspaces/graph-rec/plan/SPARC.md` にあるため、正本に存在すると思い込まない。計画の採用時は正本文書と差分を照合して内容を反映し、PLAN/状態文書を丸ごと上書きしない。旧同期scriptは使わない。

### 2. 初期実装として固定する仕様

以下は**Sonder向け試作の設計値**であり、論文の再現設定・推薦品質の最適値ではない。S4の本実験値は評価を見る前に別途固定する。

| 項目 | 初期仕様 | 理由 |
|---|---|---|
| 実行 | Python + PyTorch、CPU、float32、単一process | ローカルで勾配と接続を確認するため。GPU/MPS最適化は後続 |
| item入力 | 全曲共通の有限float特徴 `[N,F]`。学習するID embeddingは初版なし | 別カタログの曲にも同じ特徴処理を適用できる形にする |
| 通常の試作寸法 | `D=64, M=3, C=64, K=4, Lmax=50` | Mは論文を踏襲。D/C/Kは小規模検証用の選択 |
| 人工smoke寸法 | `D=16, M=3, C=8, K=2` | 短いCPU検査。実験設定と別名で保存 |
| tower | Item MLP `F→D→D`、User MLP `2D→D→D`、中間ReLU | 産業用feature-crossingを省いた試作。PEP-NET等の再現は主張しない |
| 興味tower | 1層self-attention＋mask付き平均＋linear `D→C` | 履歴から全コードのlogitsを得る。user ID/年齢/性別は要求しない |
| 順序 | 履歴の曲embeddingに位置embeddingを加える | 順序を保持。padding位置はattentionとpooling双方で除外 |
| 学習 | AdamW、smokeはlr `1e-3`、seed `0`、最大200 step | 動作検査の上限。失敗時に無制限学習や探索へ移らない |
| 検索 | 確率Top-K、全件内積、決定的統合 | ANN依存を入れず、比較可能な結果を作る |

PyTorch以外の学習framework・設定frameworkは追加しない。環境を調べ、実際に動作確認したPython/PyTorchの版を `recommendation/sparc/requirements.txt` と実行記録に固定する。全体のnpm依存を増やさない。Python環境、cache、`artifacts/`、`runs/` はこのモジュール内の `.gitignore` で除外する。

### 3. `model.py` の境界と勾配

`SparcConfig` は標準dataclass一つ。`SparcModel(torch.nn.Module)` がtowerとcodebookを所有する。classを部品ごとに増やす必要はない。次の関数境界を持たせる（戻り値はtensorのtuple/dictでよい）。

| 関数 | 入力 | 出力 |
|---|---|---|
| `encode_items(features)` | `[N,F]` | `z[N,D]` |
| `quantize(z)` | `[B,D]` | `indices[B,M]`, `codes[B,M,D]`, `z_recon[B,D]`, `rq_loss` |
| `encode_history(features, mask)` | `[B,L,F]`, bool `[B,L]`（true=実要素） | `H[B,L,D]` |
| `interest_logits(H, mask)` | 同上 | `[B,C]`、softmaxは推論時 |
| `user_vectors(H, mask, queries)` | query `[B,Q,D]` | `u[B,Q,D]` |
| `compute_loss(batch)` | 履歴、target特徴、0/1 label | total scalarと6種のloss内訳 |

量子化は残差とコードの二乗距離のargmin、同点はコードindex昇順。選ばれたcodewordをgatherして残差から引き、3段の和を再構成とする。argminの整数indexを微分可能と主張しない。gatherしたcodewordはdetachせず、User Towerのqueryに渡す。Item Towerはtargetのzへの推薦lossと再構成lossから、codebookはquery経由の推薦lossとRQ lossから更新する。初版はEMAや独自straight-through autogradを追加しない。これは離散割当を固定した局所的な勾配計算で、論文が未指定の実装補完として記録する。

User Towerはqueryと履歴のscaled dot-product attentionを取り、`concat(query, attention_output)` をMLPに通す。学習queryはサンプル単位のseed付きBernoulliでe0/再構成を50/50選択。推論は選択したKコードのe0を使用。推論中のdropoutは0、`eval()` と推論用コンテキストを使用する。全padding履歴は計算前に拒否し、NaNをゼロに置換して隠さない。

損失は論文§3.4の6成分を別々に返す。BCEは全label行、それ以外の正例依存lossはlabel=1の行に適用する。

- BCE：`u・z` をlogitとする。安定なlogit版BCEを使う。
- RQ：`mean(||z-z_recon||²) + beta * sum_m mean(||stopgrad(r_m)-e_m||²)`。`beta=0.25` は試作値。loss内の平均はbatch平均と明記し、次元和を勝手に平均へ変えない。
- shuffle BPR：正例のe0をqueryとしたuと、batch中の別コードをqueryとしたuを比較し、`softplus(-(s_pos-s_neg))` の平均を取る。初版J=1。同コードしかないbatchはこのlossを0としskip件数を記録。異なるコードを負例queryに使う検査を必須とする。
- UI/II contrastive：正例batchの `(u,z_recon)` / `(z,z_recon)`、温度0.1、論文の内積logits。対角positiveのcross entropy。重複target IDをfalse negativeにしないよう、その列を負例からmaskする。有効負例ゼロの行はskipする。
- Interest CE：正例targetの第1段indexを教師とする。indexはdetachした整数ラベル。
- total：`BCE + 10*BPR + Interest + UI + II + RQ`。10以外の係数・温度・betaは試作補完値で、configとartifactに保存する。

テストはtotalの勾配だけで済ませない。**RQ lossを外した推薦lossからも、選択された第1段codebookへ有限で非ゼロの勾配が流れる**ことを確認する。全コードの勾配が毎batch非ゼロになる必要はない。コード使用数・各loss・skip件数を記録し、codebook collapseを品質改善と取り違えない。

### 4. 学習入力とartifact

`train.py` はargparseのCLI一つ。最初は人工データ生成を `--smoke` に閉じ、実データは下記の明示入力のみ受け付ける。外部データの自動取得は行わない。

- `items.json`：`{schema_version: "sparc-items-1", feature_version, items: [{track_id, features: number[]}]}`。ID一意、同一F、有限値、空配列不可。
- `examples.jsonl`：各行 `{example_id, split, history_track_ids, target_track_id, label}`。splitはtrain/validation/test、labelは厳密な整数0/1、履歴は古い→新しい順の1〜50件。未知ID・不正なsplit・長すぎる履歴は拒否。重複historyはデータprotocolが許す反復であり、一律削除しない。
- データprotocol：特徴の生成方法、時間分割、履歴をtarget時刻より前にする処理、negativeの作成、ラベル由来を記録する。上記の学習行だけでは時間リークを証明できないため、S4では元timestampからの構築検査が必要。testをearly stoppingや特徴正規化に使わない。
- smokeは32曲・4人工興味・重複targetなしの小batchをtest内で生成し、CLIからも同じ生成関数を使う。seed、全件数、step数と前後のlossを記録する。学習前後を同じeval条件で比較し、BCEの減少と、予測興味を用いた推論での平均positive/negative score差が初期値より増え、かつ正になることを検査する。targetから作ったqueryだけで成功判定しない。200 stepで失敗したら原因を報告し、通るまでseedや閾値を変えない。

出力は未使用ディレクトリのみ。`weights.pt`（state_dict）、`items.json`、`manifest.json` に限定し、itemベクトルは起動時に計算する。manifestはschema、synthetic/musicのdata_kind、config、dataset/feature版、weights/itemsのSHA-256、served catalogのSHA-256、学習入力のhash、コードのcommit/関連source hash、実行環境、seed、学習条件を持つ。**manifestの保存bytesのSHA-256をartifact IDとし、manifest自身に自己hashを含めない。** IDと全ファイルhashを読込時に照合する。synthetic artifactにはFMA40用catalog hashを付けない。

学習時のitemsと、配信対象のitemsは区別する。CLIの `--serve-items` で出力側の曲特徴を指定し、同一feature版・F・有限値を検査する。smokeは同じ人工itemsを使う。S5の出力側itemsはFMA40のIDと完全一致する40曲に限定し、served catalog hashは既存provenanceのcatalog hashを用いる。学習カタログの全曲をSonderへ返さない。syntheticでは人工catalogの固定JSON bytesのhashを用い、TS fixtureにも同じ値を渡す。音楽の特徴抽出・正規化パラメータもfeature版に固定し、学習後に40曲だけで再fitしない。

checkpointはローカルで生成・検証したstate_dictのみを読み、`weights_only=True` を明示する。任意の外部pickleを許すfallbackは追加しない。保存/復元後のeval出力をCPU上で許容差付き比較する。

### 5. `retrieval.py` の候補統合仕様

純粋な推論関数としてHTTPから分ける。全候補のzは起動時に固定し、モデル更新には新artifactと再起動を必要とする。

1. 除外はcurrent曲と全graph node IDの和集合。除外後の曲数をE、返却件数を `n=min(limit,E)` とする。E=0は空配列の正常結果。
2. Interest logitsから全Cコードの確率を得る。確率降順、同点はコードID昇順で上位 `k_eff=min(K,C,n)` コードを選び、選択集合上で確率を再正規化する。n=0はこの計算を省く。
3. 各コードにまず1枠割り当て、残り `n-k_eff` 枠を確率比例＋最大剰余法で整数配分する。同剰余はコードID順。この最低1枠はSonder試作の探索規則であり、論文指定とはしない。
4. 各uと全eligible zの内積で経路別順位を作る。同点はtrack IDの辞書順。quota分だけ選び、重複を統合する。
5. 候補unionを `sum_k p_k * dot(u_k,z_i)` の降順で並べる。同点はtrack ID順。重複でn件未満なら、残りeligible全体の同じscore順から埋める。取得経路やquotaはdebug情報としてローカルで確認できるようにするが、UIに内部実装の説明を増やさない。
6. 全scoreの有限性を検査し、n件・一意・除外遵守を保証する。全件内積と全eligible補完は小規模用で、`ponytail:` コメントに規模の限界とANNへの移行条件を書く。

このquota・統合規則はSonder独自の明示的な補完。SPARC-Hardの論文再現と呼ばず、将来の比較では同じモデルに対する「均等quota」など、差を一つだけ変えた別設定として扱う。

### 6. HTTPと `SparcProvider` の契約

S3はstdlibのローカルHTTPサーバーを薄く被せる。`127.0.0.1` のみbind、`POST /recommend`、JSONのみ、最大body 64 KiB、未知routeは404。CORSは起動時に指定したローカルUI origin一つだけ許可し、preflightを扱う。任意originや外部bindへ広げない。これは公開用サーバーではない。

request例（hashは説明用の略記）：

```json
{
  "schema_version": "sparc-request-1",
  "artifact_id": "<manifest SHA-256>",
  "catalog_sha256": "<served catalog SHA-256>",
  "current_track_id": "fma-015769",
  "history_track_ids": ["fma-023371"],
  "excluded_track_ids": ["fma-015769"],
  "limit": 8
}
```

responseは `{schema_version: "sparc-response-1", artifact_id, catalog_sha256, recommendations: [{track_id, score}]}`。serverは曲名・URL・音源を返さない。adapterが注入されたcatalogのTrackへ解決する。S3のテストでは人工catalog、S5では `fmaById` を使う。

server/adapter双方でschema、必須/余分なkey、ID、hash、整数limit（1〜8、boolean不可）、長さ、有限score、一意性、除外を検査する。historyとexcludedは別概念なのでhistory曲がexcludedに含まれること自体は正常。requestの重複excluded IDは拒否する。成功時は `min(limit, eligible_count)` 件で、少数/0件を障害の代替にしない。

エラーは `{error: {code, message}}`。400=INVALID_REQUEST、409=ARTIFACT_MISMATCH/CATALOG_MISMATCH、422=HISTORY_REQUIRED、500=INFERENCE_FAILED。起動時のartifact不正はサーバー起動を失敗させる。HTTP成功でも不正bodyならadapterはrejectする。timeout初期値は3秒、`AbortController`＋finallyでtimer解除。自動retryや無言のbaseline fallbackを入れない。

adapterのconstructor引数は `{endpoint, artifactId, catalogSha256, catalog, fetchImpl?}`。fetchImplは標準fetchが既定で、既存node:testで通信を差し替えるためだけに注入する。classは既存 `RecommendationProvider` を実装し、入力型への変更は `historyTrackIds?: string[]` の追加だけをS3で許す。返却は `RecommendedTrack[]`、scoreは `scores.relevance` に載せるが、確率・serendipityと表示しない。S3ではdependencies/store/UIに配線しない。

### 7. S5の接続変更を行う順序

S4までに実曲artifactを用意できない場合はここへ進まない。syntheticモデルを既定providerにすることで未完了を隠さない。

**A. 構成と識別情報**

`dependencies.ts` に推薦器の識別情報を一緒に保持し、provider本体とIDが食い違わないよう構成時に一組で設定する。初版はbuild時切替のみ。既定はbaseline。SPARC選択時はendpoint/artifact ID/catalog hashが全て必須で、設定欠落は明示的な設定エラーとする。Next.js側にPython modelをimportしない。公開HF workflowの設定は変更しない。実装時にローカルNext.js guideの環境変数・静的exportの該当節を読む。

`ExplorationSession` にSPARC用のartifact IDを追加し、既存 `providerId` と `buildProvenance` は再利用する。SPARCは `sparc-prototype-v1`、Jaccardは既存ID。検証済みartifactとcatalogの組合せはセッション開始時に固定する。途中で変われば新規セッションが必要。

**B. 履歴と最初の操作**

初版は**現在のセッションで明示的にLike/Saveされた曲だけ**を推論履歴にする。再生・閲覧・枝クリックは履歴に入れない。`src/services/sparc.ts` 内の小さな純粋関数で `interactionEvents` の配列順をreplayし、track×like/saveごとにadded/removedを反映する。一方でも有効なtrackを残し、有効な反応の最後の配列indexで並べ、一曲一回、直近50曲とする。壁時計の巻戻りで順序を変えない。collectionのIDだけから過去の時刻や反応順を捏造しない。

`expand()` のawait前に履歴をコピーして `historyTrackIds` に渡す。返却待ち中のLikeで過去の要求入力を変更しない。再生履歴や複数session横断の嗜好モデルは後続とする。S4の音楽学習ラベルがこの信号と整合しない場合は接続せず、データprotocolを設計者に戻す。

履歴ゼロはseedノードと試聴を利用可能にしたまま、「この曲が好みならLike/Saveし、もう一度展開してください」と表示する。反応前に架空の推薦を返さない。seedへの明示反応後に同じノードを再展開できることをテストする。既にcollectionでLike済みでも今回の履歴へ自動変換しない。この仕様は上の「baseline別セッションへ案内する初期案」を具体化・更新する。ユーザーはbaseline設定へ戻すこともできる。

**C. storeと保存**

`start/expand/emit` にあるdataset=FMAだけのcase/event生成条件を、datasetとproviderの両方で判定する。SPARCでは0.2 `cases/researchEvents/nodeOriginCaseId` を作らず、既存 `interactionEvents` とgraphを保持する。SPARCの返却にも一意性・除外・上限検査と既存requestId/sessionIdのstale guardを適用し、後から黙って順位を変えない。genre件数がないときは0を捏造しない。

baselineの保存keyは `sonder.exploration.v2` を維持する。SPARCは `sonder.exploration.sparc.v1.<artifact_id>`。initializeだけでなく、debounce persist・pagehide・clearも同じ選択keyを使用する。SPARC側からbaseline/v1 keyをfallback読込しない。collectionは既存の共有keyでよい。

`isFmaDemoSession` のJaccard/export上の意味は保持する。SPARCのprovider/artifact/catalog/source一致を検査する別の小さな判定を追加し、`isLegacyCatalogSession` が有効なSPARCまで一律拒否しないよう呼出元を整理する。一般的なgraph構造検査は `restoreSession` を再利用し、新しい識別フィールドを追加検証する。key分離は同一build内のprovider切替保護であり、旧buildのmapを新buildへ移行する保証ではない。従来のsource hash不一致拒否を維持する。

**D. exportと表示**

`Explorer.tsx` のcanExportと理由表示をprovider対応にする。SPARCのexportは「この推薦方式の研究出力は準備中」と表示して無効化する。UIだけでなく `buildV2.ts:bundleFromSession` にもdataset/provider検査を置き、`sessionExport.ts`・再export入口・直接呼出の全てを保護する。`validateV2.ts` のJaccard順位照合、0.1/0.2のwire schemaは変更しない。

同じ `Explorer.tsx` にある「shared genres」前提の説明をSPARC時だけ実際の方式に合わせる。見た目やグラフ配置は変えない。SPARCが返さないsharedGenreCountをノードに0として埋めない。新規codeを由来情報に含め、`schemaV2.ts:SOURCE_FILES_V2` と `write-provenance.ts` の責務を確認する。追加のsource hashは既存契約の範囲で記録し、modelのartifact IDは別に保持する。

### 8. 検査と差分の完了基準

既存のnode:testとPython標準unittestを使用し、新しいtest frameworkは入れない。S1/S2のPython検査は一つの `test_model.py` にまとめ、HTTP境界も同じファイルから実際にloopbackサーバーを立てて一往復確認する。

| 検査 | 最小限の失敗条件 |
|---|---|
| モデル | shape不一致、padding漏れ、空履歴、非有限loss、推薦lossからcodebookへの勾配なし |
| 学習 | syntheticでpositive/negativeを区別できない、出力先上書き、checkpoint読込後の出力不一致 |
| 検索 | quota合計違い、同点で不安定、重複/除外違反、全件除外時に非空、件数不足の隠蔽 |
| API/adapter | unknown ID、NaN、余分なkey、hash違い、重複、timeout、500、壊れたJSONを成功扱い |
| 履歴 | クリック混入、removed後も残る、like取消で有効saveまで消える、要求後の反応混入 |
| store/保存 | 遅延応答が別sessionに入る、履歴ゼロから再試行不能、別provider key上書き、artifact違いで復元 |
| export | SPARCを0.2としてexport可能、または既存0.1/0.2が通らない |

実装後の予定コマンド（今回は未実行）：

```sh
# repo root。pythonはモジュール用環境を有効化したもの
python -m unittest discover -s recommendation/sparc -p 'test_*.py'
python -m recommendation.sparc.train --smoke --output /private/tmp/sonder-sparc-smoke-001
npm test
npm run typecheck
npm run build -- --webpack
```

S1〜S3ではPython/adapter検査と既存test/typecheckを行い、依存追加以外でbundleに影響がある場合にbuildも行う。S5ではbuildとブラウザ確認を必須とする。browserはbaselineの3開始曲・2回展開、SPARCのseed試聴→Like/Save→再展開、drag、reload、通信失敗表示、baseline復帰、export不可理由を確認する。旧0.1/0.2 reader確認はS5で既存CLI exportを使い、Researchの現在の手順に従って再実行する。

完了報告は「変更ファイル、実行した検査と結果、未検証、次の単位」を `.codex/IMPLEMENTATION_STATE.md` に記録する。人工smoke成功、音楽モデルの品質、UI接続、公開を別々に報告する。S1〜S3の合格だけで「SPARC導入完了」としない。

### 9. 軽量モデルへ渡す指示文

以下はユーザーが実装開始を指示した後に渡す文面。現時点では送信・実行していない。

> SPARC.md「コード実装計画」のS0〜S3だけを実装してください。正本は /Users/macuser/dev/graph-rec、計画の現保存先は /Users/macuser/orca/workspaces/graph-rec/plan/SPARC.md です。AGENTS/PLAN/IMPLEMENTATION_STATEと計画の最新差分を読み、採用範囲を正本とResearch master PLANへ記録してから着手してください。既存GenreJaccardProviderとmock、UI、dependenciesの既定値、40音源は保持してください。人工データでRQ・tower・6種loss・決定的検索・HTTP/TS adapterを検査し、音楽データの選定・本学習・UI配線・0.3・公開は始めないでください。コードブックの推薦loss勾配、未知ID/版違い/timeout拒否を検証してください。データや設計が不足する部分を推測して置換せず、影響と最小代案を返してください。各単位の検査結果と残作業を既存状態文書へ記録してください。

### 10. 実装時の参照

- 論文：[SPARC v2](https://arxiv.org/abs/2508.09090v2)。上記の独自補完を区別する。
- [PyTorch attention](https://docs.pytorch.org/docs/2.14/generated/torch.nn.functional.scaled_dot_product_attention.html)：bool maskのtrueは参加要素。評価時もdropout引数を明示して0にする。
- [PyTorch serialization](https://docs.pytorch.org/docs/2.14/notes/serialization.html)：state_dictとweights-only読込。ここで参照したdocsの版をインストール済み版と取り違えず、実装環境の対応APIを確認する。

追記時の検証はソースの呼出元照合と文書差分検査のみ。実装、依存インストール、学習、agentへの委任は未実施。

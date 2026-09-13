# Research export contract — version 0.1

設計担当：Astra。2026-09-13。状態：設計確定。実装はAstraレビュー待ち。この文書は契約の正本であり、実装済みの証拠ではない。
実装担当はSolまたは別agent。Phase 3だけが実装対象。Phase 4には進まない。

## 目的と範囲

既存MockRecommendationProviderの入力と出力を固定してEngineeringからResearchへ渡し、同じケースを検査・再利用できるようにする。
Phase 3はオフラインの接続検証。新しいUI、実サービス接続、ML、LLM呼び出し、本人回答の収集、データベース、共有SDKを含めない。
UIへの記録機能の組み込みはPhase 4、本人評定とLLM出力の実データ形式はPhase 5で拡張する。
元のTrack / RecommendationContext / RecommendationProviderは再利用する。既存画面やproviderをこの形式へ全面変更しない。

## 設計判断

- 課題：研究と製品の実装を二重管理すると、何を評価したか追えなくなる。
- 仮説：一つの推薦要求を単位とした固定データで、製品と研究を疎結合にできる。
- 根拠：Graph-Recにはprovider境界が既にあり、モデルやUIを変えず入出力を取得できる。
- 結果：未実装・未計測。Phase 3の受入検査で確認する。

## 単位と不変条件

1 caseは「一つの推薦要求と、それに対する順序付きの候補列」。1曲ではない。
case_idはbundle内で一意。候補曲への将来の評定は(case_id, track_id)で結合する。同じ曲が別caseに現れることは許す。
1 bundleは一つのprovider・設定・データ版・入力条件を使う。条件が違えば別bundleにする。
同じ入力とprovider出力を渡したserializerは、同じcases.jsonlのbytesを生成する。日時・IDは呼び出し側から与え、serializer内で生成しない。
現在のmockが決定的であることを検査する。将来のAPIや学習モデルに、無条件の再生成一致を保証しない。

## ファイル

UTF-8、BOMなし、改行LF。JSONLは1行1object、末尾改行あり。NaN/Infinity、重複JSON keyを拒否する。キーはJSON文字列としてデコードしてから比較し、`\u0063ase_id`のようなエスケープも同一キーとして扱う。
次の4ファイルを未使用の出力ディレクトリへ保存する。既存ディレクトリは上書きしない。

| ファイル | Phase 3の内容 |
|---|---|
| manifest.json | 下記の版・由来・件数・cases hash |
| cases.jsonl | 1件以上のmock推薦ケース |
| human-ratings.jsonl | 0 bytesの空ファイル。実回答と見せるダミー評定を入れない |
| llm-predictions.jsonl | 0 bytesの空ファイル。実予測を作らない |

空ファイルは「未取得」。0点や一致率0とは解釈しない。version 0.1のreaderは両ファイルが非空ならunsupportedとして失敗する。
本人尺度、欠測理由、モデル出力型、split方式はPhase 5で別versionとして確定する。現段階で1〜5尺度を発明しない。

## manifest.json

追加keyは禁止。すべて必須。nullableと書いたものだけnullを許す。

| field | 型・制約 |
|---|---|
| schema_version | string、厳密に `0.1` |
| bundle_id | 空でないstring。デモでは固定IDでよい |
| created_at | UTCのISO 8601、`Z`終端。形だけでなく実在する日付・時刻。月は1–12、日はその月の日数（閏年はグレゴリオ）、時0–23、分秒0–59。`24:00:00`と閏秒60は不可 |
| purpose | 厳密に `integration_test` |
| data_kind | 厳密に `synthetic` |
| producer | object、次の4項目だけ |
| producer.project | 厳密に `Graph-Rec` |
| producer.commit | 40桁小文字hexまたはnull。未commitならnullでよい |
| producer.dirty | booleanまたはnull。commitがnullならnull |
| producer.source_files | 相対POSIX path→SHA-256小文字hexのobject。非空。source treeから直接hashを取る |
| provider | object、`id`=`mock-recommendation`、`config`={} |
| dataset | object、`id`=`sonder-fictional-catalog`、`sha256`=実際に使うsrc/mocks/tracks.tsのbytes hash |
| case_count | 正の整数、cases行数と一致 |
| cases_sha256 | cases.jsonlそのもののbytesのSHA-256 |

source_filesにはexport処理、domain/types.ts、services/recommendation.ts、mocks/tracks.ts、package.json、package-lock.jsonおよび推薦出力に影響するローカルimportを含める。最低限の対象を実装で固定し、repo全体をhashしない。
相対pathは`..`・絶対pathを禁止する。readerはこの一覧を開いたりネットワークへ取得したりしない。source照合は別の検証であり、hash記録だけで実行再現済みとは言わない。
commitがあってもdirtyなら、そのcommitだけが実行コードを表すと説明しない。

## cases.jsonl

追加keyは禁止。以下は必須。

| field | 型・制約 |
|---|---|
| case_id | 空でないstring、bundle内一意 |
| participant_id | 厳密にnull。Phase 3で実人物IDを作らない |
| session_id | 空でない合成string |
| requested_at | created_atと同じ実在UTC。fixtureから固定値を渡す |
| input | 下記のobject |
| recommendations | 下記のobject配列、1〜input.limit件 |
| presentation | 厳密に {"mode":"not_presented"} |

inputのkeyはcurrent_track_id、session_path、explored_track_ids、limitの4つ。
current_track_idはstring。session_pathは非空のstring配列で末尾がcurrent_track_id。explored_track_idsは重複のないstring配列で、current_track_idとsession_pathの全IDを含む。
limitは1〜100の整数。boolを整数と扱わない。
履歴曲のIDはこのbundleのdataset内に存在することをexporterで確認する。readerはネットワーク照合しない。
playlistContextはversion 0.1では受け付けない。非空なら省略せずunsupportedで失敗する。サービス由来の識別子を持ち込まない。

recommendationsの各要素はrank、trackの2項目のみ。
rankは1から連続した整数。providerが返した順序を保持する。track.idはcase内一意で、input.explored_track_idsに含まれない。
trackは既存Trackからid、title、artistsだけを選んだsnapshot。id/titleは空でないstring、artistsは1人以上の配列、各要素はname（非空string）だけ。
追加metadata・scoresはversion 0.1では出力しない。mockのscoresが非空になった場合は黙って捨てずunsupportedとして設計見直しを求める。
座標、画像URL、試聴URL、外部サービスID、自由記述イベントはこの研究入力に含めない。

例（表示の都合で複数行。実ファイルは1行）：

```json
{
  "case_id": "case-001",
  "participant_id": null,
  "session_id": "synthetic-session-001",
  "requested_at": "2026-09-13T00:00:00Z",
  "input": {
    "current_track_id": "demo-seed",
    "session_path": ["demo-seed"],
    "explored_track_ids": ["demo-seed"],
    "limit": 1
  },
  "recommendations": [
    {"rank": 1, "track": {"id": "demo-next", "title": "Example", "artists": [{"name": "Demo Artist"}]}}
  ],
  "presentation": {"mode": "not_presented"}
}
```

例の曲IDは説明用。実装fixtureは既存mock catalogの実際のIDを使う。
生成済み候補は表示済み・試聴済みの証拠ではない。推薦順序は順位記録であり、実際の画面の表示順や位置ではない。
session_pathは探索経路であり、好みや聴取履歴とは呼ばない。F/R/E・global評定をinputへ入れない。

## 実装単位

### Engineering

- 既存providerを直接呼ぶ小さなCLIを1つと、serializer/validatorを必要最小限のファイル数で作る。
- 入口案：`npm run export:research -- --output <未使用ディレクトリ>`。Node/TypeScriptと既存tsx、標準fs/cryptoを利用する。
- 固定したseed要求と、その候補を次のseedとする要求の2ケースを出力する。fixtureは合成session・日時を使用する。
- 既存CompositionやUI・storeには配線しない。mock catalogとproviderの実コードを利用し、候補をfixtureに手書きしない。
- 本体の生成失敗時は成功と報告しない。部分出力ならその場所を報告し、再試行では別出力先を使う。

### Research

- 入口案：`python -B studies/music-evaluator/validate_export.py <bundle-dir>`。
- Python標準ライブラリでJSON、hash、型、key、ID、rank、件数、空の評定ファイルを検査する。型契約だけの共有パッケージや新しいframeworkは作らない。
- 全行検証が完了するまでcaseを下流へ返さない。失敗時は非zero終了し、ファイル・行・違反fieldを示す。
- 正常時はcase数・候補数・schema版を出力する。モデル評価・human validityの数値は出さない。
- Graph-Rec checkoutへの絶対path、node_modules、MovieLens、旧v0環境に依存しない。

両実装は同じ明示仕様を検査する。Python readerはbundleを読むだけで、URL取得やコード実行をしない。

## 受入検査

1. 実mockから生成した2ケースをPython readerで読み込み、順序・title・artist・入力IDの一致を確認する。
2. 同一fixtureを2回、異なる未使用ディレクトリへ生成し、casesのbytesとhashが一致する。
3. 未知schema、欠落/余分key、誤型、NaN、重複JSON key、重複case ID、rank欠落/重複、case内の重複曲・既探索曲を拒否する。
4. casesのbyte改変・行数不一致を拒否する。構造違反の検査ではhashを再計算したbundleも使い、hash検査だけでテストが通ったとしない。
5. `input.human_rating`等の評定混入、非null参加者、非空の評定/予測ファイル、`presentation.mode`の偽装を拒否する。
6. 既存出力先への再実行を拒否し、元の4ファイルのhashが変わらない。
7. Engineeringの既存test・typecheck・buildを実施。UI変更は予定しないので、ブラウザ検証を実施したと報告しない。

小さな実行可能検査を残す。正常fixtureだけでなく、上記の破損fixtureをメモリまたは一時ディレクトリで生成する。
完了時に実行コマンド、結果、未検証事項、変更ファイルを各状態文書へ記録し、Astraへレビューを返す。Phase 4には自動で進まない。

## 引き継ぎ

この設計文書は実装済みの証拠ではない。version 0.1のexporter・reader・受入検査は実装済みでAstraレビュー待ち。Phase 4には進まない。

# Phase 4 — 40曲の面接デモ

2026-09-13。Astra設計・Sol実装。Documentsの原文が読めないため、確定済み会話と監査記録から復元した仕様。原文とのバイト一致は未確認。新正本で実装・3修正を再検査する。

## 確定範囲

ユーザー決定：最初から40曲の限定CCカタログ。面接官が1〜2分で開始曲→候補→探索→試聴→Like/Saveを体験できること。20曲の中間目標と100曲への拡張は完了条件に含めない。
既存UI、枝保持、配置、drag、保存、復元を継続する。アカウント、新APIサーバー、学習、LLM評価、参加者募集、deployは後続。

## 固定データ・配信

docs/fma40-audit.jsonの40曲を正本とする。曲ID、直接genre、MP3内の出典と正確なライセンス、hash、実測時間を記録。勝手に入れ替えない。
40曲、30,254,221 bytes（28.9 MiB）、各29.989〜30.015秒、全曲ffmpegデコード成功。CC BY 3.0 US 26曲、CC BY 3.0 14曲。Folk 8、Electronic 9、Hip-Hop 14、Rock 9。
メタデータと音源タグでライセンスが異なるTRG Banksサンプル、および版付き音源ライセンスが欠落した候補は除外。監査の根拠はFMA公式配布snapshotと音源タグ。個別の現在Webページ、権利者への確認、全曲の主観的試聴は未確認。
FMAのfma_small.zipはHTTP RangeとZIP central directoryによる部分取得が成立した。206/Content-Rangeを確認し、200で全件を返す場合は停止。フルアーカイブへ自動フォールバックしない。取得後に採用40曲のSHA-256を照合。部分取得のCRC検査を全アーカイブ公式SHA-1検査と混同しない。
public/audio/fma/<6桁ID>.mp3として静的同梱し、同じoriginからaudio/mpegで配信する。外部ストリームを実行時に要求しない。再エンコード・再切出しはせず、FMA提供の約30秒抜粋をそのまま使用する。プレーヤーには元曲の長さではなく実測したクリップ長を渡す。
曲詳細から曲名・作者・出典・正確なCC BY版を確認できるようにする。提供されたalbum/composer/copyright等はCREDITS.mdに保持。メタデータ自体のCC BY 4.0クレジットも記載。コードと音源のライセンスを混同しない。
歌詞、画像、略歴、メタデータ全文は取り込まない。既存の汎用artworkはデモ表示として使用する。

## 既存コードへの接続

RecommendationProviderとdependencies.tsを利用。mockは0.1用に保持。検索等のmocks/tracks直接依存は必要範囲で確認し、実デモへ架空曲を混ぜない。mockサービス接続は実デモの入口から外す。
開始曲はThe Factory (fma-015769)、I Want To Destroy Something Beautiful (fma-023371)、I'm Not Lazy (fma-075782)。検索は40曲内。入口のキュレーションとアルゴリズムの推薦候補を区別する。
直接genre集合のJaccard、同点は数値FMA ID順。全graph node曲を除外。最初8曲、展開7曲、不足時は少数/0件。共通なしは「別ジャンルも探索」と表示し、個人の好みやserendipityスコアとは呼ばない。
40曲のmetadata試算では3開始曲とも8/7/7・計23曲一意。初回の共通genreなしは各5/8、1/8、2/8、2要求目は全て7/7。共通属性候補が早く尽きる小規模デモの制約。推薦品質の改善は未評価。
Like/Saveは明示反応として記録し、初版の順位には使わない。選択曲だけを既存audio要素で再生。preloadはmetadata/none。全音源の自動ロードや自動再生はしない。再生拒否・404・デコードエラーを表示する。

## 実ケース出力・検査

docs/research-export-v0.2.mdが実曲出力の正本。0.1はmock専用で維持。要求時点の入力・候補・由来情報を固定し、後の操作や再buildで置換しない。
実装順：40曲のhash/帰属/静的配信→検索/開始曲/providerと試聴・2回展開→0.2記録・ブラウザ出力・Research reader→test/typecheck/buildとブラウザ検証。
3開始曲、2回展開、Like/Save、reload、legacy拒否、再生失敗、exportを確認する。音源デコードはブラウザ再生検証の代わりにならない。件数、総容量、試聴成功数、候補取得時間を報告。500-node FPS、主観品質、experienced serendipityは未計測ならそう記す。
レビュー修正：保存時catalog/source hash照合、TSの3hash再計算とbundle内catalog使用、CLIで全候補を除外し1/9/16・23曲一意。

## 根拠・判断

FMA公式：https://github.com/mdeff/fma
CC BY：https://creativecommons.org/licenses/by/3.0/ 、 https://creativecommons.org/licenses/by/3.0/us/
metadata：https://creativecommons.org/licenses/by/4.0/
課題：外部サービスに依存せず実曲の探索・固定ケース出力を見せたい。仮説：少量の配布可能な音源を静的同梱すれば現在のUIを保てる。根拠：40曲のユーザー要件、静的export、部分取得・デコード検査。結果：データ監査済み。実アプリの検証範囲はIMPLEMENTATION_STATE.mdに記録する。

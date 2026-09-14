# Sonder：設計判断と確認先

READMEの3つの判断を、既存の仕様・実装に対応づけた案内です（2026-09-14の事後整理）。個人開発の設計・実装範囲を示します。

<a id="exploration"></a>
## 1. 探索と好みを別々に記録する

**課題**：気になって開いた曲が、好きな曲とは限らない。探索のクリックを好みとして扱うと、後から何を評価しているのか曖昧になる。

**判断と理由**：枝の展開と、明示的なLike / Saveを別のイベントとして保持する。クリックから好みを推定する方法は採らず、操作の意味を残す。

**実装**：[イベントとセッションの型](https://github.com/t3-sketch/graph-rec/blob/bfead93453a0ff879e7592bba173fd46ca470fd3/src/domain/types.ts)、[枝展開・イベント記録・Like / Saveの切り替え](https://github.com/t3-sketch/graph-rec/blob/bfead93453a0ff879e7592bba173fd46ca470fd3/src/store/exploration.ts)（`expand` / `emit` / `toggle`）。推薦器には探索済みIDを除外条件として渡し、Like / Saveからの好みの学習は行っていない。

**結果と限界**：探索と明示反応を別々に保存できる。閲覧・再生イベントは注意や聴取を保証せず、Like / Saveも研究用の人間評定ではない。`explored_track_ids`は未クリック候補を含む除外集合であり、聴いた曲の一覧ではない。意味の定義は[export仕様のCases / Events](research-export-v0.2.md)を参照。

<a id="ranking-layout"></a>
## 2. 推薦順位と画面上の距離を分ける

**課題**：探索の枝を見やすく配置する要件と、候補曲を選ぶ要件は異なる。画面の距離を推薦スコアと結びつけると、移動操作や配置調整の意味が曖昧になる。

**判断と理由**：候補はジャンルの共通度で順位づけ、配置は枝の向きと衝突回避で決める。スコアを幾何的な距離に変換する方法は採らず、推薦器と配置処理を別々に差し替えられる構成にした。

**実装**：[ジャンルJaccardの順位づけ](https://github.com/t3-sketch/graph-rec/blob/bfead93453a0ff879e7592bba173fd46ca470fd3/src/services/genreJaccard.ts)、[配置処理](https://github.com/t3-sketch/graph-rec/blob/bfead93453a0ff879e7592bba173fd46ca470fd3/src/graph/placement.ts)、[両者を順に呼ぶ処理](https://github.com/t3-sketch/graph-rec/blob/bfead93453a0ff879e7592bba173fd46ca470fd3/src/store/exploration.ts#L81)。配置の入力は現在位置・既存ノード・候補数で、推薦スコアは渡さない。

**結果と限界**：画面は探索経路を表す。近い曲ほど好みに合う、という表示ではない。40曲の固定カタログに対するbaselineであり、推薦品質や発見体験の改善は未計測。

<a id="frozen-export"></a>
## 3. 推薦時の条件と生成元を固定して書き出す

**課題**：後から現在の状態だけを保存すると、その候補を出した時点の入力やコード版を取り違える可能性がある。

**判断と理由**：推薦要求時の入力と、画面に採用された候補をケースとして保持する。セッション開始時のカタログ・ソースのhashも保持し、異なる版のセッションを新しい版として書き出さない。現在の画面から過去の入力を推測して復元する方法は採らない。

**仕様・実装・検査**：[schema 0.2の契約](research-export-v0.2.md)、[要求時の入力と採用候補の保存](https://github.com/t3-sketch/graph-rec/blob/bfead93453a0ff879e7592bba173fd46ca470fd3/src/store/exploration.ts#L72)、[既存のexport検査](https://github.com/t3-sketch/graph-rec/blob/bfead93453a0ff879e7592bba173fd46ca470fd3/tests/research-export-v02.test.ts)。検査にはhashの不一致、順位の改変、生成元が異なるセッションの拒否が含まれる。

**確認できていること**：[2026-09-14の公開検証記録](../.codex/IMPLEMENTATION_STATE.md)には、ブラウザで保存したJSONをResearch側のreaderで検査した結果がある。hashは整合性の確認であり真正性の証明ではない。人間評定・LLM評定は空で、評価用データの受け渡しまでの実装である。

この案内の追加では、アプリや既存検査を変更・再実行していません。コードリンクは照合した公開版に固定しています。

[READMEに戻る](../README.md)

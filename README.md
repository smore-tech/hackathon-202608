# ブラウザゲーム 1日ハッカソン — 企画検討プロトタイプ

> **これはゲームの完成版ではありません。**
> 「実際に触ったとき、どの企画が一番面白そうか」を判断するためだけに作られた、**企画検証用のプロトタイプ／Mock** です。
> ステージ数も演出も、判断に必要な最低限に絞ってあります。

現在、**2つのテーマ**で検討中です。

| | テーマ | 検証したいこと |
| --- | --- | --- |
| **A** | [URL共有型 Code Golf](#a-url共有型-code-golf3案) | 「問題そのものをURLに埋め込み、URLを送るだけで同じ問題を遊べる」は面白いか |
| **B** | [単発ゲーム性の検証](#b-単発ゲーム性の検証3案) | 短時間で作れて、それ自体が面白いゲームルールはどれか |

まず **[index.html](index.html)** をブラウザで開いてください。全6本のプロトタイプへの入口になっています。

```sh
open index.html
```

ビルドもサーバーも不要です。HTML + CSS + Vanilla JavaScript のみ。

---

## A. URL共有型 Code Golf（3案）

**最大の特徴は「URLがゲームデータそのもの」であること。**
バックエンドもDBも使わず、Challenge は URL の fragment に入っています。

```text
route-golf/index.html#c=eyJ2ZXJzaW9uIjoxLCJ0eXBlIjoicm91dGUi...
                      ↑ この文字列がステージデータ
```

`JSON → UTF-8 → Base64 URL Safe` という単純な方式です。GitHub Pages のような静的ホスティングだけで動き、URLをコピーするだけで共有できます。
**解答はURLに含めていません**（開いた人が答えを見ずに挑戦できるように）。

| | ゲーム | 一言で言うと | 遊ぶ | 企画書 |
| --- | --- | --- | --- | --- |
| 1 | **ROUTE GOLF** 🤖 | F / L / R だけでロボットをゴールへ。命令数がスコア。 | [route-golf/index.html](route-golf/index.html) | [docs/route-golf.md](docs/route-golf.md) |
| 2 | **PIPELINE GOLF** 🔧 | 関数を並べて INPUT を TARGET に変換。関数の数がスコア。 | [pipeline-golf/index.html](pipeline-golf/index.html) | [docs/pipeline-golf.md](docs/pipeline-golf.md) |
| 3 | **REGEX GOLF** 🎯 | MATCH だけに当たる正規表現を書く。文字数がスコア。 | [regex-golf/index.html](regex-golf/index.html) | [docs/regex-golf.md](docs/regex-golf.md) |

📊 **[3案の比較 — docs/comparison-golf.md](docs/comparison-golf.md)**

### 共通ループ

```text
CREATE → SHARE URL → SOLVE → RESULT → RETRY / REMIX
```

3本とも画面上部の **PLAY / CREATE** タブで切り替えます。

- **PLAY** — 共有された Challenge を解く
- **CREATE** — 自分で Challenge を作る（作りながら「解けるか」「最短は何手か」が出ます）
- **SHARE CHALLENGE** — 現在の Challenge を URL にしてコピー
- **REMIX** — いま開いている Challenge をコピーした状態で CREATE へ。元のURLは書き換わらず、**新しいURLが発行されます**
- **COPY RESULT** — 結果を貼り付け用テキストに（解答は含みません）

各ゲームに Easy / Medium / Hard のサンプル Challenge を用意してあります。
壊れたURLや別ゲームのURLを開いた場合は `Invalid Challenge` を表示し、DEFAULT CHALLENGE が遊べます。

### 遊び方

**ROUTE GOLF** — `F`(前進) `L`(左回転) `R`(右回転) を並べて `RUN`。キーボードの `F` `L` `R`、`Enter`(RUN)、`Backspace`(UNDO) も使えます。壁や盤外に進もうとすると `CRASH`。CREATE では盤面をクリックして EMPTY / WALL / START / GOAL を配置し、`AUTO` で最短+1のPARが入ります。

**PIPELINE GOLF** — 左の関数を押して PIPELINE に積み、`RUN`。各ステップの途中結果が順に表示されます（空白は `·` で可視化）。順番を変えると結果が変わります。使えるのは事前定義された安全な関数だけです（`eval` は一切使いません）。

**REGEX GOLF** — 入力欄に正規表現を打つと、その場で全行の ✅ / ❌ が更新されます。スラッシュとフラグは不要。MATCH 全部に当たり、DO NOT MATCH に1つも当たらなければ CLEAR。

---

## B. 単発ゲーム性の検証（3案）

URL共有とは別軸で、先に検討した3案です。

| | ゲーム | 一言で言うと | 遊ぶ | 企画書 |
| --- | --- | --- | --- | --- |
| 1 | **あと1手** パズル | 操作できるのは1回だけ。その1手で敵を全滅させてゴールに入れ。 | [one-move-puzzle/index.html](one-move-puzzle/index.html) | [docs/01-one-move-puzzle.md](docs/01-one-move-puzzle.md) |
| 2 | **10秒先を当てる** | この5体が殴り合ったら、最後に立っているのは誰か。予想して、見守るだけ。 | [future-prediction/index.html](future-prediction/index.html) | [docs/02-future-prediction.md](docs/02-future-prediction.md) |
| 3 | **見えない迷路** | 迷路が見えるのは最初の3秒だけ。あとは記憶を頼りにゴールへ。 | [memory-maze/index.html](memory-maze/index.html) | [docs/03-memory-maze.md](docs/03-memory-maze.md) |

📊 **[3案の比較 — docs/comparison.md](docs/comparison.md)**

### 遊び方

**あと1手パズル** — 方向ボタン / 矢印キー / WASD で1方向を選ぶ（1回だけ）。🤖 は壁にぶつかるまで滑り、通り道の 👾 を倒し、➡ で曲がる。**敵を全滅させたうえで 🏁 に入って止まる**とクリア。全3問。

**10秒先を当てる** — 最後まで生き残ると思うキャラをタップして `START`。介入はできません。SPEEDが高いほど攻撃間隔が短く、攻撃相手は「自分のひとつ右の生存者」。乱数はゼロなので、同じ編成なら結果は必ず同じです。

**見えない迷路** — `START` で迷路が数秒表示され、カウントダウン後に壁が消えます。矢印キー / WASD / 方向ボタン / スワイプで移動。壁にぶつかると「壁ドン」が加算され、その壁は以後ずっと見えるようになります。

---

## ドキュメント一覧

```text
docs/
├── route-golf.md            A-1 企画書（+ Prototype Review）
├── pipeline-golf.md         A-2 企画書（+ Prototype Review）
├── regex-golf.md            A-3 企画書（+ Prototype Review）
├── comparison-golf.md       A 3案比較
├── 01-one-move-puzzle.md    B-1 企画書（+ Prototype Review）
├── 02-future-prediction.md  B-2 企画書（+ Prototype Review）
├── 03-memory-maze.md        B-3 企画書（+ Prototype Review）
└── comparison.md            B 3案比較
```

各企画書の末尾には **Prototype Review** があり、「企画時点の想像」と「実際に触った感触」を分けて記録しています。

## 構成

```text
.
├── index.html               ← まずここを開く（6本すべての入口）
├── README.md
├── docs/                    企画書と比較ドキュメント
├── shared/
│   ├── url-codec.js         Challenge ⇄ URL fragment の変換・共有ユーティリティ
│   └── golf.css             URL Golf 3本の共通スタイル
├── route-golf/index.html
├── pipeline-golf/index.html
├── regex-golf/index.html
├── one-move-puzzle/index.html
├── future-prediction/index.html
└── memory-maze/index.html
```

- ビルドツール・バックエンド・npm・外部APIは不要。`index.html` を直接開けば動きます。
- 各ゲームは1ファイル完結。中身は **ゲームロジック（DOM非依存）** と **画面** の2セクションに分けてあり、ロジックだけ切り出して動かせます。
- 将来的な GitHub Pages 公開を想定しています（相対パスのみ・サーバー処理なし）。

## 想定している使い方

```text
index.html を開く
↓
6本すべてを実際に遊ぶ
↓
企画書と Prototype Review を読む
↓
comparison-golf.md / comparison.md で並べて比べる
↓
ハッカソンで作る1本を決める
```

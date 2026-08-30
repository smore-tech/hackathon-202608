# HACKATHON ARCADE

サーバーもDBも使わない、**4本立てのブラウザゲーム集**。
GitHub Pages にそのまま載る完全な静的サイトで、ビルド成果物を除けば HTML + CSS + Vanilla JavaScript しかありません。

| | ゲーム | 一言で言うと | コンテンツ量 |
| --- | --- | --- | --- |
| 🤖 | **[ROUTE GOLF](route-golf/)** | `F` / `L` / `R` だけでロボットを ★ 経由でゴールへ。命令数がスコア。 | 16ステージ + エディタ |
| 🔧 | **[PIPELINE GOLF](pipeline-golf/)** | 31種類の関数を並べて INPUT を TARGET に変換。関数の数がスコア。 | 16ステージ + エディタ |
| 🔮 | **[10秒先を当てる](future-prediction/)** | 乱数ゼロの自動戦闘。最後に立っている1体を当てる。 | 12編成 + ランダム生成 |
| 🌀 | **[見えない迷路](memory-maze/)** | 壁が見えるのは最初の数秒だけ。記憶だけでゴールへ。 | 12ステージ / 4モード |

入口は **[index.html](index.html)** です。

---

## 動かす

ES Modules を使っているため `file://` では動きません（ブラウザのCORS制限）。ローカルでは HTTP で開いてください。

```sh
npm run serve     # → http://localhost:4173
npm test          # ゲームロジックと画面配線のテスト
npm run build     # 公開用ファイルを _site/ に集める
```

**依存パッケージは0個**です（`npm install` は不要）。Node.js 20 以上があれば動きます。

## 公開（GitHub Pages）

`main` に push すると [.github/workflows/pages.yml](.github/workflows/pages.yml) が動き、
テスト → `_site/` の生成 → Pages へのデプロイまで自動で走ります。

初回だけ、リポジトリの **Settings → Pages → Build and deployment → Source** を
**GitHub Actions** にしてください（ブランチ配信ではありません）。

- [.github/workflows/ci.yml](.github/workflows/ci.yml) — main 以外への push と PR でテストを回す
- [.github/workflows/pages.yml](.github/workflows/pages.yml) — main への push でテスト＋デプロイ

`_site/` には配信するものだけを入れます（`tests/` `scripts/` `.github/` は入りません）。
何を配信するかは [scripts/build-site.mjs](scripts/build-site.mjs) の `INCLUDE` に書いてあります。

---

## 4本に共通する設計

### 1. 問題データは URL そのもの

ROUTE GOLF と PIPELINE GOLF は、Challenge を URL の fragment に入れて共有します。

```text
route-golf/index.html#c=eyJ2ZXJzaW9uIjoxLCJ0eXBlIjoicm91dGUi...
                      ↑ この文字列がステージデータ
```

`JSON → UTF-8 → Base64 URL Safe` という単純な方式です（[shared/url-codec.js](shared/url-codec.js)）。
見えない迷路は seed を、10秒先を当てるはランダム編成の seed を、同じ仕組みで共有します。

**URLから復元するのは「データ」だけで、コードは絶対に復元しません。**
`eval` / `new Function` は一切使っておらず、使っていないことをテストで検査しています。

### 2. 記録はブラウザの中だけ

クリア状況・ベストスコア・★は localStorage に保存します（[shared/storage.js](shared/storage.js)）。
サーバーには何も送りません。プライベートモードなど localStorage が使えない環境でも、
記録が残らないだけでゲームは普通に動きます。

### 3. ロジックと画面を分ける

各ゲームは次の構成です。

```text
<game>/
├── index.html   画面の骨組み（DOMと見た目）
├── logic.js     ゲームのルール ← DOMを一切触らない。テスト対象
├── stages.js    ステージ / 編成のデータ（ゲームによっては logic.js に同居）
└── main.js      logic.js と DOM をつなぐ
```

`logic.js` がブラウザに依存しないので、Node.js からそのまま import してテストできます。

### 4. PAR と解答は「計算」する

ゴルフ2本のステージは、PAR を手で書きません。
起動時に**最短手数を探索して `PAR = 最短 + 1`** にしています。
PIPELINE GOLF に至っては TARGET すら手で書かず、模範解答を INPUT に流した結果を TARGET にしています。
おかげで「解けない問題」「PARがズレた問題」を出荷できません。

---

## テスト

```sh
npm test
```

- **ロジック** — 全ステージがクリア可能か、最短解が実際にクリアするか、
  全編成が決着するか、生成した迷路が完全迷路か、など
- **画面配線** — `main.js` が触っている id が HTML に存在するか、
  参照しているファイルが実在するか、id が重複していないか
- **一貫性** — ポータルに書いたステージ数と実際のステージ数が一致しているか

ブラウザを起動しない代わりに、「よくある壊れ方」を静的に潰す方針です。

---

## 構成

```text
.
├── index.html                  ポータル（進捗つき）
├── shared/
│   ├── base.css                4本 + ポータル共通のテーマ
│   ├── url-codec.js            Challenge ⇄ URL fragment
│   ├── storage.js              localStorage への進捗保存
│   └── ui.js                   DOM まわりの小物
├── route-golf/                 ROUTE GOLF
├── pipeline-golf/              PIPELINE GOLF
├── future-prediction/          10秒先を当てる
├── memory-maze/                見えない迷路
├── prototypes/                 公開対象外の検証用プロトタイプ（REGEX GOLF / あと1手パズル）
├── docs/                       企画書と比較ドキュメント（末尾に実装版の差分あり）
├── scripts/                    ローカルサーバーと公開用ビルド
├── tests/                      node:test のテスト
└── .github/workflows/          CI と Pages デプロイ
```

## ドキュメント

| ドキュメント | 中身 |
| --- | --- |
| [docs/route-golf.md](docs/route-golf.md) | ROUTE GOLF の企画書 + 実装版の差分 |
| [docs/pipeline-golf.md](docs/pipeline-golf.md) | PIPELINE GOLF の企画書 + 実装版の差分 |
| [docs/02-future-prediction.md](docs/02-future-prediction.md) | 10秒先を当てるの企画書 + 実装版の差分 |
| [docs/03-memory-maze.md](docs/03-memory-maze.md) | 見えない迷路の企画書 + 実装版の差分 |
| [docs/comparison-golf.md](docs/comparison-golf.md) | URL共有型ゴルフ3案の比較（企画時点） |
| [docs/comparison.md](docs/comparison.md) | 単発ゲーム性3案の比較（企画時点） |

`prototypes/` の2本（REGEX GOLF / あと1手パズル）は公開対象から外した企画検証用のモックで、
ポータルからはリンクしていません。記録として残してあります。

## 遊び方

**ROUTE GOLF** — `F`(前進) `L`(左回転) `R`(右回転) を並べて `RUN`。キーボードの `F` `L` `R`、`Enter`(RUN)、`Backspace`(UNDO) も使えます。★を全部拾ってから 🏁 に入るとクリア。壁や盤外に進もうとすると `CRASH`。CREATE タブで盤面を自作し、URLで共有できます。

**PIPELINE GOLF** — 左の関数を押して PIPELINE に積み、`RUN`。各ステップの途中結果が順に表示されます（空白は `·` で可視化）。順番を変えると結果が変わります。CREATE タブの RECIPE で自作の問題を作れます。

**10秒先を当てる** — 最後まで生き残ると思うキャラをタップして `START`。介入はできません。攻撃対象の決め方は編成ごとに違い（右どなり / 弱い者いじめ など）、特性（とげ・よろい・回復・激昂・二連撃）が絡みます。乱数はゼロなので、同じ編成なら結果は必ず同じです。

**見えない迷路** — `START` で迷路が数秒表示され、カウントダウン後に壁が消えます。矢印キー / WASD / 方向ボタン / スワイプで移動。壁にぶつかると「壁ドン」が加算され、その壁は以後ずっと見えるようになります。鍵ありモードは 🔑 を拾ってから 🏁 へ。`SHARE` で同じ迷路のURLを渡せます。

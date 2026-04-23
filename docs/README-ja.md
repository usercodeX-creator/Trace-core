<h1 align="center">Trace</h1>

<p align="center">
  <strong>AI が書いたコードを、Trace が読む。</strong>
</p>

<p align="center">
  <a href="./README.md">English README →</a>
</p>

---

Trace は AI が生成したコードを対象にした、OSS の静的解析ツールです。LLM だけが書く 24 個の失敗パターン — 存在しないパッケージの import、ソースに直書きされた認証情報、握り潰された例外、何も検証していないテスト、嘘をついている型 — を検出します。

Snyk、Semgrep、SonarQube はこれらを捕まえません。それらは**人間の**バグを前提に作られているからです。AI は違う書き方をします。Trace は違う読み方をします。

```bash
npx trace-core your-file.py
```

インストール不要。ログイン不要。MIT ライセンス。6 言語対応。

## 検出するもの

24 パターン × 6 言語。失敗の**形**で分類しています (言語別ではなく)。

**サプライチェーン (2)**
- `hallucinated-deps` — npm/PyPI に存在しないパッケージの import (または攻撃者が先回りして登録したパッケージ、いわゆる *slopsquatting*)
- `go/slopsquatting` — 有名モジュールに酷似した Go モジュールパス

**認証情報 (3)**
- `credential-leak` — API キー、トークン、パスワードがソースに直書き
- `go/hardcoded-secret` — Go バイナリの同現象 (`strings <binary>` で抽出される)
- `hardcoded-localhost` — 本番まで残る `http://localhost:3000`

**サイレント障害 (4)**
- `silent-exception` — `except: pass`、`catch {}` など、エラーを握り潰すハンドラ
- `ruby/silent-rescue` — Ruby 版
- `go/error-ignored` — Go の `_` で `error` を捨てるパターン
- `missing-await` — `async` 関数を `await` せずに呼ぶ (終わっていないのに終わったように見える)

**インジェクション (5)**
- `dynamic-eval` — `eval()` / `exec()` にユーザー入力
- `ruby/eval-injection` — Ruby の `eval` / `send` / `constantize` にユーザー入力
- `go/sprintf-sql` — `fmt.Sprintf` で組み立てた SQL
- `ruby/string-interpolation-sql` — Ruby の文字列補間で組み立てた SQL
- `unsafe-sanitize` — 手書きのサニタイズ (必ず穴がある)

**Mass assignment / 認可 (1)**
- `ruby/mass-assignment` — Rails コントローラが `params` をそのままモデルに渡している

**型安全の嘘 (1)**
- `fake-type-safety` — `as any`、`as unknown as Foo`、`@ts-ignore` で型エラーを握り潰す

**偽のテスト (1)**
- `tautological-test` — `expect(true).toBe(true)`、スキップされたテスト、絶対に落ちないアサーション

**Rust の正当性 (4)**
- `rust/unwrap-abuse` — 入力依存の値に `.unwrap()` / `.expect()`
- `rust/panic-macro` — ライブラリコードで `panic!` (`Result<T, E>` を使うべき)
- `rust/todo-macro` — `todo!()` / `unimplemented!()` が本番に残っている
- `rust/unsafe-block` — safe な API で済むのに `unsafe { ... }` を使っている

**暗号 & 設定 (3)**
- `insecure-rng` — `Math.random()` / `random.random()` をトークン生成に使用
- `env-no-fallback` — `process.env.X` に検証が無く、`undefined` が静かに伝播する
- `deprecated-api` — 削除予定の API (LLM は学習時点で deprecated になっていたことを知らない)

すべての検出は、[Playground](https://tracecheck.dev/ja/playground) 上で**なぜ問題か**と**どう直すか**を日英両方で表示します。

## なぜ存在するか

AI が生成するコードの**形**を考えてみてください。

人間が `except: pass` と書くときは、たいてい手抜きで、レビューで気付かれます。LLM が `except: pass` と書くときは、それが「エラー処理」というプロンプトに対する**デフォルトの答え**です。人間のレビュアーは `except` の文字を見て、何かが処理されたと思い込み、本番に流れます。

人間が `import super-helper-validator` と書くときは typo で、npm install が止めます。LLM が書くときは**幻覚**で、攻撃者はすでにその架空のパッケージ名を npm / PyPI に登録し始めています。このサプライチェーン攻撃には名前がついています: *slopsquatting*。

人間が `expect(true).toBe(true)` と書くときは、それがプレースホルダーだと自分で分かっています。LLM が書くときは、「テストを書いて」と言われたから**テストらしい形のもの**を生成しただけです。CI は緑、カバレッジは 100%、本番は壊れます。

これらは通常の意味でのバグではありません。チュートリアルコードで学習され、もっともらしさに最適化され、スケールで出荷されるモデルの、**予測可能な出力**です。人間のバグ向けに作られたツールがこれらを見逃すのは、この分布の失敗を前提にしていないからです。

Trace はこの分布のために作られました。

## クイックスタート

```bash
# 1 ファイル
npx trace-core your-file.py

# ディレクトリ
npx trace-core src/

# JSON 出力 (他ツールと連携するとき)
npx trace-core src/ --format json
```

検出が無ければ exit code `0`、あれば `1`。CI の判定はこれだけで足ります。

## 対応言語

Python, JavaScript, TypeScript, Go, Rust, Ruby。

検出の深さは言語ごとに違います。Python / JS / TS が最も深いのは、AI 生成コードが最も多く書かれているのがその 3 言語だからです。Go / Rust / Ruby は、それぞれの言語で最もシグナルが強い失敗パターンに絞っています。

## 他ツールとの違い

| | Trace | Snyk | Semgrep | SonarQube | Claude /ultrareview |
|---|---|---|---|---|---|
| AI 固有の失敗を対象にしている | ✓ | ✗ | ✗ | ✗ | 部分的 |
| LLM 中立 (ベンダーロックなし) | ✓ | ✓ | ✓ | ✓ | ✗ |
| 静的解析 (1 スキャン $0) | ✓ | フリーミアム | フリーミアム | フリーミアム | 1 スキャン $$ |
| OSS | ✓ | ✗ | 部分的 | ✗ | ✗ |
| 幻覚 import を検出 | ✓ | ✗ | ✗ | ✗ | 部分的 |
| 意味のないテストを検出 | ✓ | ✗ | ✗ | ✗ | 部分的 |
| インストール不要 | ✓ | ✗ | ✗ | ✗ | Claude Code に紐付き |
| 任意の LLM の出力で動く | ✓ | n/a | n/a | n/a | Claude のみ |

Trace は Snyk や Semgrep の代替ではありません。その**1 つ上の層**です。CVE スキャンは Snyk で、チーム固有のルールは Semgrep で、その 2 つの間にある LLM 特有の失敗を Trace で。

## インストール

```bash
# 1 回実行 (推奨。何もインストールしない、常に最新)
npx trace-core src/

# プロジェクトローカル
npm install --save-dev trace-core

# グローバル
npm install -g trace-core
```

## CI 連携

```yaml
# .github/workflows/trace.yml
name: Trace
on: [push, pull_request]

jobs:
  trace:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx trace-core src/
```

GitLab CI、Bitbucket Pipelines、CircleCI、Jenkins でも同様に動きます。Trace は stdout に出力、検出があれば非ゼロで終了します。CI はそれだけあれば充分です。

## ブラウザで試す

[tracecheck.dev/ja/playground](https://tracecheck.dev/ja/playground) — コードを貼って、チェックを押すだけ。インストール不要、ログイン不要、アカウント不要。

## 設計思想

**AI 固有に特化、汎用ではない。** Trace は Snyk や Semgrep を置き換えようとしません。モデルが生成するコードで出現する失敗パターン**だけ**を、狭く深く扱います。すべての detector は、実際に AI が本番コードでそのパターンを生成しているのを観測した上で追加されています。

**中立な第三者。** Trace は Anthropic、OpenAI、その他どの LLM ベンダーも作っていません。どのモデルの出力でも走ります。AI 企業が自社モデルの欠陥カタログを出すことには構造的な利益相反があります。中立なツールにはそれがありません。

**OSS を続ける。** 24 detector はすべて MIT です。利用制限なし、明示的同意なしのテレメトリなし、コア機能を enterprise ティアで囲い込むこともしません。このリポジトリにある、今日の、無料のもので、すべての検出が完結します。

## ロードマップ

公開ロードマップは CHANGELOG と GitHub Issues です。短く言うと:

- **v0.8**: opt-in データからの detector チューニング (最初の *Trace Index* 月次レポートと同時リリース)
- **v0.9**: プロジェクトごとの severity 上書きと suppression 用の設定ファイル
- **v1.0**: 安定性の確約 — detector の意味を 1 メジャーバージョン固定

ETA は約束しません。できたら出します。

## Trace Index

Trace は月次レポートを出します: AI 生成コードの失敗パターンの集計、言語 / モデル / detector ごとの内訳。opt-in テレメトリから構築。第 1 号は 2026 年 5 月。

詳細は [tracecheck.dev/insights](https://tracecheck.dev/insights) (準備中)。

## コントリビューション

Issue と PR を歓迎します。新しい detector を提案する場合は、以下を添えてください:

- 失敗の**実例** (仮想的なものではなく)
- それを生成した LLM (Claude / GPT / Cursor など。もしくは "不明、Stack Overflow の AI 回答から発掘")
- 既存ツールがなぜ見逃すか

新 detector の採用基準は: **「人間は書かない、AI だけが書くパターンであること」**。人間も書くなら、Snyk か Semgrep の領域であって Trace ではありません。

## ライセンス

[MIT](./LICENSE)。

## リンク

- **Web サイト**: [tracecheck.dev](https://tracecheck.dev/ja)
- **Playground**: [tracecheck.dev/ja/playground](https://tracecheck.dev/ja/playground)
- **English README**: [README.md](../README.md)
- **npm**: [trace-core](https://www.npmjs.com/package/trace-core)
- **作者**: [@usercodeX-creator](https://github.com/usercodeX-creator) · 東京

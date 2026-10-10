# Care Manager Quest

知らない問題を推理で攻略し、知識をつなげるスマホ向けWebゲーム。**令和7年度（2025年度・第28回）介護支援分野の公式過去問25問**で、5問ずつ遊べます。

[非公開プレビュー](https://care-manager-quest.kriver2135.chatgpt.site) / GitHubがソースの正本です。privateを維持し、mainへのマージは手動です。

## 遊び方

1. 「5問のクエストを始める」を押す。
2. 指定された2つ／3つの選択肢を選んで確定する。番号は原典どおり1〜5、順不同の完全一致で正解。
3. 正答・XP・コンボを確認して「次の問題へ」または「詳しく見る」。原本画像と知識マップの論点を参照できる。
4. 5問終了時にリザルト。「もう5問」で続ける。
5. 記録タブから履歴をJSONで持ち出す。

本文と選択肢を原本照合した問1〜23は通常のテキストUIで表示。逐語校正が未完了の問24・25は原本画像と番号ボタンで出題します。画像は拡大・スクロール・別画面での表示が可能です。全問で原本を参照できます。

独自解説は25問すべて未登録です。未検証の説明を生成して埋め込むことはありません。正答は**2025年度試験当時**のものとして採点します。現行法への適合性は未確認です。

## 出典と利用条件

問題の著作権：**公益財団法人 社会福祉振興・試験センター**。東京都福祉局掲載の問題冊子・正答公表と、ユーザー提供の画像付きデータを使用しています。

- [公式問題冊子](https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/r7shikenmondai)
- [公式正答の公表](https://www.fukushi.metro.tokyo.lg.jp/kourei/shikaku/r7_seitoukijyun)
- [試験センターの利用条件](https://www.sssc.or.jp/pastissues/index.html)

利用条件を確認（2026-10-10）。教育目的等の利用では許諾申出・使用料は不要ですが、著作権は保持され、文言の変更は禁止されています。問題本文・選択肢の要約や改変はしていません。**独自の分類・解説・ゲーム機能は試験センターと関係がありません。**

## 開発

Node.js 22以上、npm。サーバー・DB・APIキー・LLM APIは不要です。

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

iPhone実機は同じネットワークから開発端末のIPとポートへアクセスできます。E2EはiPhone 13相当の390×664・タッチ設定でChromium/WebKitを起動します。実機Safari・音声・指操作の確認は別途必要です。

## 保存とデータ設計

- 問題本文・原典・正答・分類・品質状態・履歴は分離。静的JSONをProviderで結合します。
- `2025-01`〜`2025-25`は分類から独立したID。問題の版番号は内容・採点契約用、分類のrevisionは別です。
- 各解答に分類ID・分類revision・難度のスナップショットを保存し、分類修正後も履歴・XPを維持。
- localStorageに自動保存。JSONの入力は2MBまで、プレビュー後に明示的に置換。
- schemaVersion 1の履歴は2へ移行。移行前データを退避し、旧問題の履歴・XP・理解記録を保持します。旧問題の途中クエストは終了します。
- 旧練習問題は履歴参照専用アーカイブで、本番の出題対象に入りません。
- 保存が壊れた場合は自動上書きせず、退避・回復操作を表示。

履歴は配信元URL・ブラウザごとに保存されます。プライベートブラウズやサイトデータ削除では失われることがあります。多タブ同時編集・同期・大容量履歴は今後の課題です。

## ドキュメントと残る作業

- [設計](docs/design.md)
- [取り込み・原本照合・正答の確認台帳](docs/question-verification.md)
- [権利と出題範囲](docs/research-and-rights.md)
- [検証結果・画面](docs/validation.md)
- [ロードマップ](docs/roadmap.md) / [デプロイ](docs/deployment.md)

[逐語校正・再校正 #9](https://github.com/KKawamura1/care-manager-quest/issues/9)、[独自解説 #10](https://github.com/KKawamura1/care-manager-quest/issues/10)、[法改正チェック #11](https://github.com/KKawamura1/care-manager-quest/issues/11)を未完了として管理します。2018〜2024年度は同じパック構造で追加できます。

GitHub Actionsで型チェック・単体テスト・本番ビルド・Chromium/WebKit E2Eを実施し、distとテスト画面をArtifactsに保存します。

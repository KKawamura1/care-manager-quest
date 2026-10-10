# ロードマップ

MVPは5問を快適に遊べることを優先します。将来機能は以下の順で、各Issueの受入条件を満たして追加します。

1. **権利確認と問題Provider**：原文と独自解説の権利、配布・加工・AI入力可否、更新責任を確認。許諾情報のないデータは取り込まない。
2. **問題レビュー・版管理・分野拡張**：専門家レビュー、より推理できる事例、A/Bの未カバー項目、Cの医療・福祉問題。問題改訂後も旧履歴を保つ移行契約。
3. **詳細な知識マップと概念習熟度**：分類の粒度・関連概念をレビューし、正誤と自己申告を分離した推定を導入。根拠と不確実性を表示。
4. **適応的難易度**：履歴から出題を最適化しつつ、初見の推理と難度の緩急を維持。公平なXPと再現可能な選択。
5. **AI支援**：許諾済み資料だけをサーバーで処理。解説・分類をドラフト化し、一次資料の根拠と人のレビューを要求。キーをブラウザへ渡さない。
6. **履歴同期と保存耐性**：認証・所有者単位の同期、オフライン・競合解消・多タブ排他、大容量履歴、バージョン移行。
7. **privateリポジトリの継続デプロイ**：Cloudflare Pages等の連携・本人限定アクセス・PRプレビュー・本番ロールバック。

## GitHub Issues

- [#1 許諾に基づく過去問Provider](https://github.com/KKawamura1/care-manager-quest/issues/1)
- [#2 専門家レビュー・版管理・分野拡張](https://github.com/KKawamura1/care-manager-quest/issues/2)
- [#3 詳細マップと概念習熟度](https://github.com/KKawamura1/care-manager-quest/issues/3)
- [#4 適応的難易度](https://github.com/KKawamura1/care-manager-quest/issues/4)
- [#5 AI解説・分類](https://github.com/KKawamura1/care-manager-quest/issues/5)
- [#6 同期・大容量・競合解消](https://github.com/KKawamura1/care-manager-quest/issues/6)
- [#7 継続デプロイ](https://github.com/KKawamura1/care-manager-quest/issues/7)

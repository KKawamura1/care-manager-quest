# 2025年度 全60問・テキスト正本

2026-10-10 提供の `care_manager_2025_all60_text_import.zip` の `data/care_manager_2025_all60.json` を正本とします。Gitでは元のJSONを **無損失Brotli圧縮** した `imports/care_manager_2025_all60.json.br` に保存しています。ビルド・型チェック・テスト前に `scripts/import-2025.mjs` が原データの SHA-256 を確認し、従来の問題・正答・分類・品質ファイルを生成します。著作者の原文は自動補正しません。

全60問は問題文と5選択肢を通常のテキストUIに表示します。正答は2または3の集合完全一致です。標準で介護支援（問1〜25）を出題し、ホームで医療・福祉・全分野へ切替できます。設定は学習履歴とは別の保存領域を使い、設問IDおよび既存の履歴・XPを維持します。

**品質注意:** README_IMPORT.md と verification_report.txt により、問1〜25はOCR補助、問26〜60は原本画像の初回人手転記で、60問全ての独立した逐語校正は未実施です。 `pending` のまま表示し、疑義があれば原本画像・出典PDFに従います。既存25問の以前の単独照合歴があっても、二重校正完了とは記録しません。正答表の今回の独立した再照合、現行法適合性、独自解説も未実施です。

**画像について:** 既存の問1〜25の画像を保持します。問26〜60の原本切り出し画像は元ZIPに存在しますが、GitHubへの転送・格納が未完了の場合は公式PDFへのフォールバックリンクで原典を確認できます。ZIP内の60枚の画像のSHAは正本JSONに残します。全画像の一致は別途アップロード検証が必要です。

原典: https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/r7shikenmondai
利用条件: https://www.sssc.or.jp/pastissues/index.html

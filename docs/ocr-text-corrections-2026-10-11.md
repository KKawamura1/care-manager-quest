# OCR混入テキスト修正記録（2026-10-11）

## 2024年度・全60問

- 対象：`imports/2024/questions.json` の問題文60件と選択肢300件。2024年に公式PDFから取得した未校正OCRが著しく崩れていたため、**全60問の設問文と選択肢を公開されている別の文字掲載元の文面へ置き換え**た。
- 照合・転記元：ウェルミーマガジン「ケアマネ試験 過去問題と解答（2024年10月13日実施）第27回」 https://www.kaigojob.com/magazine/job-qualification/care-manager-exam0008
- 参考となる独立掲載元：https://kaigosearch-plus.jp/certification/past-exam/caremanager-exam-27th
- 試験原本：https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/r6shikenmondai-pdf
- 例：`2024-01` 選択肢1「同大」→「同居」、選択肢5「特別姜護老人ホーム」→「特別養護老人ホーム」。`2024-10` 設問の誤読「8つ選べ」→「3つ選べ」。`2024-39` 選択肢5「草人」→「薬剤師」。
- 記録：`text_status=cross_checked_public_transcription_official_proofread_pending` として、二次掲載元URL、作業日を各設問に保存。
- **限定**：民間サイトの独自誤記を含め試験原本PDFとの独立した逐語照合は未完了。公式原文との一致を保証するものではない。問題文・選択肢以外の正答、必要選択数、設問ID、分類、画像SHA・原本参照情報は保持。正答の独立検証および当時法令／現行法の検証も対象外。
- このリポジトリは `scripts/import-history.mjs` が `imports/2024/questions.json` から実行時の年度別パックを生成するため、**生成パックを手で編集しない**。

## 2006～2009年度・PDFのふりがな流入6箇所

翔泳社掲載の当時の問題PDFで、ルビ（ふりがな）が**次の選択肢ではなく前の選択肢の末尾に付着した誤抽出**と目視確認した部分のみ削除した。

| 問題ID | 選択肢 | 除去した末尾 | 原因（次の選択肢のルビ） |
| --- | --- | --- | --- |
| 2006-39 | 4 | `つい   す み か` | 終の棲家 |
| 2006-44 | 3 | `え   そ` | 壊疽 |
| 2006-56 | 3 | `つい   す み か` | 終の棲家 |
| 2007-42 | 2 | `ご え ん` | 誤嚥 |
| 2008-28 | 3 | `え   そ` | 壊疽 |
| 2009-28 | 2 | `は こ う` | 跛行 |

原本PDF：
- 2006 https://www.shoeisha.co.jp/static/exampress/fukushi/pdf/caremanager/careman_H18_09th.pdf
- 2007 https://www.shoeisha.co.jp/static/exampress/fukushi/pdf/caremanager/careman_H19_10th.pdf
- 2008 https://www.shoeisha.co.jp/static/exampress/fukushi/pdf/caremanager/careman_H20_11th.pdf
- 2009 https://www.shoeisha.co.jp/static/exampress/fukushi/pdf/caremanager/careman_H21_12th.pdf

`docs/pre2018-import-audit.json` および `quality.json` の元の `textSha256` は**当初取り込み時点の監査値**として残す。今回の修正後の文字列のハッシュではない。出典・採点・分類・学習履歴を変更しない。

## 検証

- 2024年60問すべての設問文または選択肢に修正がある。60 ID の順番、各5選択肢、設問の選択数（2/3つ）と既存 `required_choices` が一致することをJSON構造比較で確認。
- 2024年度の既存フィールドで変更したのは `stem`, `choices`, `text_status`, `data_origin.question_text` と追加の二次掲載元メタデータだけ。
- 2006〜2009は上記6箇所の選択肢文字列以外は変更していない。
- ローカルでの `npm test` および `npm run build` はGitHubコネクタ経由の編集環境で実行できていないため、CIの結果を確認すること。公式PDFに対する二重校正は既存issue #17, #19で引き続き管理する。

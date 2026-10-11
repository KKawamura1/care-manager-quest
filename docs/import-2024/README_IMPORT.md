# Care Manager Quest 2024年度（令和6年度・第27回）インポート

> **2026-10-11更新：** 元の未校正OCRは2024年度の全60問について、民間の過去問文字掲載元との照合に基づく読める文面へ置換しました。ここに記載する「未校正OCR」は元のインポート作業の説明です。公式PDFとの独立逐語照合は未完了であり、本文を校正済み原文と断言しないでください。詳細は [修正記録](../ocr-text-corrections-2026-10-11.md) を参照してください。

## 収録対象

- **全60問**：問1〜25「介護支援分野」、問26〜45「保健医療サービス分野」、問46〜60「福祉サービス分野」。
- 各問題について公式PDFの該当部分を1問ごとのPNGに切り出し、正答番号と併せてJSON化しています。
- OCRを使って**全60問の問題文と選択肢1〜5を構造化**しましたが、**本文は未校正です**。OCRには誤字・脱字・読み飛ばしが残っています。試験原文と断言したり、変更した文言を原文として公開したりしないでください。

## 内容

| パス | 内容 |
|---|---|
| `data/care_manager_2024_all60.json` | 60問の問題データと未校正OCR本文、5つの選択肢、正答、出典、画像パス、検証状態 |
| `data/care_manager_2024_official_answer_key_60.json` | 前回作成の2024年度正答データ（再照合は未実施） |
| `assets/questions/2024/q01.png` ～ `q60.png` | 公式PDFの1問ごとの原本画像（全60問） |
| `ocr/questions/2024/q01.txt` ～ `q60.txt` | OCRの生出力（修正なし）。校正の参照材料 |
| `care_manager_2024_all60_structured_ocr.txt` | 全60問を「問題→選択肢→正答」の形式に整理したテキスト（未校正） |
| `care_manager_2024_all60_ocr.txt` | 全60問のOCR生出力を連結したテキスト |
| `sources/r6shikenmondai-pdf.pdf` | 提供された2024年度公式問題PDF |
| `verification_report.txt` | 各問題の機械検証と残タスク |

## アプリ実装上の注意

- **問題表示は `preferred_rendering: original_image_until_text_proofread` に従い画像を優先**。OCRテキストのみを校正済みの原文として表示してはいけません。
- `stem`、`choices` は全問にデータがありますが、`text_status` は `transcribed_ocr_assisted_proofread_pending`。将来、照合済みの問題だけ切り替えてください。
- すべて5択、正解は2つまたは3つ。回答時には `correct_choices` 配列との完全一致で採点します。
- `id` は `2024-01` ～ `2024-60`。既存の `2025-*` と分離した学習履歴を使ってください。
- 年度選択を追加する場合、既存の2025データや実装を破壊せず2024年度を追加します。
- `primary_group`、`primary_concept_id`、`topic_title` は未分類のため `null`。内容を読まずにデータだけで推測しないこと。
- 独自解説なし・現行法チェック未実施。2024年試験当時の正答をそのまま保持してください。

## 出典・著作権

- 問題の著作権：公益財団法人 社会福祉振興・試験センター。
- 問題PDF：https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/r6shikenmondai-pdf
- 正答PDF：https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/r6seitoubangou-pdf
- 過去問題利用条件：https://www.sssc.or.jp/pastissues/index.html

同センターは一定の教育目的に沿ったアプリへの過去問題利用を認める一方、著作権を留保し、問題の文言変更を禁止しています。**公開用途でOCR文面を校正せずに原文として扱うことは避けてください。** 独自の説明・解説が同センター作成ではないことも区別してください。

## 完成までの残課題

1. 原本画像と逐語照合してOCRテキストを校正する（全60問）。
2. 正答表と再照合し、コードテストを行う。
3. 知識マップ分類・独自解説・2026年現行法との差異確認。
4. アプリに年度切り替え・原本表示・問題文コピー（OCR未校正表示に注意）を実装する。

# Care Manager Quest - 2023年度公式過去問 全60問（全文テキスト＋原本画像）

2023年度（令和5年度／第26回）介護支援専門員実務研修受講試験の全60問を取り込むためのファイルです。

## 同梱

- `data/care_manager_2023_all60.json`: 全60問の問題文（stem）、選択肢（choices）、公式正答番号、必要選択数、その他メタデータ
- `data/care_manager_2023_all60_text.csv`: 人手確認用の全60問テキストCSV
- `data/care_manager_2023_answer_key_60.csv`: 先行作成した公式解答の索引
- `data/question_image_manifest.json`: 問題画像の元PDFページ・SHA-256一覧
- `assets/questions/2023/q01.png` ... `q60.png`: 問題ごとに切り出した原本画像
- `source/mondai_2023.pdf`: ユーザーが添付した原本PDF
- `verification_report.txt`: 形式検証と未確認事項
- `WORK_UPDATE_PROMPT.md`: ChatGPT Workへの依頼文

## 出題ルール

- 2023年度問1〜25：介護支援分野
- 問26〜45：保健医療サービスの知識等
- 問46〜60：福祉サービスの知識等
- 5択から2つまたは3つを選択し、`correct_choices` と完全一致で採点
- 原本画像は質問画面の原典確認からいつでも開けるようにする
- 本文・選択肢は全60問とも文字UIで表示可能
- `2023-01`〜`2023-60` のIDは変更しない。アプリ側の回答履歴との整合性を保つ
- 2025年度データを上書きせず、学習対象の「年度」に2023を追加する

## 注意

- 全60問の本文はあるが、**原本PDFとの独立した逐語二重校正は未実施**です。`text_status` は `transcribed_proofread_pending` としました。
- 現行法による妥当性・公式解説の有無は未確認。独自解説を原文に混ぜたり、問題文を改変したりしないこと。
- 問1〜25は既存の二次資料転記を維持。問26〜60は公開された全文テキストを参照して構造化し、問題原本画像をスポットチェックしています。
- 出典・著作権・利用条件を確認したうえで教育用途として利用すること。

参考：2023年度東京都公式問題 https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/r5shikenmondai
公開転記の参考： https://www.kaigojob.com/magazine/job-qualification/care-manager-exam0009
利用条件: https://www.sssc.or.jp/pastissues/index.html

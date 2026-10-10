# Care Manager Quest 2022年度（第25回）問題データ

## 内容

- `data/care_manager_2022_all60.json`: 全60問の問題文 `stem`、5つの選択肢 `choices`、正答 `correct_choices`、必要選択数 `required_choices`、暫定知識分類（`primary_group`/`primary_concept_id`）
- `data/care_manager_2022_official_answer_key_60.json`: 公式正答60問の別インデックス
- `data/care_manager_2022_index.csv`: QA・カテゴリ点検用索引
- `assets/questions/2022/q01.png`～`q60.png`: 原本PDFから切り出した問題画像
- `ocr/questions/2022/q01.txt`～`q60.txt`: OCRの生テキスト
- `verification_report.txt`: 検証結果と未実施の校正工程

## 2025年度データとの互換

2025データ同様の `schema_version: 1.0` / `questions[]` を利用し、IDは `2022-01`～`2022-60` と独立。
各問で `id`, `domain`, `stem`, `choices`, `correct_choices`, `required_choices`, `topic_title`, `primary_group`, `primary_concept_id`, `image_path` を利用してください。
介護支援分野25問を初期範囲にし、残り35問は分野設定で選べるようにしてください。
全60問を通常のテキストUIで出題し、画像は確認用に残します。複数選択は番号集合の完全一致で採点します。

**重要**：テキスト化はOCR補助であり、独立した二重校正は未実施です。画像と本文が異なる場合は画像が正本です。OCRの誤りを推測だけで訂正しないでください。
カテゴリは2025年版に整合する暫定分類であり、学習履歴・ゲーム内習熟度とは別に保持してください。

正答参照元： https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/r4seitoubangou

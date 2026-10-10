# Care Manager Quest — 2020年度（令和2年度・第23回）60問

このZIPは、2020年度試験の問題文と選択肢を抽出し、Care Manager Questへの取り込みを想定したデータです。

## ファイル

- `data/care_manager_2020_all60_text.json`: メタデータ＋全60問のJSON (`questions`配列)
- `data/care_manager_2020_all60.json`: 問題レコードだけの配列（インポーター向けの別表現）
- `assets/questions/2020/q001.png`〜`q060.png`: 添付原本PDFを各問に沿って切り出した画像
- `r2shikenmondai.pdf`: ユーザー提供の原本全文
- `verification_report.txt`: 自動検証結果、未解決の校正上の注意
- `WORK_UPDATE_PROMPT.md`: Care Manager Quest更新用の指示文

## データ仕様

- `id`: `care_manager_2020_001` の形式で固有。同じIDを再取り込み時にも維持する。
- `year`: 2020、`question_number`: 1〜60、`domain`/`field`: 出題分野。
- `stem`: 問題本文、`choices`: **文字列5個の配列**。番号は配列インデックスに1を加えたもの。
- `correct_answers`/`answer`: **1始まりの選択肢番号**の配列。`required_choices`は2または3。
- `category`/`subcategory`: 学習用の暫定カテゴリキー、`knowledge_category_label`: 内容に基づく日本語の暫定分類。
- `source_image`: 各問画像のZIPルートからの相対パス、`source.pdf_page`: 原本PDFの1始まりのページ。
- `explanation`: null（根拠がない解説を作らない）。

## 必ず確認すること

1. **2020年度の全文は画像PDFからのOCR結果を含み、独立した二重校正は未実施**です。明瞭なOCR誤読を一部手動修正していますが、残りもありえます。原本画像を参照して校正してください。
2. 正答番号は公表されている2020年度の解答一覧2種類との照合値です。テキストと正答を取り違えないよう、選択肢番号1〜5は固定してください。
3. `category`/`subcategory`はこのZIP用の**暫定分類**であり、2025年版の実際のカテゴリマスターとの互換を検証していません。既存の知識分類マスターへの対応表を作り、意味でマッピングしてください。
4. 過去問は**2020年当時の法令・介護報酬**を前提とします。2026年時点の正誤へ勝手に更新・修正しないでください。制度改正の補足は独立した説明メタデータで管理してください。
5. 2025年版を正本として、2020年は**年度追加**として登録してください。既存問題・学習履歴を上書きしないでください。

## 出典

- 問題原本: ユーザーがアップロードした東京都の2020年度試験PDF
- 試験情報: https://www.fukushi.metro.tokyo.lg.jp/kourei/hoken/kaigo_lib/care/shikenjyouhou
- 正答対照: https://www.u-can.co.jp/ケアマネ/sokuhou/O7E201011.html
- 正答対照: https://www.caremanagement.jp/contents3/shiken/2020a

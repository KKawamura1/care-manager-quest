# Issue #32: 競合させずに2005〜2018年度の分類を直す

## 方針

PR #33の既存 `propositions/YYYY.jsonl` は**初期スナップショット**として固定します。既存の命題ID・原文・知識分類を移行し直す必要はありません。修正したい設問だけ `revisions/YYYY/NN.jsonl` に保存してください。ほかの年度・設問は自動的に初期スナップショットが使われます。

- 2005年問1は `revisions/2005/01.jsonl`、2005年問2は `revisions/2005/02.jsonl`。それぞれ独立してマージできます。
- 同じ設問への同時変更だけは通常どおり競合し得ます。設問単位をレビュー／マージの単位としてください。
- 2005〜2018年度の840問すべてに対応。将来の2019〜2025年度でも同じ仕組みを利用できます。
- 既存の学習アプリ、問題文、正答、過去問パック、学習履歴は変更しません。これはPR #33の実験データのレビュー手順です。

## 手順

まずPR #33をマージするか、未マージの間はPR #33のブランチ `experiment/issue-32-choice-classifications` をベースにします。

1. `node scripts/create-issue32-revision.mjs 2005 01` を実行（初回のみ）。
2. 生成された `docs/taxonomy/issue-32-experiment/revisions/2005/01.jsonl` を開き、その設問の各命題の `proposition`、`subject_concept`、`attribute`、`primary_path`、`classification_status`、理由／レビュー履歴等を修正します。元の選択肢文 `source_text` と設問文 `question_stem` は変えません。
3. `node scripts/validate-issue32-classifications.mjs` で固定スナップショットの完全性を、`node scripts/validate-issue32-revisions.mjs` で現在の実効データを検証します。
4. **修正した設問ファイルだけ**をPRに含めます。別年度・別設問のPRは同時進行可能です。

`revisions/YYYY/NN.jsonl` は**一問に属する全5選択肢の命題レコード**を保持します。1選択肢を複数命題に分割する場合も同一ファイル内で `proposition_index` を連番にしてください。削除・追加する際に `question_id`、`choice_index`、`question_number`、出典レビュー用フラグは維持してください。

## 集計・難例一覧は都度生成

従来は別年度の修正でも `manifest.json`・`checksums.json`・`difficult-cases.jsonl` が一緒に書き変わるため競合しました。**これらはPR #33時点の固定スナップショット**として保存し、修正PRから変更しません。

現在の状態は追跡ファイルを編集せずに次のコマンドで得ます。

```bash
node scripts/validate-issue32-revisions.mjs --json > /tmp/issue32-current-summary.json
node scripts/validate-issue32-revisions.mjs --difficult > /tmp/issue32-current-difficult.jsonl
```

`--json` は最新の年度別件数と状態別集計を再計算し、`--difficult` は現在の `ambiguous`・`unmapped` を抽出します。集計・SHA変更のために別のPRを直す必要はありません。従来の `existing-concept-crosswalk.csv` は初回分類時のスナップショットのままです。

## PRの受入条件

- 対象年度・設問以外の分類データに差分がない。
- 一設問の選択肢は5件揃い、命題番号は各選択肢の1から連番。分類不能や複数候補を無理に`assigned`にしない。
- 原文と問題IDは保持し、命題表現／分類の変更を追跡できるよう必要なレビュー履歴を残す。
- CIの固定スナップショット検証と実効データ検証を通過する。

※これは同一ファイルの競合を減らす仕組みであり、同じ分類体系のノード自体を複数のPRが同時に編集する場合は、別途調整が必要です。

## 既知の初期データ不備

PR #33 の 2024年問24・選択肢2は、`attribute` が空のまま `assigned` になっています。初期スナップショットは変えず、この1件だけ明示的に許容します。将来この設問を `revisions/2024/24.jsonl` で修正する場合は、属性を記入しないと検証に通りません。ほかの `assigned` に空の属性がある場合はエラーです。

固定チェックサムの `README.md` 欄は、PR #33側で文章が追記されたためサイズ欄とハッシュ欄が一致していません。文書の履歴値として残し、分類スナップショットの検証対象からだけ除外しています。分類命題・manifest・難例一覧等の実データについては引き続き完全性を検証します。

# Issue #32: 設問別レビューと正本への統合

## 現在の正本

2005〜2025年度の `propositions/YYYY.jsonl`（21ファイル）が唯一の分類正本です。
以前の2005〜2018年度649ファイルに続き、PR58の88ファイルも統合しました。
現在 `revisions/` に設問別修正は残っていません。現在の件数は [README](README.md) と `manifest.json` を参照してください。

`classification_revision`・`knowledge_target_review` は過去の分類判断を保持します。
原文同期の旧設問文・旧選択肢・旧命題は `source_text_revisions` に保持します。
旧方式を含む分類レビュー履歴と、判定知識による個別意味レビューは別々に集計します。

## 設問別に作業する場合

設問別ファイルは並列レビュー中の一時的な作業領域です。レビューを統合してから正本を更新します。
年度ファイル・manifest・難例一覧・checksumsを複数の作業ブランチで同時更新すると競合するため、生成物の更新は統合担当が行います。

1. PR33の最新ブランチ（マージ後はmain）をベースにする。
2. `node scripts/create-issue32-revision.mjs 2005 01` で一設問を作成する。
3. `revisions/2005/01.jsonl` の命題・分類・判断理由・履歴を修正する。設問文と `source_text`、ID、採点・出典メタデータは保持する。
4. `node scripts/validate-issue32-revisions.mjs` と判定知識の検証スクリプトで実効データを確認する。
5. 全レビューを集め、下記の統合・同期・再生成を実行する。

最終PRのCIは設問別ファイルが残っていれば失敗します。並列レビュー中は実効データを検査し、統合済み正本を提出する段階で全チェックを通してください。
設問別ファイルは一設問に属する全5選択肢を含み、各選択肢の命題番号は1から連番にします。

## 統合・同期・再生成

```bash
node scripts/consolidate-issue32-revisions.mjs
node scripts/sync-issue32-sources.mjs
node scripts/consolidate-issue32-revisions.mjs
node scripts/consolidate-issue32-revisions.mjs --check
node scripts/sync-issue32-sources.mjs --check
node scripts/validate-issue32-classifications.mjs
node scripts/validate-issue32-revisions.mjs
node scripts/test-issue32-consolidation.mjs
```

最初の統合は全年の設問別ファイルを年度JSONLへ反映して削除します。
原文同期はリポジトリ入力の設問文・選択肢を反映し、命題の補完文と分割を維持します。
原文が変更された独立命題で安全に更新できないものは、推測せずエラーにします。
最後の統合で集計、難例一覧、READMEの現況・年度表、原文入力の指紋、全収録ファイルのチェックサムを再生成します。
修正がなくても再生成でき、繰り返し実行しても内容は変わりません。

原文入力は2005〜2017年度の `src/data/packs/pre2018/`、2018・2019年度の年度パック、
2020〜2024年度の `imports/YYYY/questions.json`、2025年度の圧縮全60問です。
生成済みの `historical.json` は入力に使いません。
PR39で保持された公式原文との二重校正未完了・当時法令未確認の制限を引き継ぎます。
`existing_*`・元の `source_quality` は取り込み時の履歴を残し、同期した文字列の現況・出典は `source_text_sync` に記録します。

## CIが検出する不整合

- 全年度の残存設問別ファイル、未対応年度・不正なファイル。
- 年度正本とmanifestの件数、分類状態、レビュー履歴数、正規化結果の不一致。
- 難例一覧・READMEの現況・年度表の同期漏れ。
- 収録ファイル一覧、サイズ、SHA-256の不一致（READMEも対象）。
- リポジトリ原文入力と全1,260問・6,300選択肢の不一致、原文入力の指紋の変化。

これらはデータの構造と同期状態の検査です。意味分類・正答・法令の正しさを全件証明するものではありません。
旧 `existing-concept-crosswalk.csv` は初回分類時点の履歴スナップショットで、現在の経路共起表ではありません。

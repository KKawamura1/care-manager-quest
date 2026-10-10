# 多年度知識分類の登録・構造検証

添付 `care_manager_taxonomy_2005_2019_v3.zip` の7ファイルをそのまま登録した。
分類の再生成や再分類は行っていない。今回のデータはまだアプリへ接続していない。

## 正本と配置

| ファイル | 用途 |
| --- | --- |
| `data/taxonomy/taxonomy-v2.json` | 年度共通の179概念、19カテゴリと親子関係 |
| `data/taxonomy/question-concepts-2005-2019.json` | 15年度900件、演習対象899問 |
| `data/taxonomy/question-concepts-2005-2025-combined.json` | 21年度1,260件、演習対象1,259問 |
| `data/taxonomy/classification-2005-2019.csv` | 追加900件のレビュー用一覧 |
| `data/taxonomy/validation.json` | 元チャットが同梱した検証結果（無改変） |
| `docs/taxonomy/import-v3/README.md` / `WORK_UPLOAD_ONLY.md` | 同梱説明・作業指示（無改変） |
| `docs/taxonomy/import-manifest.json` | 元ZIPのSHA-256、配置と7ファイルのバイト同一性 |
| `docs/taxonomy/structural-validation.json` | 今回独立して実行した構造検証の結果 |

各年度は問01〜60の60件。2005-28も分類メタデータには残り、
`isPlayable=false` / `status=excluded_exam_canceled` として演習から除外する。
2019年度は10月本試験であり、2020年3月再試験を含まない。

## 検証の再実行

依存ライブラリや問題本文の再取得は不要。リポジトリのルートから実行する。

```sh
python scripts/validate-taxonomy.py
```

JSONの重複キーを読み込み時に拒否し、IDの一意性・全年度の番号集合・件数・演習対象数、
分類先と関連概念の存在、主分類とカテゴリの一致、関連概念の重複と主概念との重複、
カテゴリと概念の親参照・循環・カテゴリ整合、公式試験分野、暫定状態フラグを検証する。
さらに900件のCSVとJSON、旧年度JSONと統合JSONの一致、同梱検証結果、
元ファイルのSHA-256とバイト数を照合する。

`python scripts/validate-taxonomy.py --write-report` は検証成功後だけ結果を再生成する。
通常のCIは書き込みをせず、保存した結果との一致まで確認する。
専用ワークフロー `.github/workflows/taxonomy.yml` がPR・mainへの関連変更時に実行する。

## 状態とスキーマ

2005〜2019の900件では `classificationRevision=3`、`officialExamDomain`、
`sourceYear`、`questionNumber`、`isPlayable`、`reviewScope`、`relatedReviewStatus` を保持した。
内訳は `needs_option_level_review` 214件、`provisional_topic_classified` 685件、
`excluded_exam_canceled` 1件。関連概念の空配列は精査完了を意味しない。

2020〜2025の360件は同梱統合JSONのv2データを保持した。
`revision=2` / `taxonomyVersion=multi-year-v2-draft` / `sourceExamDomain` を用い、
`isPlayable` は省略されているため検証ではtrueとして数える。
2020〜2024の300件は `editorial_draft_from_topic_metadata`、
2025の60件は `editorial_draft_from_prior_manual_review`。
スキーマを均すためのフィールド追加・置換は行っていない。
mainには以前のv2正本が登録されていなかったため、それとの独立比較は行っていない。
元ZIPとのバイト一致により今回の転送で内容・フラグが変わっていないことを確認した。

`classificationRevision` / `revision` は分類の版であり、問題本文・正答の版ではない。
編集上のA/B/Cと公式試験分野を混同しない。

## 既存PRと後続作業

[PR #21](https://github.com/KKawamura1/care-manager-quest/pull/21) は
2026-10-10 23:48:31 UTC（2026-10-11 08:48:31 JST）にmainへマージ済み。
今回の登録はコミット `e0c05aa144b1d5ee4bf1dccbd8dc12e0f4877899` から分岐しており、
未マージPRへの依存はない。同コミットのツリーには全年度の問題パックが存在する。
既存の問題本文、問題ID、正答、画像、アプリ、履歴、XPは今回変更していない。

アプリへの接続、旧概念IDの明示的対応付け・進捗移行、細分類での履歴再集計は
[Issue #23](https://github.com/KKawamura1/care-manager-quest/issues/23) で追跡する。
選択肢単位の分類レビューは #5、習熟度は #3、本文・正答・現行法の点検は
#11 / #17 / #19 / #22 と連携する。構造検証の成功は分類内容の確定や法令適合性を保証しない。
このデータ登録PRは自動マージしない。

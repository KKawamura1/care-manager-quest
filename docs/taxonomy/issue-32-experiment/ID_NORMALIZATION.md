# PR #33: IDの非破壊的な正規化

## 実態と問題
- 設問IDは2005〜2019年・2021〜2025年が `YYYY-NN`、2020年だけ元問題パックの `care_manager_2020_NNN`（60問・301命題）。
- `primary_path` と `candidate_paths` は旧数値IDと日本語ラベルが混在する実験パス。例: v1.0の `1.2 = 生活機能` はv1.1では `1.2 = 症状・徴候・検査` であり、IDだけ置換すると誤対応が生じる。
- `taxonomy-v1.1.json` は代表ノードのみを登録する仮説ツリー。実験パスのすべての末端概念・属性が載っているわけではない。

## 正規化の仕様
`node scripts/normalize-issue32-ids.mjs --jsonl` で、元JSONLを編集せず年度横断の参照インデックスを生成する。

| フィールド | 意味 |
| --- | --- |
| `canonical_question_id` | 統一した `YYYY-NN`。例: `2020-01` |
| `source_question_id` | 元の外部参照キー。例: `care_manager_2020_001`（破棄禁止） |
| `proposition_id` | `YYYY-NN/cN/pN`。年度横断で一意な命題ID |
| `primary_path_id` | `path32.` + 原パス配列のSHA-256先頭24桁。分類未割当はnull |
| `candidate_path_ids` | 候補パスのID（元の候補順を維持） |
| `primary_v1_1_anchor_id` | v1.1ツリー上でID・ラベル・親関係が確認できる最深祖先 |
| `primary_v1_1_exact_node_id` | 分類パス末端とv1.1正規ノードまで一致する場合のみ値を付与 |

`path32.*` は**同一の実験パスを指すID**であり、概念の永続的な意味IDではない。表記や分類位置が変われば別IDになる。同音・類似の異なるパスを機械的に同一概念とみなさない。
`primary_v1_1_anchor_id` は**末端の分類先ではない**。例えば「4 → 社会保障の仕組み → 社会保険一般 → 保険者の主体」はv1.1の末端ノードが未登録で、anchorは `4`、exactは `null`。同じ数字の旧コードが異なる意味なら移行しない。
分類の妥当性・正誤・当時法令の確認や、既存179概念との統合は行わない。元の `question_id` / `primary_path` / `candidate_paths` / 原文 / 学習履歴 / checksum は変更しない。

## 実行コマンド

```bash
node scripts/normalize-issue32-ids.mjs --check
node scripts/test-issue32-ids.mjs
node scripts/normalize-issue32-ids.mjs --report
node scripts/normalize-issue32-ids.mjs --aliases > /tmp/issue32-question-aliases.json
node scripts/normalize-issue32-ids.mjs --paths > /tmp/issue32-path-registry.jsonl
node scripts/normalize-issue32-ids.mjs --jsonl > /tmp/issue32-normalized-ids.jsonl
```

`--check` は21年度・1,260問・6,346命題・命題ID一意性・5肢・命題番号連番・パスID衝突を検証する。誤分類がないことは保証しない。後続の意味レビューでv1.1末端ノードを追加し、IDマッピングを確定していく。

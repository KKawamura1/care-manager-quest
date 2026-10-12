# 本番の知識分類

固定5大分類・28中分類に属する「概念 × 属性」分類を、知識マップ・5択・○×の共通カタログとして使います。

- 正本：`issue-32-experiment/propositions/YYYY.jsonl`（2005〜2025年度）
- 現行分類：年度正本の `taxonomy_assignment` と `scripts/issue32-target-taxonomy.mts`
- 移行前の監査：`scripts/normalize-issue32-ids.mjs`
- 本番用生成：`scripts/prepare-taxonomy.ts` → `src/data/packs/knowledge.json`
- 5大分類・28中分類・210使用概念・1,239引き出し・6,300選択肢
- 演習対象：5択1,259問、○×6,289枚。採点中止・真偽が一意でない選択肢の除外は維持

`npm run prepare:questions` は正本から毎回再生成します。生成JSONはGit管理外で、直接編集しません。CIで `prepare-taxonomy.ts --check` による同期検査を実行します。

旧179概念のtaxonomy、旧設問分類、年度別分類JSON、旧分類専用の検査・取込資料は削除しました。正本内の過去レビュー履歴や初回crosswalkは分類改善の追跡資料として保持し、本番の参照には使いません。

分類には未レビュー・属性未整理のものが含まれます。これらも本番で使い、後から年度正本内の `taxonomy_assignment` を修正します。分類利用のために正誤・文字校正・法令時点の検証済み状態へ変更することはありません。

解答履歴は旧分類スナップショットのまま読み込めます。知識マップは解いた問題を現在の引き出しへ投影し、XP・採点・カードの復習間隔は維持します。新分類の理解記録は別フィールドで保存し、旧分類の理解を新しい習得へ自動変換しません。

現在の移行集計・要確認キューは [再分類結果](./issue-32-experiment/RECLASSIFICATION_5X28.md)、小分類の設計仮案は [28中分類一覧](./issue-32-experiment/small-category-drafts/README.md) を参照。

import { writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { buildTargetIndex, dataUrl, smallPlan, smallConcepts } from './issue32-target-taxonomy.mts';
import { buildIndex } from './normalize-issue32-ids.mjs';

const check = process.argv.includes('--check');
const result = buildTargetIndex(), old = buildIndex();
const oldIndex = new Map(old.index.map(r => [r.proposition_id,r.primary_drawer_id]));
const oldDrawers = new Map(old.drawer_registry.map(d => [d.id,d]));
const conceptCounts = new Map<string,number>();
const crossings = new Map<string,{legacy_id:string;legacy_label:string;target_id:string;count:number}>();
for(const r of result.rows) {
  const a=r.taxonomy_assignment!; conceptCounts.set(a.concept_id,(conceptCounts.get(a.concept_id)??0)+1);
  const d=oldDrawers.get(oldIndex.get(a.proposition_id)!)!;
  const key=d.root+'/'+d.concept_id+'->'+a.concept_id;
  const crossing=crossings.get(key)??{legacy_id:d.root+'/'+d.concept_id,legacy_label:d.concept_label,target_id:a.concept_id,count:0};
  crossing.count++;crossings.set(key,crossing);
}
const write=(name:string,content:string)=>check?assert.equal(readFileSync(new URL(name,dataUrl),'utf8'),content,'stale migration report: '+name):writeFileSync(new URL(name,dataUrl),content);
const quote=(value:unknown)=>'"'+String(value??'').replaceAll('"','""')+'"';
const csv=(records:unknown[][])=>records.map(row=>row.map(quote).join(',')).join('\n')+'\n';
const categoryCounts=smallPlan.categories.map(c=>({id:c.id,label:c.label,
  propositions:result.rows.filter(r=>r.taxonomy_assignment!.category_id===c.id).length,
  active_concepts:c.concepts.filter(s=>conceptCounts.has(s.id)).length,
  proposed_concepts:c.concepts.length,
  drawers:result.drawer_registry.filter(d=>d.category_id===c.id).length,
  review_required:result.rows.filter(r=>r.taxonomy_assignment!.category_id===c.id&&r.taxonomy_assignment!.review_required).length}));
const splitLegacy=new Map<string,Set<string>>();for(const c of crossings.values())splitLegacy.set(c.legacy_id,new Set([...(splitLegacy.get(c.legacy_id)??[]),c.target_id]));
const summary={...result.summary,legacy_concept_count:splitLegacy.size,
  split_legacy_concept_count:[...splitLegacy.values()].filter(v=>v.size>1).length,
  unreviewed_semantic_propositions:6346-result.summary.semantic_reviewed,categories:categoryCounts};
write('migration-5x28-summary.json',JSON.stringify(summary,null,2)+'\n');
write('MIGRATION_5X28_CONCEPT_COUNTS.csv',csv([['concept_id','concept_label','proposition_count'],
  ...[...smallConcepts.values()].map(c=>[c.id,c.label,conceptCounts.get(c.id)??0])]));
write('MIGRATION_5X28_LEGACY_CROSSWALK.csv',csv([['legacy_root_and_concept','legacy_label','new_concept','new_label','propositions'],
  ...[...crossings.values()].sort((a,b)=>a.legacy_id.localeCompare(b.legacy_id)||a.target_id.localeCompare(b.target_id))
    .map(c=>[c.legacy_id,c.legacy_label,c.target_id,smallConcepts.get(c.target_id)!.label,c.count])]));
write('MIGRATION_5X28_REVIEW_QUEUE.csv',csv([['proposition_id','new_concept','new_attribute','method','needed_knowledge','proposition'],
  ...result.rows.filter(r=>r.taxonomy_assignment!.review_required).map(r=>[r.taxonomy_assignment!.proposition_id,
    r.taxonomy_assignment!.concept_id,r.taxonomy_assignment!.attribute_label,r.taxonomy_assignment!.method,
    r.knowledge_target_review?.needed_knowledge??'',r.proposition])]));
const table=categoryCounts.map(c=>`| ${c.id} ${c.label} | ${c.propositions} | ${c.active_concepts}/${c.proposed_concepts} | ${c.drawers} | ${c.review_required} |`).join('\n');
write('RECLASSIFICATION_5X28.md',`# 5大分類・28中分類への再分類\n\nPR68の最新2例を継承し、全28中分類について一次資料からの候補→少数の既存概念・命題サンプル→照合した小分類案を先にコミットした。合計214案。その後、療養通所介護の時点差を扱う1案を追加し215案とした。大分類・中分類のID・名称は変更していない。\n\n## 現在の結果\n\n- 全6,346命題を、新5→28→概念→属性へ仮配置。所属のない命題は0件。\n- 旧490概念から、実際に使われる${summary.active_concept_count}概念・${summary.drawer_count}引き出しへ整理。${summary.split_legacy_concept_count}旧概念が複数の新概念に分かれた。\n- 未使用の${summary.proposed_concept_count-summary.active_concept_count}小分類案は削除せず、設計案として保持。\n- 新分類の要確認は${summary.migration_review_required}命題。自動配置・境界・旧属性未整理を含む。原来の意味レビュー済みは${summary.semantic_reviewed}命題、未実施は${summary.unreviewed_semantic_propositions}命題で保持し、移行で承認状態を増やしていない。両要確認件数には重複がある。\n\n| 中分類 | 命題数 | 使用/仮案の概念 | 引き出し | 新分類の要確認命題 |\n| --- | ---: | ---: | ---: | ---: |\n${table}\n\n## 正本と変更方法\n\n現在の分類正本は年度JSONL内の \`taxonomy_assignment\`。そこに概念・属性ID、所属、理由、入力フィンガープリント、移行方法、要確認フラグを保持する。旧 \`primary_path\`・\`drawer_assignment\` は移行前の分類とレビューの履歴で、アプリの所属を決定しない。旧ID正規化スクリプトはその履歴の監査用。別ファイルに命題別の編集判断は置かない。\n\n原文・命題・ID・正答・出題当時の情報・既存レビュー履歴は保存した。新しい指紋検証により、判定知識や元入力を変えたまま移行判断を放置すると生成を拒否する。\n\n- 新分類の修正：当該命題の \`taxonomy_assignment\` を更新し、\`method: individual_review\`・理由を記録する。元入力の変更時は指紋も再確認する。\n- \`migrate-issue32-5x28.mts --write\` は初回移行／規則検証用。個別判断を追加した後の一括再実行で上書きしない。\n- \`npm run prepare:questions\` は年度正本から生成し、移行規則を再適用しない。設問別修正にも同じ分類を持たせ、統合前の表示にも反映する。\n- 集計再生成：\`node --experimental-strip-types scripts/report-issue32-5x28.mts\`。その後に既存の統合・チェックサム生成を実行する。\n\n## 閲覧用の結果\n\n- [全28中分類の設計仮案](./small-category-drafts/README.md)\n- [新概念別の命題数](./MIGRATION_5X28_CONCEPT_COUNTS.csv)\n- [旧490概念から新概念への対応](./MIGRATION_5X28_LEGACY_CROSSWALK.csv)\n- [新分類の要確認命題](./MIGRATION_5X28_REVIEW_QUEUE.csv)\n\n知識マップは大分類→中分類→小分類→引き出しを表示する。学習カードのID・真偽は保持し、分類の世代を5へ更新する。これは全命題の意味・当時法令のレビュー完了ではなく、後続レビューができる状態までの移行である。\n`);
console.log('5x28 report',JSON.stringify(result.summary));

import assert from 'node:assert/strict';
import { buildIndex } from './normalize-issue32-ids.mjs';
import { normalizeIds, observedPathId } from './normalize-issue32-ids.mjs';
import { identifyDrawer } from './issue32-drawers.mjs';
import { loadYear } from './issue32-revisions.mjs';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeArtifacts } from './normalize-issue32-ids.mjs';

const result = buildIndex();
const {index, summary, drawer_registry, path_drawer_relations} = result;
const lookup = new Map(index.map(x=>[x.canonical_question_id+'/c'+x.choice_index+'/p'+x.proposition_index,x]));
const drawer = (q,c,p=1) => {
  const record = lookup.get(q+'/c'+c+'/p'+p);
  assert.ok(record, 'missing fixture '+q+'/c'+c+'/p'+p);
  assert.ok(record.primary_drawer_id, 'unmapped fixture '+q+'/c'+c+'/p'+p);
  return record.primary_drawer_id;
};
const same=(ids)=>assert.equal(new Set(ids).size,1,'expected shared drawer: '+ids.join(', '));
const different=(ids)=>assert.equal(new Set(ids).size,ids.length,'unrelated fact types must not merge: '+ids.join(', '));

// Originally five unique paths. The tested fact is membership in a limit
// regime; the individual services are assertion values, not five drawers.
same([1,2,3,4,5].map(c=>drawer('2024-06',c)));
assert.match(drawer('2024-06',1), /4\.1\.benefits\.limit#applicable_services$/);

// Housing renovation benefit: eligible work vs a financial limit.
same([2,3,4,5].map(c=>drawer('2023-54',c)));
different([drawer('2023-54',1),drawer('2023-54',2)]);

// Facility-specific staffing and operations, NOT generic care manager licensing.
same([3,4].map(c=>drawer('2024-57',c)));
same([1,2,5].map(c=>drawer('2024-57',c)));
different([drawer('2024-57',3),drawer('2024-57',1),drawer('2025-05',1)]);
same([1,2,5].map(c=>drawer('2025-05',c)));
same([3,4].map(c=>drawer('2025-05',c)));
different([drawer('2025-05',1),drawer('2025-05',3)]);

// Provider-specific rules should not leak into generic care methodology.
// A provider's plan obligation and its liaison duties are separate facets.
different([drawer('2025-50',3),drawer('2025-50',4),drawer('2025-50',5)]);
assert.match(drawer('2025-50',3),/3\.1\.home\.visiting_care#care_plan$/);

// Broad 2005-era headings mention four separate dimensions; inspect the
// proposition instead of falsely grouping all facts as "application".
const oldCertified=[1,2,3,4,5].map(c=>drawer('2005-16',c));
assert.equal(new Set(oldCertified).size,5,'2005 certification facets must not collapse');
assert.match(drawer('2005-16',1),/#survey$/);
assert.match(drawer('2005-16',3),/#committee$/);
assert.match(drawer('2005-16',4),/#validity$/);
assert.match(drawer('2005-16',5),/#application$/);
const otherCertification=[1,2,3,4,5].map(c=>drawer('2009-14',c));
assert.match(drawer('2009-14',1),/#survey$/);
assert.match(drawer('2009-14',4),/#specific_diseases$/);
assert.match(drawer('2009-14',5),/#committee$/);

// Assert values stay distinct while knowledge location is reused.
same([1,2,3,4].map(c=>drawer('2023-50',c)));
assert.equal(index.length,6346);
assert.equal(lookup.size,index.length);
assert.equal(new Set(drawer_registry.map(x=>x.id)).size,drawer_registry.length);
assert.equal(path_drawer_relations.length,summary.observed_path_count);
assert.ok(summary.normalized_drawer_count < summary.observed_path_count);
assert.ok(summary.normalization_review_required_drawers > 0,'unreviewed cases must remain flagged');
assert.ok(summary.reviewed_rule_drawer_count > 0,'curated taxonomy drawers should exist');
const ambiguous = index.filter(x=>x.classification_status==='ambiguous');
assert.equal(ambiguous.length,0,'PR58 resolved the 25 prior ambiguities');
assert.ok(ambiguous.every(x=>x.primary_drawer_id===null && x.candidate_drawer_ids.length>=2));
const originalAmbiguous=[];
for(let year=2005;year<=2025;year++) originalAmbiguous.push(...loadYear(year).filter(r=>r.knowledge_target_review?.previous.status==='ambiguous'));
assert.equal(originalAmbiguous.length,25,'consolidation must retain previous ambiguity decisions');
// Resolved rows are canonical now. Exercise unresolved handling with an explicit fixture.
const unresolved={...loadYear(2005)[0],classification_status:'ambiguous',primary_path:[],
  candidate_paths:[['2','支援の考え方と方法','相談援助'],['3','支援の提供体制','訪問看護']]};
const normalized=normalizeIds(unresolved);
assert.equal(normalized.primary_drawer_id,null);
assert.equal(normalized.candidate_drawer_ids.length,2);
assert.equal(normalized.drawer_review_required,true);

// Both ID/path provenance and drawer roots must reflect reviewed overlays.
const revised=loadYear(2017).find(r=>r.question_number===29&&r.choice_index===4);
assert.equal(lookup.get('2017-29/c4/p1').primary_path_id,observedPathId(revised.primary_path));
assert.match(drawer('2017-29',4),/^drawer32\.4\./,'COPD as a statutory special disease is not a clinical drawer');
assert.match(drawer('2005-53',2),/^drawer32\.2\./,'group-home context must not override ADL assessment knowledge');

// Identical aliases merge; parent/subtype and related concepts stay separate.
const example=(root,subject)=>({year:2025,question_number:60,choice_index:5,proposition_index:99,
  subject_concept:subject,attribute:'定義',classification_status:'assigned',proposition:'定義についての命題',
  primary_path:[root,root==='1'?'人の健康と生活':root==='2'?'支援の考え方と方法':root==='3'?'支援の提供体制':'社会保障の仕組み',subject,'定義']});
const idFor=(root,subject)=>{const row=example(root,subject);return identifyDrawer(row,row.primary_path).id;};
for(const [root,a,b]of [
  ['1','尿閉','尿路感染'],['1','肺炎','誤嚥性肺炎'],['1','脳血管疾患','脳梗塞'],
  ['1','腎不全','慢性腎不全'],['1','精神障害','気分障害'],
  ['1','血清アルブミン','クレアチニン'],['1','クレアチニン','骨密度'],
  ['2','相談援助','回想法'],['2','排泄援助','膀胱留置カテーテル'],
  ['3','福祉用具貸与','特定福祉用具販売'],['3','福祉用具貸与','福祉用具貸与・販売'],
  ['3','介護予防サービス','介護予防通所介護'],
  ['4','国民健康保険団体連合会','社会保険診療報酬支払基金'],
  ['4','保険料・財政','財政安定化基金'],
  ['4','市町村介護保険事業計画','都道府県介護保険事業支援計画'],
]) assert.notEqual(idFor(root,a),idFor(root,b),'distinct concepts: '+a+' / '+b);
for(const [root,a,b]of [['1','高血圧','高血圧症'],['1','加齢黄斑変性','加齢黄斑変性症'],
  ['3','訪問看護','指定訪問看護事業者'],['4','医療保険','医療保険制度']]) assert.equal(idFor(root,a),idFor(root,b));

// Vocabulary-prefix and statement-keyword guesses remain reviewable.
const prefix=example('3','訪問看護の未知の属性');
assert.equal(identifyDrawer(prefix,prefix.primary_path).concept_resolution,'inferred');
const broad=example('4','要介護認定');broad.attribute='申請・調査・審査判定・有効期間';broad.proposition='認定調査を実施する。';
assert.equal(identifyDrawer(broad,broad.primary_path).attribute_resolution,'inferred');

// Individual normalization reviews cover actual knowledge, including pronouns
// whose meaning cannot be recovered from the proposition string alone.
assert.ok(summary.individually_reviewed_drawer_assignments>=393);
same([1,2,3,4,5].map(c=>drawer('2014-14',c)));
assert.match(drawer('2014-14',1),/#survey$/,'basic-survey fields must not map to application');
assert.match(drawer('2014-15',5),/#survey$/,'mention of physician opinion does not override the tested calculation method');
assert.match(drawer('2013-16',1),/#committee$/,'committee establishment must not map to application');
assert.match(drawer('2011-14',3),/3\.1\.preventive_support#designation$/);
const reviewed=loadYear(2014).find(r=>r.question_number===14&&r.choice_index===1);
assert.throws(()=>identifyDrawer({...reviewed,proposition:reviewed.proposition+'変更'},reviewed.primary_path),/stale drawer decision/);
const semanticReviewCount=Array.from({length:21},(_,i)=>loadYear(2005+i)).flat()
  .filter(r=>r.knowledge_target_review?.principle==='judgment_knowledge_over_context').length;
assert.equal(summary.classification_semantically_reviewed_propositions,semanticReviewCount,
  'normalization reviews alone must not inflate semantic approvals');
assert.ok(semanticReviewCount>=538);
// Review progress can eliminate an old mixed-confidence example. Check every
// current shared drawer: reviewing one occurrence never approves another.
const uncertainDrawers=new Set(index.filter(r=>r.drawer_review_required)
  .flatMap(r=>[r.primary_drawer_id,...r.candidate_drawer_ids]).filter(Boolean));
for(const group of drawer_registry) assert.equal(group.review_required,
  uncertainDrawers.has(group.id),'shared-drawer review status: '+group.id);

const dir=mkdtempSync(join(tmpdir(),'issue32-drawer-artifacts-'));
try {
  writeArtifacts(dir,result);
  assert.equal(readdirSync(dir).length,8);
  const report=JSON.parse(readFileSync(join(dir,'normalization-report.json'),'utf8'));
  assert.equal(report.summary.proposition_count,index.length);
  const records=readFileSync(join(dir,'review-required-propositions.jsonl'),'utf8').trim().split('\n');
  assert.equal(records.length,summary.normalization_review_required_propositions);
} finally {rmSync(dir,{recursive:true,force:true});}
const old2020 = lookup.get('2020-01/c1/p1');
assert.equal(old2020.source_question_id,'care_manager_2020_001');
assert.equal(old2020.canonical_question_id,'2020-01');
console.log('issue32 semantic drawer tests passed',JSON.stringify(summary));

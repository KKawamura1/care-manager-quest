import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTargetIndex, validateTargetAssignment, targetTaxonomy, smallConcepts, dataUrl, type Proposition } from './issue32-target-taxonomy.mts';

// Compare every fixed ID, label and parent with PR68's adopted design table.
const specification=readFileSync(new URL('TARGET_TAXONOMY_5X28.md',dataUrl),'utf8');
const table=[...specification.matchAll(/^\| ([1-5](?:\.[1-8])?) \| \*\*(.+?)\*\* \|/gm)]
  .map(([,id,label])=>({id,label,parent_id:id.includes('.')?id.split('.')[0]:null}));
assert.equal(table.length,33);
assert.deepEqual(targetTaxonomy.nodes.map(({id,label,parent_id})=>({id,label,parent_id})),table);
const result=buildTargetIndex();
assert.equal(result.index.length,6346);
assert.equal(new Set(result.index.map(r=>r.proposition_id)).size,6346);
assert.equal(new Set(result.index.map(r=>r.canonical_question_id)).size,1260);
assert.equal(new Set(result.index.map(r=>r.canonical_question_id+':'+r.choice_index)).size,6300);
assert.equal(new Set(result.rows.map(r=>r.taxonomy_assignment!.category_id)).size,28);
assert.equal(result.summary.semantic_reviewed,1774,'migration must not inflate old semantic approvals');
assert.ok(result.summary.migration_review_required>0,'uncertainty must not disappear');
for(const d of result.drawer_registry)assert.ok(smallConcepts.has(d.concept_id));
const byId=new Map(result.rows.map(r=>[r.taxonomy_assignment!.proposition_id,r]));
const target=(id:string)=>byId.get(id)!.taxonomy_assignment!.concept_id;
assert.equal(target('2009-33/c3/p1'),'4.4.pharmacology');
assert.equal(target('2009-33/c1/p1'),'4.6.medication_support');
assert.equal(target('2012-59/c3/p1'),'5.3.legal_guardianship');
assert.equal(target('2005-26/c4/p1'),'4.2.parkinsons','a disease comparison must not inherit an old ICF label');
assert.equal(target('2018-04/c5/p1'),'1.5.provider_designation');
assert.equal(target('2025-22/c1/p1'),'1.6.checklist');
assert.equal(target('2025-44/c4/p1'),'3.7.nursing_multi');
const row=byId.get('2009-33/c3/p1')!;
assert.throws(()=>validateTargetAssignment({...row,proposition:row.proposition+'変更'}),/stale/);
assert.throws(()=>validateTargetAssignment({...row,taxonomy_assignment:undefined}),/missing/);
assert.throws(()=>validateTargetAssignment({...row,taxonomy_assignment:{...row.taxonomy_assignment!,proposition_id:'2025-01/c1/p1'}}),/another proposition/);
assert.throws(()=>validateTargetAssignment({...row,taxonomy_assignment:{...row.taxonomy_assignment!,category_id:'3.1'}}),/mismatch/);
assert.throws(()=>validateTargetAssignment({...row,taxonomy_assignment:{...row.taxonomy_assignment!,concept_id:'4.4.fake'}}),/unknown/);
assert.throws(()=>validateTargetAssignment({...row,taxonomy_assignment:{...row.taxonomy_assignment!,reason:''}}),/evidence/);
assert.throws(()=>validateTargetAssignment({...row,taxonomy_assignment:{...row.taxonomy_assignment!,candidate_concept_ids:['4.4.fake']}}),/unknown candidate/);
assert.throws(()=>validateTargetAssignment({...row,taxonomy_assignment:{...row.taxonomy_assignment!,attribute_id:'bad.id'}}),/attribute ID/);
// Input changes, including reviewed legacy decisions, require reconsideration.
const altered=structuredClone(row) as Proposition;altered.subject_concept='服薬支援';
assert.throws(()=>validateTargetAssignment(altered),/stale/);
console.log('5x28 taxonomy regressions passed',JSON.stringify(result.summary));

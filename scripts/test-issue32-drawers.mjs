import assert from 'node:assert/strict';
import { buildIndex } from './normalize-issue32-ids.mjs';

const {index, summary, drawer_registry, path_drawer_relations} = buildIndex();
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
same([3,5].map(c=>drawer('2025-50',c)));
different([drawer('2025-50',3),drawer('2025-50',4)]);

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
assert.equal(ambiguous.length,25);
assert.ok(ambiguous.every(x=>x.primary_drawer_id===null && x.candidate_drawer_ids.length>=2));
const old2020 = lookup.get('2020-01/c1/p1');
assert.equal(old2020.source_question_id,'care_manager_2020_001');
assert.equal(old2020.canonical_question_id,'2020-01');
console.log('issue32 semantic drawer tests passed',JSON.stringify(summary));
